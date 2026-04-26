import { useEffect, useRef, useState } from 'react'
import { Camera, IdentificationCard, UploadSimple, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { extractPersonFromImageFiles, type PersonAIDraft, type PersonImportTarget } from '@/lib/aiPersonImport'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { hasAiFeatures } from '@/lib/usagePlans'
import { MobilePhotoCaptureDialog } from '@/components/MobilePhotoCaptureDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export type PersonDocumentImportResult = {
  draft: PersonAIDraft
  files: File[]
  warnings: string[]
  confidence: number
}

type PersonDocumentImportDialogLabels = {
  title: string
  hint: string
  selectFiles: string
  useCamera: string
  clearFiles: string
  extract: string
  extracting: string
  filesSelected: string
  noFiles: string
  success: string
  error: string
  previewTitle: string
  reviewButton: string
  selectedImages: string
  dropOrPasteHint: string
  dropActive: string
  removeImage: string
  pastedImages: string
  droppedImages: string
  confidence: string
  confidenceHigh: string
  confidenceMedium: string
  confidenceLow: string
  warningsTitle: string
  cancel: string
  name: string
  email: string
  phone: string
  address: string
  nationality: string
  documents: string
}

type PersonDocumentImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  personType: PersonImportTarget
  labels: PersonDocumentImportDialogLabels
  onApply: (result: PersonDocumentImportResult) => void
}

export function PersonDocumentImportDialog({
  open,
  onOpenChange,
  personType,
  labels,
  onApply,
}: PersonDocumentImportDialogProps) {
  const { tenantUsagePlan } = useAuth()
  const { t } = useLanguage()
  const [files, setFiles] = useState<File[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [draft, setDraft] = useState<PersonAIDraft | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const filePickerRef = useRef<HTMLInputElement | null>(null)
  const cameraPickerRef = useRef<HTMLInputElement | null>(null)
  const aiFeaturesEnabled = hasAiFeatures(tenantUsagePlan)

  useEffect(() => {
    const nextPreviewUrls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls(nextPreviewUrls)

    return () => {
      nextPreviewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
    }
  }, [files])

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
      if (addedCount > 0) {
        toast.success(labels.pastedImages.replace('{count}', String(addedCount)))
      }
      event.preventDefault()
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open])

  const resetState = () => {
    setFiles([])
    setWarnings([])
    setDraft(null)
    setConfidence(0)
    setIsExtracting(false)
  }

  const clearExtractionResult = () => {
    setWarnings([])
    setDraft(null)
    setConfidence(0)
  }

  const appendFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return 0

    let addedCount = 0

    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`))
      const next = [...current]
      for (const file of Array.from(fileList)) {
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
      toast.success(labels.droppedImages.replace('{count}', String(addedCount)))
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
      toast.error(labels.noFiles)
      return
    }

    setIsExtracting(true)
    setWarnings([])

    try {
      const result = await extractPersonFromImageFiles(personType, files)
      setDraft(result.draft)
      setWarnings(result.warnings)
      setConfidence(result.confidence)
      toast.success(`${labels.success} (${Math.round(result.confidence * 100)}%)`)
    } catch (error: any) {
      toast.error(error?.message || labels.error)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleApply = () => {
    if (!draft) return
    onApply({ draft, files, warnings, confidence })
    resetState()
    onOpenChange(false)
  }

  const confidencePercent = Math.round(confidence * 100)
  const confidenceLabel = confidence >= 0.85
    ? labels.confidenceHigh
    : confidence >= 0.65
      ? labels.confidenceMedium
      : labels.confidenceLow
  const confidenceBadgeClass = confidence >= 0.85
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : confidence >= 0.65
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-rose-200 bg-rose-50 text-rose-700'

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) resetState()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{labels.hint}</p>

          {!aiFeaturesEnabled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t.usage_plans_view.ai_upgrade_required_message}
            </div>
          )}

          <input
            ref={filePickerRef}
            type="file"
            accept="image/*"
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
            <Label>{labels.documents}</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => filePickerRef.current?.click()} disabled={!aiFeaturesEnabled}>
                <UploadSimple size={16} className="mr-2" />
                {labels.selectFiles}
              </Button>
              <Button type="button" variant="outline" onClick={() => cameraPickerRef.current?.click()} disabled={!aiFeaturesEnabled}>
                <Camera size={16} className="mr-2" />
                {labels.useCamera}
              </Button>
              <MobilePhotoCaptureDialog
                disabled={isExtracting || !aiFeaturesEnabled}
                onFilesReady={(mobileFiles) => {
                  const addedCount = appendFileArray(mobileFiles)
                  if (addedCount > 0) {
                    toast.success(labels.filesSelected.replace('{count}', String(addedCount)))
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
                {labels.clearFiles}
              </Button>
              <Button type="button" onClick={() => void handleExtract()} disabled={files.length === 0 || isExtracting || !aiFeaturesEnabled}>
                {isExtracting ? labels.extracting : labels.extract}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isDragOver ? labels.dropActive : labels.dropOrPasteHint}
            </p>
            {files.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {labels.filesSelected.replace('{count}', String(files.length))}
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{labels.selectedImages}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {previewUrls.map((previewUrl, index) => (
                      <div key={`${previewUrl}-${index}`} className="relative overflow-hidden rounded-md border bg-background">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-2 h-7 w-7 rounded-full"
                          onClick={() => handleRemoveFile(index)}
                          aria-label={labels.removeImage}
                        >
                          <X size={14} weight="bold" />
                        </Button>
                        <img
                          src={previewUrl}
                          alt={`${labels.documents} ${index + 1}`}
                          className="h-28 w-full object-cover"
                        />
                        <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                          {files[index]?.name || `${labels.documents} ${index + 1}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-medium text-amber-800">{labels.warningsTitle}</p>
              {warnings.map((warning, index) => (
                <p key={`${warning}-${index}`} className="text-xs text-amber-700">{warning}</p>
              ))}
            </div>
          )}

          {draft && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{labels.previewTitle}</p>
                <Badge variant="outline" className={confidenceBadgeClass}>
                  {labels.confidence}: {confidencePercent}% · {confidenceLabel}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{labels.name}: </span>
                  <span className="font-medium">{draft.name || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{labels.email}: </span>
                  <span>{draft.email || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{labels.phone}: </span>
                  <span>{draft.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{labels.nationality}: </span>
                  <span>{draft.nationality || '—'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{labels.address}: </span>
                  <span>{draft.address || '—'}</span>
                </div>
                <div className="sm:col-span-2 flex items-start gap-2">
                  <IdentificationCard size={16} className="mt-0.5 text-muted-foreground" />
                  <span>
                    {draft.documents.length > 0
                      ? draft.documents.map((document) => document.type ? `${document.type}: ${document.number}` : document.number).join(' | ')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={handleApply} disabled={!draft}>
            {labels.reviewButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
