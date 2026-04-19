import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Contract, Guest, Property, ContractTemplate, Owner } from '@/types'
import { format } from 'date-fns'

export interface ContractPDFData {
  contract: Contract
  guest: Guest
  properties: Property[]
  template: ContractTemplate
  owners: Owner[]
}

const MISSING_INDEX_TEMPLATE = '[indice de variavel inexistente. i = {{index}}]'
const INVALID_XPATH_TEMPLATE = '[xpath invalido: {{xpath}}]'
const MISSING_XPATH_TEMPLATE = '[xpath inexistente: {{xpath}}]'

function isHTML(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content)
}

export type TemplateXPathContext = Record<string, unknown>

function stringifyResolvedValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function buildTemplateXPathContext(
  data: ContractPDFData,
  formatDate: (value: Date | string) => string
): TemplateXPathContext {
  return {
    contract: data.contract,
    guest: data.guest,
    properties: data.properties,
    owners: data.owners,
    template: data.template,
    currentDate: formatDate(new Date()),
  }
}

export function resolveTemplateXPath(xpath: string, context: TemplateXPathContext): { value: string; error?: string } {
  const trimmedXPath = xpath.trim()
  if (!trimmedXPath) {
    return { value: '', error: INVALID_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
  }

  const segments = trimmedXPath.split('.').filter(Boolean)
  if (segments.length === 0) {
    return { value: '', error: INVALID_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
  }

  const resolveSegments = (
    currentValue: unknown,
    segmentIndex: number,
    wildcardUsed: boolean
  ): { values: string[]; wildcardUsed: boolean; error?: string } => {
    if (segmentIndex >= segments.length) {
      return { values: [stringifyResolvedValue(currentValue)], wildcardUsed }
    }

    const segment = segments[segmentIndex]

    const numericSegment = segment.match(/^(\d+)$/)
    if (numericSegment) {
      const requestedIndex = Number(numericSegment[1])
      const arrayIndex = requestedIndex - 1
      if (!Array.isArray(currentValue)) {
        return { values: [], wildcardUsed, error: INVALID_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
      }
      if (!Number.isInteger(requestedIndex) || arrayIndex < 0 || arrayIndex >= currentValue.length) {
        return { values: [], wildcardUsed, error: MISSING_INDEX_TEMPLATE.replace('{{index}}', numericSegment[1]) }
      }
      return resolveSegments(currentValue[arrayIndex], segmentIndex + 1, wildcardUsed)
    }

    const segmentMatch = segment.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\{(\d+|x)\})?$/)
    if (!segmentMatch) {
      return { values: [], wildcardUsed, error: INVALID_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
    }

    const propertyName = segmentMatch[1]
    const indexText = segmentMatch[2]

    if (currentValue === null || currentValue === undefined || typeof currentValue !== 'object') {
      return { values: [], wildcardUsed, error: MISSING_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
    }

    const record = currentValue as Record<string, unknown>
    if (!(propertyName in record)) {
      return { values: [], wildcardUsed, error: MISSING_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
    }

    const propertyValue = record[propertyName]

    if (!indexText) {
      return resolveSegments(propertyValue, segmentIndex + 1, wildcardUsed)
    }

    if (indexText === 'x') {
      if (!Array.isArray(propertyValue)) {
        return { values: [], wildcardUsed, error: INVALID_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
      }

      const collectedValues: string[] = []
      let fallbackError: string | undefined

      propertyValue.forEach((item) => {
        const itemResolved = resolveSegments(item, segmentIndex + 1, true)
        if (itemResolved.error) {
          fallbackError = fallbackError || itemResolved.error
          return
        }
        collectedValues.push(...itemResolved.values)
      })

      if (collectedValues.length === 0 && fallbackError) {
        return { values: [], wildcardUsed: true, error: fallbackError }
      }

      return { values: collectedValues, wildcardUsed: true }
    }

    const requestedIndex = Number(indexText)
    const arrayIndex = requestedIndex - 1
    if (!Array.isArray(propertyValue)) {
      return { values: [], wildcardUsed, error: INVALID_XPATH_TEMPLATE.replace('{{xpath}}', xpath) }
    }
    if (!Number.isInteger(requestedIndex) || arrayIndex < 0 || arrayIndex >= propertyValue.length) {
      return { values: [], wildcardUsed, error: MISSING_INDEX_TEMPLATE.replace('{{index}}', indexText) }
    }
    return resolveSegments(propertyValue[arrayIndex], segmentIndex + 1, wildcardUsed)
  }

  const resolved = resolveSegments(context, 0, false)
  if (resolved.error) {
    return { value: '', error: resolved.error }
  }

  if (resolved.wildcardUsed) {
    const lines = resolved.values.map((value) => value.trim()).filter(Boolean)
    return { value: lines.map((line) => `• ${line}`).join('\n') }
  }

  return { value: resolved.values[0] || '' }
}

function renderTemplateVariables(
  content: string,
  context: TemplateXPathContext
) {
  const htmlContent = /<[a-z]/i.test(content)

  return content
    .replace(/\{\{\s*([\s\S]+?)\s*\}\}(?!\})/g, (_match, xpath: string) => {
      const resolved = resolveTemplateXPath(xpath, context)
      const rawValue = resolved.error ?? resolved.value
      if (htmlContent && rawValue.includes('\n')) {
        return rawValue.split('\n').join('<br/>')
      }
      return rawValue
    })
    .replace(/\n\s*$/, '')
}

function findWhitespaceBreakY(
  canvas: HTMLCanvasElement,
  preferredY: number,
  searchRange = 120,
  sampleStep = 3,
  maxInkRatio = 0.01
): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return preferredY

  const safePreferredY = Math.max(1, Math.min(canvas.height - 2, Math.floor(preferredY)))
  const startY = Math.max(0, safePreferredY - searchRange)
  const endY = Math.min(canvas.height - 1, safePreferredY + searchRange)
  const windowH = endY - startY + 1

  if (windowH <= 1) return safePreferredY

  const imageData = ctx.getImageData(0, startY, canvas.width, windowH)
  const data = imageData.data

  const rowInkRatio = (rowYInWindow: number) => {
    let inkCount = 0
    let sampleCount = 0
    const rowOffset = rowYInWindow * canvas.width * 4

    for (let x = 0; x < canvas.width; x += sampleStep) {
      const i = rowOffset + x * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      if (a > 10 && luminance < 245) inkCount += 1
      sampleCount += 1
    }

    return sampleCount > 0 ? inkCount / sampleCount : 1
  }

  const preferredInWindow = safePreferredY - startY
  for (let offset = 0; offset <= searchRange; offset += 1) {
    const candidates = [preferredInWindow - offset, preferredInWindow + offset]
    for (const candidate of candidates) {
      if (candidate < 0 || candidate >= windowH) continue
      if (rowInkRatio(candidate) <= maxInkRatio) {
        return startY + candidate
      }
    }
  }

  return safePreferredY
}

// ── HTML-based PDF generation (rich text templates) ──────────────────────────

async function generatePDFFromHTML(htmlContent: string): Promise<jsPDF> {
  // Clean up the HTML content to avoid trailing empty lines and extra whitespace
  let cleanedContent = htmlContent
    .trim()
    .replace(/<br\s*\/?>\s*$/gi, '') // Remove trailing <br> tags
    .replace(/\s+$/g, '') // Remove trailing whitespace

  const container = document.createElement('div')
  container.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    'width:794px',
    'padding:40px 50px 120px 50px',
    'background:white',
    'font-family:Arial,Helvetica,sans-serif',
    'font-size:12px',
    'line-height:1.6',
    'color:#000',
    'box-sizing:border-box',
    'word-break:break-word',
    'overflow-wrap:break-word',
    'white-space:normal',
  ].join(';')

  container.innerHTML = cleanedContent
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (_clonedDoc, clonedContainer) => {
        // Remove all page stylesheets from the clone so Tailwind's oklch
        // color variables don't reach the renderer (html2canvas doesn't
        // support oklch). The container uses only inline styles, so this
        // is safe.
        Array.from(_clonedDoc.querySelectorAll('link[rel="stylesheet"], style')).forEach(
          (el) => el.remove()
        )
        // Inject a minimal reset to avoid browser user-agent quirks
        const style = _clonedDoc.createElement('style')
        style.textContent = `
          * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
          }
          body { 
            margin: 0; 
            padding: 0; 
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.6;
            color: #000;
            --pdf-space: 0.4em;
          }
          p { 
            margin: 0 0 var(--pdf-space) 0; 
            orphans: 3; 
            widows: 3;
            line-height: 1.6;
          }
          p:empty::before {
            content: "\\00a0";
          }
          p:empty {
            min-height: 0;
          }
          br {
            display: block;
            content: "";
            margin: var(--pdf-space) 0;
          }
          h1, h2, h3, h4, h5, h6 {
            margin: var(--pdf-space) 0;
            line-height: 1.4;
          }
          ul, ol {
            margin: var(--pdf-space) 0;
            padding-left: 1.5em;
            line-height: 1.6;
          }
          li {
            margin: 0 0 var(--pdf-space) 0;
            line-height: 1.6;
          }
          li:last-child {
            margin-bottom: 0;
          }
          div {
            line-height: 1.6;
          }
        `
        _clonedDoc.head.appendChild(style)
        if (clonedContainer instanceof HTMLElement) {
          clonedContainer.style.border = 'none'
          clonedContainer.style.outline = 'none'
          clonedContainer.style.boxShadow = 'none'
        }
      },
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const marginTop = 10
    const marginSide = 10
    const marginBottom = 35
    const imgW = pageW - marginSide * 2
    const availablePageH = pageH - marginTop - marginBottom
    const pxPerMm = canvas.width / imgW
    const maxSliceSourceH = Math.max(1, Math.floor(availablePageH * pxPerMm))

    let sourceY = 0

    while (sourceY < canvas.height) {
      const remainingSourceH = canvas.height - sourceY
      let sourceSliceH = Math.min(remainingSourceH, maxSliceSourceH)

      // Avoid splitting through glyphs by moving the break to a nearby whitespace row.
      if (sourceY + sourceSliceH < canvas.height) {
        const preferredBreakY = sourceY + sourceSliceH
        const adjustedBreakY = findWhitespaceBreakY(canvas, preferredBreakY)
        const minAcceptedBreakY = sourceY + Math.floor(sourceSliceH * 0.6)
        if (adjustedBreakY > minAcceptedBreakY) {
          sourceSliceH = adjustedBreakY - sourceY
        }
      }

      const sliceH = (sourceSliceH / canvas.width) * imgW

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.ceil(sourceSliceH)
      const ctx = pageCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, sourceY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height)

      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', marginSide, marginTop, imgW, sliceH)

      sourceY += pageCanvas.height
      if (sourceY < canvas.height) pdf.addPage()
    }

    return pdf
  } finally {
    document.body.removeChild(container)
  }
}

// ── Plain-text PDF generation (legacy templates) ─────────────────────────────

function generatePDFFromText(content: string): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  const lineHeight = 7
  let yPosition = margin

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)

  // Split content by lines and filter out trailing empty lines
  const lines = content.split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop()
  }

  for (const line of lines) {
    if (yPosition + lineHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
    }

    if (line.trim() === '') {
      yPosition += lineHeight
      continue
    }

    if (line.startsWith('CONTRATO') || line.startsWith('CLÁUSULA')) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
    } else if (line.includes('LOCADOR') || line.includes('LOCATÁRIO') || line.includes('IMÓVEL')) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
    } else {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
    }

    for (const wrappedLine of pdf.splitTextToSize(line, maxWidth)) {
      if (yPosition + lineHeight > pageHeight - margin) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.text(wrappedLine, margin, yPosition)
      yPosition += lineHeight
    }
  }

  return pdf
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateContractPDF(
  data: ContractPDFData,
  formatCurrency: (value: number) => string,
  formatDate: (value: Date | string) => string
): Promise<jsPDF> {
  const content = renderContractTemplateContent(data, formatCurrency, formatDate)

  if (isHTML(content)) {
    return generatePDFFromHTML(content)
  }
  return generatePDFFromText(content)
}

export function renderContractTemplateContent(
  data: ContractPDFData,
  formatCurrency: (value: number) => string,
  formatDate: (value: Date | string) => string
): string {
  const context = buildTemplateXPathContext(data, formatDate)
  return renderTemplateVariables(data.template.content, context)
}

export function downloadPDF(pdf: jsPDF, filename: string) {
  pdf.save(filename)
}

export function openPDFInNewTab(pdf: jsPDF) {
  const pdfBlob = pdf.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
