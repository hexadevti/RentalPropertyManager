import { useEffect, useState } from 'react'
import { DownloadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import type { BugReportAttachment } from '@/types'

const BUG_DOCS_BUCKET = 'bug-docs'

type BugAttachmentPreviewProps = {
  attachment: BugReportAttachment
}

export function BugAttachmentPreview({ attachment }: BugAttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isImage = attachment.mimeType?.startsWith('image/')

  useEffect(() => {
    let isMounted = true

    const loadPreview = async () => {
      if (!isImage) return
      const { data, error } = await supabase.storage
        .from(BUG_DOCS_BUCKET)
        .createSignedUrl(attachment.filePath, 60 * 5)

      if (!isMounted) return
      if (error) {
        console.warn('Failed to create bug attachment preview URL:', error)
        setPreviewUrl(null)
        return
      }
      setPreviewUrl(data?.signedUrl || null)
    }

    void loadPreview()

    return () => {
      isMounted = false
    }
  }, [attachment.filePath, isImage])

  const downloadAttachment = async () => {
    const { data, error } = await supabase.storage
      .from(BUG_DOCS_BUCKET)
      .download(attachment.filePath)

    if (error || !data) {
      toast.error(error?.message || 'Falha ao baixar anexo.')
      return
    }

    const url = URL.createObjectURL(data)
    const link = window.document.createElement('a')
    link.href = url
    link.download = attachment.fileName
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
      {previewUrl && (
        <button
          type="button"
          className="block w-full bg-background"
          onClick={() => void downloadAttachment()}
          title="Baixar print"
        >
          <img src={previewUrl} alt={attachment.fileName} className="max-h-72 w-full object-contain" />
        </button>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border p-2">
        <p className="min-w-0 truncate text-sm text-muted-foreground">{attachment.fileName}</p>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => void downloadAttachment()}>
          <DownloadSimple size={16} />
          Baixar
        </Button>
      </div>
    </div>
  )
}
