import { supabase } from '@/lib/supabase'
import * as mammoth from 'mammoth'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type TemplateAIDraftResult = {
  content: string
  confidence: number
  warnings: string[]
  replacements: string[]
  mode: 'ai-image' | 'ai-text' | 'direct-import'
}

const MAX_TEMPLATE_CONTENT_FOR_AI = 24000
const MAX_SOURCE_TEXT_FOR_AI = 32000

function safeText(value: unknown, max = 3000) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) return []

  const warnings: string[] = []
  for (const item of value) {
    const warning = safeText(item, 200)
    if (!warning) continue
    warnings.push(warning)
    if (warnings.length >= 8) break
  }
  return warnings
}

function normalizeReplacements(value: unknown) {
  if (!Array.isArray(value)) return []

  const replacements: string[] = []
  for (const item of value) {
    const line = safeText(item, 220)
    if (!line) continue
    replacements.push(line)
    if (replacements.length >= 12) break
  }
  return replacements
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plainTextToHtml(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  const paragraphs = normalized.split(/\n{2,}/)
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

function normalizeModelTextOutput(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const codeBlockMatch = trimmed.match(/```(?:html|json|text)?\s*([\s\S]*?)\s*```/i)
  return (codeBlockMatch ? codeBlockMatch[1] : trimmed).trim()
}

function stripContentEnvelopeHeuristic(text: string): string {
  let next = text.trim()
  if (!next) return ''

  next = next
    .replace(/^```(?:json|html|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  if (!/^\{\s*"content"\s*:\s*"/s.test(next)) {
    return next
  }

  next = next
    .replace(/^\{\s*"content"\s*:\s*"/s, '')
    .replace(/"\s*(,\s*"confidence"[\s\S]*|\})\s*$/s, '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()

  return next
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidateText = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed

  try {
    const parsed = JSON.parse(candidateText)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return null
  } catch {
    const match = candidateText.match(/\{[\s\S]*\}/)
    if (!match) return null

    try {
      const parsed = JSON.parse(match[0])
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
      return null
    } catch {
      return null
    }
  }
}

function unwrapNestedContentCandidate(value: unknown): string {
  let current = String(value ?? '').trim()
  if (!current) return ''

  for (let i = 0; i < 3; i += 1) {
    const normalized = stripContentEnvelopeHeuristic(normalizeModelTextOutput(current))
    const parsed = tryParseJson(normalized)
    if (!parsed) return normalized

    const nested = parsed.content
    if (typeof nested !== 'string') return normalized

    const next = nested.trim()
    if (!next || next === current) return next || normalized
    current = next
  }

  return stripContentEnvelopeHeuristic(normalizeModelTextOutput(current))
}

function cleanupExtractedText(raw: string) {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extensionOf(file: File) {
  const parts = file.name.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
}

function buildExtractionFailureMessage(details: Array<{ fileName: string; reason: string }>) {
  const header = 'Nao foi possivel extrair texto dos arquivos enviados.'
  const lines = details.map((detail) => `- ${detail.fileName}: ${detail.reason}`)
  const footer = 'Dica: para PDFs escaneados (imagem), tente importar como imagem para OCR com IA, ou use um PDF com texto selecionavel.'
  return [header, ...lines, footer].join('\n')
}

function truncateForAi(value: string, maxLength: number) {
  if (value.length <= maxLength) return value

  const headLength = Math.max(1000, Math.floor(maxLength * 0.75))
  const tailLength = Math.max(500, maxLength - headLength - 40)
  return [
    value.slice(0, headLength),
    '\n...[conteudo truncado para caber no limite de IA]...\n',
    value.slice(Math.max(0, value.length - tailLength)),
  ].join('')
}

async function getInvokeErrorMessage(error: any, fallback: string) {
  const fallbackMessage = String(error?.message || fallback)
  const response = error?.context

  if (!response || typeof response.text !== 'function') {
    return fallbackMessage
  }

  try {
    const raw = await response.text()
    if (!raw) return fallbackMessage

    try {
      const parsed = JSON.parse(raw)
      const parsedMessage = String(parsed?.error || parsed?.message || '').trim()
      return parsedMessage || raw
    } catch {
      return raw
    }
  } catch {
    return fallbackMessage
  }
}

async function readFileAsArrayBuffer(file: File) {
  return await file.arrayBuffer()
}

function wrapTextToLines(text: string, maxCharsPerLine: number) {
  const lines: string[] = []
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n')

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trimEnd()
    if (!trimmed) {
      lines.push('')
      continue
    }

    const words = trimmed.split(/\s+/)
    let current = ''
    for (const word of words) {
      if (!current) {
        current = word
        continue
      }

      const candidate = `${current} ${word}`
      if (candidate.length <= maxCharsPerLine) {
        current = candidate
      } else {
        lines.push(current)
        current = word
      }
    }

    if (current) lines.push(current)
  }

  return lines
}

function renderTextChunkToImageDataUrl(lines: string[]) {
  const width = 1400
  const height = 2000
  const marginX = 60
  const marginY = 70
  const lineHeight = 30

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Nao foi possivel criar contexto de renderizacao para OCR de compatibilidade.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#111111'
  context.font = '22px Arial, sans-serif'

  let y = marginY
  for (const line of lines) {
    context.fillText(line || ' ', marginX, y)
    y += lineHeight
  }

  return canvas.toDataURL('image/png')
}

function sourceTextToImageDataUrls(sourceText: string, maxImages = 6) {
  const wrappedLines = wrapTextToLines(sourceText, 90)
  const maxLinesPerImage = 58
  const images: string[] = []

  for (let offset = 0; offset < wrappedLines.length && images.length < maxImages; offset += maxLinesPerImage) {
    const chunk = wrappedLines.slice(offset, offset + maxLinesPerImage)
    images.push(renderTextChunkToImageDataUrl(chunk))
  }

  return images
}

async function renderPdfAsImageDataUrls(file: File, maxPages = 6): Promise<string[]> {
  const buffer = await readFileAsArrayBuffer(file)
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise

  const imageDataUrls: string[] = []
  const pagesToRender = Math.min(pdf.numPages, maxPages)

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) continue

    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))

    await page.render({ canvasContext: context, viewport }).promise
    imageDataUrls.push(canvas.toDataURL('image/png'))
  }

  return imageDataUrls
}

async function extractTextFromPdf(file: File) {
  const buffer = await readFileAsArrayBuffer(file)
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise

  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    let pageText = ''

    for (const item of (content.items || []) as any[]) {
      const token = String(item?.str || '').trim()
      if (!token) continue

      if (pageText.length > 0 && !pageText.endsWith('\n')) {
        pageText += ' '
      }

      pageText += token
      if (item?.hasEOL) {
        pageText += '\n'
      }
    }

    const normalizedPageText = cleanupExtractedText(pageText)
    if (normalizedPageText) pages.push(normalizedPageText)
  }

  return cleanupExtractedText(pages.join('\n\n'))
}

async function extractTextFromDocx(file: File) {
  const buffer = await readFileAsArrayBuffer(file)
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return cleanupExtractedText(String(result?.value || ''))
}

async function extractTextFromLegacyDoc(file: File) {
  const buffer = await readFileAsArrayBuffer(file)
  const bytes = new Uint8Array(buffer)
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const latin1 = new TextDecoder('windows-1252', { fatal: false }).decode(bytes)

  const score = (value: string) => {
    const printable = (value.match(/[\w\s.,;:!?'"()\-@#$%&/\\]/g) || []).length
    return printable / Math.max(1, value.length)
  }

  const best = score(latin1) > score(utf8) ? latin1 : utf8
  return cleanupExtractedText(best)
}

async function extractTextFromSupportedDocument(file: File) {
  const ext = extensionOf(file)
  if (ext === 'pdf') return extractTextFromPdf(file)
  if (ext === 'docx') return extractTextFromDocx(file)
  if (ext === 'doc') return extractTextFromLegacyDoc(file)
  if (ext === 'txt' || file.type === 'text/plain') {
    return cleanupExtractedText(await file.text())
  }

  throw new Error(`Formato não suportado para importação direta: ${file.name}`)
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'))
    reader.readAsDataURL(file)
  })
}

async function extractTemplateFromSourceTextWithAI(templateContent: string, availablePaths: string[], sourceText: string): Promise<TemplateAIDraftResult> {
  const templateForAi = truncateForAi(templateContent, MAX_TEMPLATE_CONTENT_FOR_AI)
  const sourceTextForAi = truncateForAi(sourceText, MAX_SOURCE_TEXT_FOR_AI)

  const { data, error } = await supabase.functions.invoke<{
    content?: string
    confidence?: number
    warnings?: unknown[]
    replacements?: unknown[]
    error?: string
  }>('extract-contract-template-from-documents-ai', {
    body: {
      templateContent: templateForAi,
      availablePaths: availablePaths.slice(0, 300),
      sourceText: sourceTextForAi,
    },
  })

  if (error) {
    const detailedMessage = await getInvokeErrorMessage(error, 'Falha ao processar o documento pela IA.')

    // Compatibility fallback: old edge deployments only accept images.
    if (/at least one valid image is required/i.test(detailedMessage)) {
      const fallbackImages = sourceTextToImageDataUrls(sourceText)
      const fallbackResult = await extractTemplateFromImageDataUrls(templateForAi, availablePaths, fallbackImages)
      return {
        ...fallbackResult,
        mode: 'ai-text',
        warnings: [
          ...fallbackResult.warnings,
          'Backend em modo legado detectado (aceita apenas imagens). Aplicado fallback automatico: texto convertido em imagens para IA.',
        ],
      }
    }

    throw new Error(detailedMessage)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  const confidenceRaw = Number(data?.confidence)
  const content = safeText(unwrapNestedContentCandidate(data?.content), 50000)

  if (!content) {
    throw new Error('A IA não retornou conteúdo de template.')
  }

  return {
    content,
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6,
    warnings: [
      ...normalizeWarnings(data?.warnings),
      ...(templateContent.length > MAX_TEMPLATE_CONTENT_FOR_AI
        ? ['Conteudo base truncado para caber no limite da IA. Revise o resultado final.']
        : []),
      ...(sourceText.length > MAX_SOURCE_TEXT_FOR_AI
        ? ['Texto do documento truncado para caber no limite da IA. Revise substituicoes pendentes.']
        : []),
    ],
    replacements: normalizeReplacements(data?.replacements),
    mode: 'ai-text',
  }
}

async function extractTemplateFromImageDataUrls(templateContent: string, availablePaths: string[], images: string[]): Promise<TemplateAIDraftResult> {
  if (images.length === 0) {
    throw new Error('Nao foi possivel gerar imagens para OCR a partir do PDF enviado.')
  }

  const effectiveTemplateContent = templateContent.trim() ? templateContent : '<p></p>'

  const selectedImages = images.slice(0, 6)
  const { data, error } = await supabase.functions.invoke<{
    content?: string
    confidence?: number
    warnings?: unknown[]
    replacements?: unknown[]
    error?: string
  }>('extract-contract-template-from-documents-ai', {
    body: {
      templateContent: effectiveTemplateContent,
      availablePaths: availablePaths.slice(0, 300),
      images: selectedImages,
    },
  })

  if (error) {
    const detailedMessage = await getInvokeErrorMessage(error, 'Falha ao processar OCR por IA para PDF escaneado.')
    throw new Error(detailedMessage)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  const confidenceRaw = Number(data?.confidence)
  const content = safeText(unwrapNestedContentCandidate(data?.content), 50000)

  if (!content) {
    throw new Error('A IA nao retornou conteudo de template no OCR do PDF escaneado.')
  }

  return {
    content,
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6,
    warnings: normalizeWarnings(data?.warnings),
    replacements: normalizeReplacements(data?.replacements),
    mode: 'ai-image',
  }
}

export async function importTemplateFromFiles(
  templateContent: string,
  availablePaths: string[],
  files: File[],
  onStatus?: (message: string) => void,
): Promise<TemplateAIDraftResult> {
  if (files.length === 0) {
    throw new Error('Selecione ao menos um arquivo.')
  }

  const selectedFiles = files.slice(0, 6)
  const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'))
  const documentFiles = selectedFiles.filter((file) => !file.type.startsWith('image/'))

  if (imageFiles.length > 0 && documentFiles.length > 0) {
    throw new Error('Envie imagens ou documentos (PDF/DOC/DOCX), mas não misture os dois tipos na mesma extração.')
  }

  if (imageFiles.length > 0) {
    onStatus?.('Processando imagens com IA...')
    const aiResult = await extractTemplateFromImageFiles(templateContent, availablePaths, imageFiles)
    return { ...aiResult, mode: 'ai-image' }
  }

  onStatus?.('Extraindo texto de PDF/DOC/DOCX...')

  const extractionResults = await Promise.all(documentFiles.map(async (file) => {
    try {
      const extracted = await extractTextFromSupportedDocument(file)
      if (!extracted) {
        return {
          fileName: file.name,
          text: '',
          reason: 'nenhum texto detectado',
        }
      }

      return {
        fileName: file.name,
        text: extracted,
        reason: '',
      }
    } catch (error: unknown) {
      return {
        fileName: file.name,
        text: '',
        reason: error instanceof Error ? error.message : 'falha inesperada na leitura do arquivo',
      }
    }
  }))

  const failedExtractions = extractionResults.filter((result) => !result.text)
  const extractedParts = extractionResults.map((result) => result.text).filter(Boolean)
  const sourceText = cleanupExtractedText(extractedParts.join('\n\n'))

  const scannedPdfCandidates = documentFiles.filter((file) => extensionOf(file) === 'pdf')

  if (!sourceText && scannedPdfCandidates.length > 0) {
    try {
      onStatus?.('PDF escaneado detectado, tentando OCR com IA...')
      let scannedImages: string[] = []
      for (const pdfFile of scannedPdfCandidates) {
        const remainingSlots = 6 - scannedImages.length
        if (remainingSlots <= 0) break

        const pdfImages = await renderPdfAsImageDataUrls(pdfFile, remainingSlots)
        scannedImages = scannedImages.concat(pdfImages)
      }

      if (scannedImages.length > 0) {
        onStatus?.('Aplicando OCR por IA nas paginas do PDF...')
        const ocrResult = await extractTemplateFromImageDataUrls(templateContent, availablePaths, scannedImages)
        return {
          ...ocrResult,
          warnings: [
            ...ocrResult.warnings,
            `PDF escaneado detectado. OCR com IA aplicado em ${Math.min(6, scannedImages.length)} pagina(s).`,
          ],
        }
      }
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'falha inesperada no OCR do PDF escaneado'
      throw new Error(
        [
          'Nao foi possivel extrair texto dos arquivos enviados.',
          `- ${scannedPdfCandidates[0]?.name || 'PDF'}: OCR automatico falhou (${reason})`,
          'Dica: tente importar imagens das paginas (PNG/JPG) ou fornecer um template base para melhorar o mapeamento por IA.',
        ].join('\n')
      )
    }
  }

  if (!sourceText) {
    throw new Error(buildExtractionFailureMessage(
      failedExtractions.map((result) => ({
        fileName: result.fileName,
        reason: result.reason || 'nenhum texto detectado',
      }))
    ))
  }

  const aiTemplateBase = templateContent.trim() ? templateContent : plainTextToHtml(sourceText)
  if (!aiTemplateBase) {
    throw new Error('O conteudo extraido do documento ficou vazio apos normalizacao para IA.')
  }

  onStatus?.('Texto extraido. Aplicando IA para sugerir substituicoes por variaveis...')
  const aiResult = await extractTemplateFromSourceTextWithAI(aiTemplateBase, availablePaths, sourceText)
  return {
    ...aiResult,
    warnings: [
      ...aiResult.warnings,
      ...failedExtractions.map((result) => `Arquivo ignorado: ${result.fileName} (${result.reason || 'nenhum texto detectado'})`),
    ],
    replacements: aiResult.replacements,
    mode: 'ai-text',
  }
}

export async function extractTemplateFromImageFiles(templateContent: string, availablePaths: string[], files: File[]): Promise<TemplateAIDraftResult> {
  if (files.length === 0) {
    throw new Error('Selecione ao menos uma imagem.')
  }

  if (!templateContent.trim()) {
    throw new Error('Adicione conteúdo base ao template antes de extrair a partir de imagens.')
  }

  const selectedFiles = files.slice(0, 6)
  const images = await Promise.all(selectedFiles.map((file) => readFileAsDataUrl(file)))

  const { data, error } = await supabase.functions.invoke<{
    content?: string
    confidence?: number
    warnings?: unknown[]
    replacements?: unknown[]
    error?: string
  }>('extract-contract-template-from-documents-ai', {
    body: {
      templateContent,
      availablePaths: availablePaths.slice(0, 300),
      images,
    },
  })

  if (error) {
    const detailedMessage = await getInvokeErrorMessage(error, 'Falha ao extrair variaveis do template pelas imagens.')
    throw new Error(detailedMessage)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  const confidenceRaw = Number(data?.confidence)
  const content = safeText(unwrapNestedContentCandidate(data?.content), 50000)

  if (!content) {
    throw new Error('A IA não retornou conteúdo de template.')
  }

  return {
    content,
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6,
    warnings: normalizeWarnings(data?.warnings),
    replacements: normalizeReplacements(data?.replacements),
    mode: 'ai-image',
  }
}
