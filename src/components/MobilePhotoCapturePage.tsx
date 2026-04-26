import { useEffect, useMemo, useState } from 'react'
import { Camera, CheckCircle, CircleNotch, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  completeMobileCaptureSession,
  fileToCompressedDataUrl,
  uploadMobileCapturePhoto,
} from '@/lib/mobilePhotoCapture'

type MobileCaptureQuery = {
  sessionId: string
  token: string
}

function parseQuery(): MobileCaptureQuery {
  const params = new URLSearchParams(window.location.search)
  return {
    sessionId: (params.get('session') || '').trim(),
    token: (params.get('token') || '').trim(),
  }
}

export function MobilePhotoCapturePage() {
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const query = useMemo(parseQuery, [])

  useEffect(() => {
    const nextUrls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls(nextUrls)

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setFiles((current) => {
      const next = [...current]
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith('image/')) continue
        next.push(file)
        if (next.length >= 6) break
      }
      return next
    })
  }

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const finishCapture = async () => {
    if (!query.sessionId || !query.token) {
      toast.error('Link invalido. Escaneie novamente o QR code no desktop.')
      return
    }

    if (files.length === 0) {
      toast.error('Capture ao menos uma foto antes de finalizar.')
      return
    }

    setIsUploading(true)
    setStatusMessage('Enviando fotos para o desktop...')

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setStatusMessage(`Processando foto ${index + 1} de ${files.length}...`)
        const dataUrl = await fileToCompressedDataUrl(file)
        await uploadMobileCapturePhoto(query.sessionId, query.token, dataUrl)
      }

      setStatusMessage('Finalizando sessao de captura...')
      await completeMobileCaptureSession(query.sessionId, query.token)

      setIsDone(true)
      toast.success('Fotos enviadas com sucesso para o desktop.')
      setStatusMessage('Concluido. Volte para o desktop.')
    } catch (error: any) {
      const message = String(error?.message || 'Falha ao enviar as fotos.')
      toast.error(message)
      setStatusMessage(message)
    } finally {
      setIsUploading(false)
    }
  }

  const isInvalidLink = !query.sessionId || !query.token

  if (isInvalidLink) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Link invalido</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              O link de captura nao contem os parametros esperados. Gere um novo QR code na tela desktop.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Capturar fotos para o desktop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tire ate 6 fotos e finalize. O desktop vai receber automaticamente quando voce confirmar.
            </p>

            <input
              id="mobile-capture-input"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files)
                event.target.value = ''
              }}
            />

            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => {
                const input = document.getElementById('mobile-capture-input') as HTMLInputElement | null
                input?.click()
              }}
              disabled={isUploading || isDone}
            >
              <Camera size={16} className="mr-2" />
              Tirar/selecionar fotos
            </Button>

            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {files.map((file, index) => {
                  return (
                    <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-md border">
                      <img src={previewUrls[index]} alt={`Foto ${index + 1}`} className="h-28 w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                        onClick={() => removeFile(index)}
                        disabled={isUploading || isDone}
                        aria-label="Remover foto"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <Button type="button" className="w-full" onClick={() => void finishCapture()} disabled={isUploading || isDone || files.length === 0}>
              {isUploading ? (
                <>
                  <CircleNotch size={16} className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : isDone ? (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Concluido
                </>
              ) : (
                'Finalizar e enviar para desktop'
              )}
            </Button>

            {statusMessage && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                {statusMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
