import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CheckCircle, CircleNotch, DeviceMobileCamera, QrCode } from '@phosphor-icons/react'
import { toast } from 'sonner'
import QRCode from 'qrcode'

import {
  consumeMobileCaptureSession,
  createMobileCaptureSession,
  getMobileCaptureSessionStatus,
  signedUrlsToFiles,
  type MobileCaptureSession,
  type MobileCaptureSessionStatus,
} from '@/lib/mobilePhotoCapture'
import { getEdgeFunctionMessage } from '@/lib/edgeFunctionMessages'
import { useLanguage } from '@/lib/LanguageContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const POLL_INTERVAL_MS = 2500

function isDesktopClient() {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent || ''
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)
  const hasCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false

  return !isMobileUserAgent && !hasCoarsePointer
}

function formatRemainingTime(expiresAt?: string) {
  if (!expiresAt) return ''
  const remainingMs = new Date(expiresAt).getTime() - Date.now()
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Expirada'
  const minutes = Math.floor(remainingMs / 60_000)
  const seconds = Math.floor((remainingMs % 60_000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

type MobilePhotoCaptureDialogProps = {
  disabled?: boolean
  onFilesReady: (files: File[]) => void
}

export function MobilePhotoCaptureDialog({ disabled, onFilesReady }: MobilePhotoCaptureDialogProps) {
  const { t } = useLanguage()
  const [showOnDesktop, setShowOnDesktop] = useState(false)
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<MobileCaptureSession | null>(null)
  const [status, setStatus] = useState<MobileCaptureSessionStatus | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [isRetrieving, setIsRetrieving] = useState(false)
  const [lastError, setLastError] = useState('')
  const [hasAutoRetrieved, setHasAutoRetrieved] = useState(false)
  const pollTimerRef = useRef<number | null>(null)
  const retrievalInProgressRef = useRef(false)
  const deliveredSessionRef = useRef<string | null>(null)

  const remainingLabel = useMemo(
    () => formatRemainingTime(status?.expiresAt ?? session?.expiresAt),
    [session?.expiresAt, status?.expiresAt],
  )

  useEffect(() => {
    const evaluate = () => setShowOnDesktop(isDesktopClient())
    evaluate()

    if (typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    mediaQuery.addEventListener('change', evaluate)
    return () => mediaQuery.removeEventListener('change', evaluate)
  }, [])

  useEffect(() => {
    if (!session?.mobileUrl) {
      setQrDataUrl('')
      return
    }

    QRCode.toDataURL(session.mobileUrl, { margin: 1, width: 280 })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(''))
  }, [session?.mobileUrl])

  useEffect(() => {
    const clearPoll = () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }

    if (!open || !session?.sessionId) {
      clearPoll()
      return () => clearPoll()
    }

    const pollNow = async () => {
      try {
        const nextStatus = await getMobileCaptureSessionStatus(session.sessionId)
        setStatus(nextStatus)

        if (
          nextStatus.status === 'completed'
          && nextStatus.photos.length > 0
          && !hasAutoRetrieved
          && !retrievalInProgressRef.current
          && deliveredSessionRef.current !== session.sessionId
        ) {
          retrievalInProgressRef.current = true
          setHasAutoRetrieved(true)
          setIsRetrieving(true)
          try {
            const files = await signedUrlsToFiles(nextStatus.photos)
            if (files.length > 0) {
              deliveredSessionRef.current = session.sessionId
              onFilesReady(files)
              try {
                await consumeMobileCaptureSession(session.sessionId)
              } catch (consumeError) {
                console.warn('consumeMobileCaptureSession failed:', consumeError)
              }
              toast.success(`${files.length} foto(s) recebida(s) do celular.`)
              setOpen(false)
            }
          } finally {
            retrievalInProgressRef.current = false
            setIsRetrieving(false)
          }
        }
      } catch (error: any) {
        setLastError(getEdgeFunctionMessage(error, t, 'Falha ao sincronizar status da captura.'))
      }
    }

    void pollNow()
    clearPoll()
    pollTimerRef.current = window.setInterval(() => {
      void pollNow()
    }, POLL_INTERVAL_MS)

    return () => clearPoll()
  }, [open, session?.sessionId, onFilesReady, hasAutoRetrieved])

  const startSession = async () => {
    setIsStarting(true)
    setLastError('')
    setHasAutoRetrieved(false)
    setStatus(null)

    try {
      const created = await createMobileCaptureSession(window.location.origin)
      setSession(created)
    } catch (error: any) {
      const message = getEdgeFunctionMessage(error, t, 'Falha ao iniciar captura por celular.')
      setLastError(message)
      toast.error(message)
    } finally {
      setIsStarting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && !session && !isStarting) {
      retrievalInProgressRef.current = false
      deliveredSessionRef.current = null
      void startSession()
    }
    if (!nextOpen) {
      setSession(null)
      setStatus(null)
      setQrDataUrl('')
      setLastError('')
      setHasAutoRetrieved(false)
      setIsRetrieving(false)
      retrievalInProgressRef.current = false
      deliveredSessionRef.current = null
    }
  }

  if (!showOnDesktop) return null

  return (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(true)} disabled={disabled}>
        <DeviceMobileCamera size={16} className="mr-2" />
        Tirar foto pelo celular
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode size={18} />
              Capturar no celular via QR Code
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR com o celular, tire as fotos e finalize no telefone. Esta tela aguarda automaticamente o envio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isStarting && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <CircleNotch size={16} className="animate-spin" />
                Preparando sessao segura...
              </div>
            )}

            {!isStarting && session && (
              <div className="space-y-3 rounded-md border p-4">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code para captura mobile" className="mx-auto h-56 w-56 rounded-md border" />
                ) : (
                  <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-md border bg-muted/30 text-xs text-muted-foreground">
                    Gerando QR code...
                  </div>
                )}

                <div className="rounded-md bg-muted/30 p-2 text-xs">
                  <p className="font-medium">Link alternativo</p>
                  <p className="break-all text-muted-foreground">{session.mobileUrl}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-muted/20 p-2">
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">{status?.status || session.status}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-2">
                    <p className="text-muted-foreground">Tempo restante</p>
                    <p className="font-medium">{remainingLabel || '-'}</p>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-2 text-xs">
                  <p className="text-muted-foreground">Fotos recebidas</p>
                  <p className="font-medium">{status?.photos.length || 0}</p>
                </div>

                {status?.status === 'completed' && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 text-xs">
                    <CheckCircle size={16} weight="fill" />
                    Captura concluida no celular. Importando para o desktop...
                  </div>
                )}
              </div>
            )}

            {isRetrieving && (
              <div className="flex items-center gap-2 rounded-md border bg-sky-50 text-sky-700 p-3 text-sm">
                <CircleNotch size={16} className="animate-spin" />
                Transferindo fotos para esta tela...
              </div>
            )}

            {lastError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {lastError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void startSession()} disabled={isStarting}>
              <Camera size={16} className="mr-2" />
              Gerar novo QR
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
