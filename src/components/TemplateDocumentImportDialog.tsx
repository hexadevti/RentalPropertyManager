import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Brain, UploadSimple, X, CircleNotch } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { importTemplateFromFiles } from '@/lib/aiTemplateImport'
import { useAuth } from '@/lib/AuthContext'
import { getEdgeFunctionMessage } from '@/lib/edgeFunctionMessages'
import { useLanguage } from '@/lib/LanguageContext'
import { hasAiFeatures } from '@/lib/usagePlans'
import RichTextEditor, { plainTextToHTML } from '@/components/RichTextEditor'
import { MobilePhotoCaptureDialog } from '@/components/MobilePhotoCaptureDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export type TemplateDocumentImportResult = {
  content: string
  confidence: number
  warnings: string[]
  replacements: string[]
  files: File[]
}

type TemplateDocumentImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateContent: string
  availablePaths: string[]
  onApply: (result: TemplateDocumentImportResult) => void
}

export function TemplateDocumentImportDialog({
  open,
  onOpenChange,
  templateContent,
  availablePaths,
  onApply,
}: TemplateDocumentImportDialogProps) {
  const { tenantUsagePlan } = useAuth()
  const { t } = useLanguage()
  const [files, setFiles] = useState<File[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [replacements, setReplacements] = useState<string[]>([])
  const [extractionError, setExtractionError] = useState('')
  const [extractionStatus, setExtractionStatus] = useState('')
  const [importedContent, setImportedContent] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const filePickerRef = useRef<HTMLInputElement | null>(null)
  const cameraPickerRef = useRef<HTMLInputElement | null>(null)
  const aiFeaturesEnabled = hasAiFeatures(tenantUsagePlan)

  const imageFileEntries = useMemo(
    () => files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.type.startsWith('image/')),
    [files],
  )

  const nonImageFileEntries = useMemo(
    () => files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => !file.type.startsWith('image/')),
    [files],
  )

  useEffect(() => {
    const nextPreviewUrls = imageFileEntries.map(({ file }) => URL.createObjectURL(file))
    setPreviewUrls(nextPreviewUrls)

    return () => {
      nextPreviewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
    }
  }, [imageFileEntries])

  useEffect(() => {
    if (!open) return

    const handlePaste = (event: ClipboardEvent) => {
      const clipboardItems = event.clipboardData?.items
      if (!clipboardItems || clipboardItems.length === 0) return

      const dataTransfer = new DataTransfer()
      let imageCount = 0

      for (const item of Array.from(clipboardItems)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue

        const extension = file.type.split('/')[1] || 'png'
        const namedFile = new File([file], file.name || `clipboard-image-${Date.now()}-${imageCount + 1}.${extension}`, {
          type: file.type,
          lastModified: Date.now(),
        })

        dataTransfer.items.add(namedFile)
        imageCount += 1
      }

      if (imageCount === 0) return

      const addedCount = appendFiles(dataTransfer.files)
      if (addedCount > 0) toast.success(`${addedCount} imagem(ns) adicionada(s) por colagem.`)
      event.preventDefault()
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open])

  const resetState = () => {
    setFiles([])
    setWarnings([])
    setReplacements([])
    setExtractionError('')
    setExtractionStatus('')
    setImportedContent('')
    setConfidence(0)
    setIsExtracting(false)
  }

  const clearExtractionResult = () => {
    setWarnings([])
    setReplacements([])
    setExtractionError('')
    setExtractionStatus('')
    setImportedContent('')
    setConfidence(0)
  }

  const appendFiles = (fileList: FileList | null) => {
    let addedCount = 0
    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`))
      const next = [...current]
      for (const file of Array.from(fileList || [])) {
        const key = `${file.name}:${file.size}:${file.lastModified}`
        if (seen.has(key)) continue
        seen.add(key)
        next.push(file)
        addedCount += 1
        if (next.length >= 6) break
      }
      return next
    })

    if (addedCount > 0) clearExtractionResult()
    return addedCount
  }

  const appendFileArray = (incomingFiles: File[]) => {
    if (!incomingFiles.length) return 0
    const dataTransfer = new DataTransfer()
    incomingFiles.forEach((file) => dataTransfer.items.add(file))
    return appendFiles(dataTransfer.files)
  }

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    appendFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const addedCount = appendFiles(event.dataTransfer.files)
    if (addedCount > 0) {
      toast.success(`${addedCount} imagem(ns) adicionada(s) por arrastar e soltar.`)
    }
  }

  const handleRemoveFile = (indexToRemove: number) => {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove))
    clearExtractionResult()
  }

  const handleExtract = async () => {
    if (!aiFeaturesEnabled) {
      toast.error(t.usage_plans_view.ai_upgrade_required_message)
      return
    }

    if (files.length === 0) {
      toast.error('Selecione ao menos um arquivo.')
      return
    }

    setIsExtracting(true)
    setWarnings([])
    setReplacements([])
    setExtractionError('')
    setExtractionStatus('Iniciando importacao...')

    try {
      const result = await importTemplateFromFiles(templateContent, availablePaths, files, setExtractionStatus)
      setImportedContent(result.content)
      setWarnings(result.warnings)
      setReplacements(result.replacements)
      setConfidence(result.confidence)

      if (result.mode === 'direct-import') {
        toast.success('Conteúdo importado diretamente do documento, sem IA.')
      } else {
        toast.success(`Conteúdo processado com IA (${Math.round(result.confidence * 100)}%)`)
      }
    } catch (error: any) {
      const message = getEdgeFunctionMessage(error, t, 'Nao foi possivel extrair dados para o template.')
      setExtractionError(message)
      toast.error(message)
    } finally {
      setIsExtracting(false)
      setExtractionStatus('')
    }
  }

  const handleApply = () => {
    if (!importedContent) return
    onApply({ content: importedContent, warnings, replacements, confidence, files })
    resetState()
    onOpenChange(false)
  }

  const confidencePercent = Math.round(confidence * 100)
  const confidenceLabel = confidence >= 0.85 ? 'alta' : confidence >= 0.65 ? 'média' : 'baixa'
  const confidenceBadgeClass = confidence >= 0.85
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : confidence >= 0.65
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-rose-200 bg-rose-50 text-rose-700'
  const previewEditorContent = useMemo(
    () => plainTextToHTML(importedContent || ''),
    [importedContent],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) resetState()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Documentos por IA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie imagens, PDF, DOC ou DOCX para importar o template. O sistema decide automaticamente quando usa IA e quando importa direto.
          </p>

          {!aiFeaturesEnabled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t.usage_plans_view.ai_upgrade_required_message}
            </div>
          )}

          <input
            ref={filePickerRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            className="hidden"
            onChange={handleFileSelection}
            disabled={!aiFeaturesEnabled}
          />
          <input
            ref={cameraPickerRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFileSelection}
            disabled={!aiFeaturesEnabled}
          />

          <div
            className={`rounded-md border bg-muted/20 p-4 space-y-3 transition-colors ${isDragOver ? 'border-primary bg-primary/5' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
              setIsDragOver(false)
            }}
            onDrop={handleDrop}
          >
            <Label>Documentos/Fotos</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => filePickerRef.current?.click()} disabled={!aiFeaturesEnabled}>
                <UploadSimple size={16} className="mr-2" />
                Selecionar arquivos
              </Button>
              <Button type="button" variant="outline" onClick={() => cameraPickerRef.current?.click()} disabled={!aiFeaturesEnabled}>
                <Camera size={16} className="mr-2" />
                Usar câmera
              </Button>
              <MobilePhotoCaptureDialog
                disabled={isExtracting || !aiFeaturesEnabled}
                onFilesReady={(mobileFiles) => {
                  const addedCount = appendFileArray(mobileFiles)
                  if (addedCount > 0) {
                    toast.success(`${addedCount} foto(s) recebida(s) do celular.`)
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFiles([])
                  clearExtractionResult()
                }}
                disabled={files.length === 0}
              >
                Limpar
              </Button>
              <Button type="button" onClick={() => void handleExtract()} disabled={files.length === 0 || isExtracting || !aiFeaturesEnabled}>
                <Brain size={16} className="mr-2" />
                {isExtracting ? 'Extraindo...' : 'Extrair com IA'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isDragOver ? 'Solte os arquivos para adicionar.' : 'Arraste arquivos aqui ou cole imagens com Ctrl+V.'}
            </p>

            {files.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{files.length} arquivo(s) selecionado(s).</p>

                {imageFileEntries.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {imageFileEntries.map(({ file, index }, imageIndex) => (
                      <div key={`${file.name}-${file.lastModified}-${imageIndex}`} className="relative overflow-hidden rounded-md border bg-background">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-2 h-7 w-7 rounded-full"
                        onClick={() => handleRemoveFile(index)}
                        aria-label="Remover imagem"
                      >
                        <X size={14} weight="bold" />
                      </Button>
                      <img
                        src={previewUrls[imageIndex]}
                        alt={`Documento ${index + 1}`}
                        className="h-24 w-full object-cover"
                      />
                      <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                        {file.name || `Documento ${index + 1}`}
                      </p>
                      </div>
                    ))}
                  </div>
                )}

                {nonImageFileEntries.length > 0 && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium">Arquivos de documento</p>
                    <div className="space-y-1">
                      {nonImageFileEntries.map(({ file, index }) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-xs">
                          <p className="truncate">{file.name}</p>
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveFile(index)}>
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-medium text-amber-800">Pontos para revisar</p>
              {warnings.map((warning, index) => (
                <p key={`${warning}-${index}`} className="text-xs text-amber-700">{warning}</p>
              ))}
            </div>
          )}

          {isExtracting && extractionStatus && (
            <div className="space-y-1 rounded-md border border-sky-200 bg-sky-50/80 p-3">
              <p className="text-xs font-medium text-sky-800">Status da importacao</p>
              <div className="flex items-center gap-2 text-xs text-sky-700">
                <CircleNotch size={14} className="animate-spin" />
                <p>{extractionStatus}</p>
              </div>
            </div>
          )}

          {extractionError && (
            <div className="space-y-1 rounded-md border border-rose-200 bg-rose-50/80 p-3">
              <p className="text-xs font-medium text-rose-800">Erro na extracao</p>
              <pre className="whitespace-pre-wrap text-xs text-rose-700">{extractionError}</pre>
            </div>
          )}

          {replacements.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">Substituições sugeridas</p>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {replacements.map((line, index) => (
                  <p key={`${line}-${index}`} className="font-mono text-xs">{line}</p>
                ))}
              </div>
            </div>
          )}

          {importedContent && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Pré-visualização do conteúdo importado</p>
                <Badge variant="outline" className={confidenceBadgeClass}>
                  Confiança: {confidencePercent}% · {confidenceLabel}
                </Badge>
              </div>
              <div className="h-[50vh] overflow-hidden rounded border bg-white p-2">
                <RichTextEditor
                  content={previewEditorContent}
                  onChange={(html) => setImportedContent(html)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleApply} disabled={!importedContent}>
            Revisar e aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
