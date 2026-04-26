import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  Camera,
  CheckCircle,
  CircleNotch,
  Scissors,
  Trash,
  X,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  completeMobileCaptureSession,
  fileToCompressedDataUrl,
  uploadMobileCapturePhoto,
} from '@/lib/mobilePhotoCapture'
import { getEdgeFunctionMessage } from '@/lib/edgeFunctionMessages'
import { useLanguage } from '@/lib/LanguageContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type MobileCaptureQuery = { sessionId: string; token: string }

type EditState = { index: number; rotation: number }

/** Crop rectangle in canvas display-pixel coordinates */
type CropRect = { x: number; y: number; w: number; h: number }

type ViewportRect = { width: number; height: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseQuery(): MobileCaptureQuery {
  const params = new URLSearchParams(window.location.search)
  return {
    sessionId: (params.get('session') || '').trim(),
    token: (params.get('token') || '').trim(),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Render an image rotated by `rotation` degrees onto an offscreen canvas.
 * Returns the canvas with the exact bounding dimensions after rotation.
 */
function buildRotatedCanvas(img: HTMLImageElement, rotation: number): HTMLCanvasElement {
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = img.naturalWidth * cos + img.naturalHeight * sin
  const h = img.naturalWidth * sin + img.naturalHeight * cos
  const oc = document.createElement('canvas')
  oc.width = Math.round(w)
  oc.height = Math.round(h)
  const ctx = oc.getContext('2d')!
  ctx.translate(oc.width / 2, oc.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  return oc
}

/**
 * Draw the rotated source image + optional crop overlay onto `canvas`.
 * Image is drawn with "contain" fit (letterboxed).
 */
function drawCropOverlay(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  crop: CropRect | null,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cw = canvas.width || canvas.clientWidth || 360
  const ch = canvas.height || canvas.clientHeight || 288
  const sw = source.width
  const sh = source.height

  // Contain-fit geometry
  const scale = Math.min(cw / sw, ch / sh)
  const dw = sw * scale
  const dh = sh * scale
  const ox = (cw - dw) / 2
  const oy = (ch - dh) / 2

  ctx.clearRect(0, 0, cw, ch)
  ctx.drawImage(source, ox, oy, dw, dh)

  if (crop && crop.w > 4 && crop.h > 4) {
    ctx.save()

    // Darken outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, cw, ch)

    // Redraw image inside crop region (restores brightness)
    const srcX = (crop.x - ox) / scale
    const srcY = (crop.y - oy) / scale
    const srcW = crop.w / scale
    const srcH = crop.h / scale
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h)
    ctx.drawImage(source, srcX, srcY, srcW, srcH, crop.x, crop.y, crop.w, crop.h)

    // Crop border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h)

    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(crop.x + (crop.w * i) / 3, crop.y)
      ctx.lineTo(crop.x + (crop.w * i) / 3, crop.y + crop.h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(crop.x, crop.y + (crop.h * i) / 3)
      ctx.lineTo(crop.x + crop.w, crop.y + (crop.h * i) / 3)
      ctx.stroke()
    }

    // Corner handles
    const hs = 14
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    const corners: [number, number, number, number, number, number][] = [
      [crop.x, crop.y, hs, 0, 0, hs],
      [crop.x + crop.w, crop.y, -hs, 0, 0, hs],
      [crop.x, crop.y + crop.h, hs, 0, 0, -hs],
      [crop.x + crop.w, crop.y + crop.h, -hs, 0, 0, -hs],
    ]
    for (const [cx, cy, dx1, dy1, dx2, dy2] of corners) {
      ctx.beginPath()
      ctx.moveTo(cx + dx1, cy + dy1)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx + dx2, cy + dy2)
      ctx.stroke()
    }

    ctx.restore()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MobilePhotoCapturePage() {
  const { t } = useLanguage()
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingAutoEditIndex, setPendingAutoEditIndex] = useState<number | null>(null)

  // Editor state
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editOriginalUrl, setEditOriginalUrl] = useState('')
  const [isCropMode, setIsCropMode] = useState(false)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [isBuildingCanvas, setIsBuildingCanvas] = useState(false)
  const [cropViewport, setCropViewport] = useState<ViewportRect | null>(null)

  // Refs
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const outputCanvasRef = useRef<HTMLCanvasElement>(null)
  const rotatedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startY: number }>({
    active: false,
    startX: 0,
    startY: 0,
  })
  const generatedEditUrlsRef = useRef<string[]>([])

  const query = useMemo(parseQuery, [])

  // Revoke object URLs when files change
  useEffect(() => {
    const nextUrls = files.map((f) => URL.createObjectURL(f))
    setPreviewUrls(nextUrls)
    return () => nextUrls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  useEffect(() => {
    if (pendingAutoEditIndex === null) return
    const previewUrl = previewUrls[pendingAutoEditIndex]
    if (!previewUrl) return
    startEditingPhoto(pendingAutoEditIndex)
    setPendingAutoEditIndex(null)
  }, [pendingAutoEditIndex, previewUrls])

  // ── Crop canvas ────────────────────────────────────────────────────────────

  const redrawCanvas = useCallback((rect: CropRect | null) => {
    const canvas = cropCanvasRef.current
    const source = rotatedCanvasRef.current
    if (!canvas || !source) return
    const { width, height } = canvas.getBoundingClientRect()
    if (width > 0) canvas.width = width
    if (height > 0) canvas.height = height
    if (width > 0 && height > 0) {
      setCropViewport({ width: canvas.width, height: canvas.height })
    }
    drawCropOverlay(canvas, source, rect)
  }, [])

  // When crop mode activates: load image → build rotated canvas → draw overlay
  useEffect(() => {
    if (!isCropMode || !editState) return
    let cancelled = false
    setIsBuildingCanvas(true)
    void loadImage(editImageUrl).then((img) => {
      if (cancelled) return
      rotatedCanvasRef.current = buildRotatedCanvas(img, editState.rotation)
      setIsBuildingCanvas(false)
      // Two rAF frames: first lets React render the canvas, second lets browser lay it out
      requestAnimationFrame(() => requestAnimationFrame(() => redrawCanvas(cropRect)))
    })
    return () => { cancelled = true }
  }, [isCropMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Editor controls ────────────────────────────────────────────────────────

  const startEditingPhoto = (index: number) => {
    const originalUrl = previewUrls[index]
    setEditState({ index, rotation: 0 })
    setEditImageUrl(originalUrl)
    setEditOriginalUrl(originalUrl)
    setIsCropMode(false)
    setCropRect(null)
    setCropViewport(null)
  }

  const resetEditorState = useCallback(() => {
    setIsCropMode(false)
    setCropRect(null)
    setCropViewport(null)
  }, [])

  const clearGeneratedEditUrls = useCallback(() => {
    generatedEditUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    generatedEditUrlsRef.current = []
  }, [])

  const buildEditedFile = useCallback(async (
    sourceUrl: string,
    rotation: number,
    nextCropRect: CropRect | null,
    nextCropViewport: ViewportRect | null,
    fileName: string,
  ) => {
    const img = await loadImage(sourceUrl)
    const rotated = buildRotatedCanvas(img, rotation)
    const out = outputCanvasRef.current
    const ctx = out?.getContext('2d')
    if (!out || !ctx) return null

    if (nextCropRect && nextCropViewport && nextCropRect.w > 20 && nextCropRect.h > 20) {
      const cw = nextCropViewport.width
      const ch = nextCropViewport.height
      const sw = rotated.width
      const sh = rotated.height
      const scale = Math.min(cw / sw, ch / sh)
      const ox = (cw - sw * scale) / 2
      const oy = (ch - sh * scale) / 2
      const srcX = Math.max(0, (nextCropRect.x - ox) / scale)
      const srcY = Math.max(0, (nextCropRect.y - oy) / scale)
      const srcW = Math.min(sw - srcX, nextCropRect.w / scale)
      const srcH = Math.min(sh - srcY, nextCropRect.h / scale)
      out.width = Math.max(1, Math.round(srcW))
      out.height = Math.max(1, Math.round(srcH))
      ctx.clearRect(0, 0, out.width, out.height)
      ctx.drawImage(rotated, srcX, srcY, srcW, srcH, 0, 0, out.width, out.height)
    } else {
      out.width = rotated.width
      out.height = rotated.height
      ctx.clearRect(0, 0, out.width, out.height)
      ctx.drawImage(rotated, 0, 0)
    }

    return new Promise<File | null>((resolve) => {
      out.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          resolve(new File([blob], fileName, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.88,
      )
    })
  }, [])

  const rotateImage = (angle: number) => {
    if (!editState) return
    const next = ((editState.rotation + angle) % 360 + 360) % 360
    setEditState({ ...editState, rotation: next })
    if (isCropMode) {
      // Rebuild rotated canvas for the new angle and clear crop
      void loadImage(editImageUrl).then((img) => {
        rotatedCanvasRef.current = buildRotatedCanvas(img, next)
        setCropRect(null)
        setCropViewport(null)
        requestAnimationFrame(() => requestAnimationFrame(() => redrawCanvas(null)))
      })
    }
  }

  const enterCropMode = () => setIsCropMode(true)
  const exitCropMode = async () => {
    if (!editState) return
    if (!cropRect || !cropViewport) {
      setIsCropMode(false)
      return
    }

    const nextFile = await buildEditedFile(
      editImageUrl,
      editState.rotation,
      cropRect,
      cropViewport,
      files[editState.index].name,
    )

    if (!nextFile) {
      toast.error('Falha ao confirmar o corte.')
      return
    }

    const nextUrl = URL.createObjectURL(nextFile)
    generatedEditUrlsRef.current.push(nextUrl)
    setEditImageUrl(nextUrl)
    setEditState({ ...editState, rotation: 0 })
    resetEditorState()
  }
  const resetCrop = () => { setCropRect(null); redrawCanvas(null) }

  const resetAdjustments = () => {
    clearGeneratedEditUrls()
    setEditImageUrl(editOriginalUrl)
    if (editState) {
      setEditState({ ...editState, rotation: 0 })
    }
    resetEditorState()
  }

  // ── Pointer events for crop drag ───────────────────────────────────────────

  const canvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = cropCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pt = canvasCoords(e)
    dragRef.current = { active: true, startX: pt.x, startY: pt.y }
    setCropRect({ x: pt.x, y: pt.y, w: 0, h: 0 })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active || !cropCanvasRef.current || !rotatedCanvasRef.current) return
    const pt = canvasCoords(e)
    const { startX, startY } = dragRef.current
    const rect: CropRect = {
      x: Math.min(pt.x, startX),
      y: Math.min(pt.y, startY),
      w: Math.abs(pt.x - startX),
      h: Math.abs(pt.y - startY),
    }
    // Draw directly (bypass React state) for smooth real-time feedback
    drawCropOverlay(cropCanvasRef.current, rotatedCanvasRef.current, rect)
    setCropRect(rect)
  }

  const onPointerUp = () => {
    dragRef.current.active = false
    // Discard accidental taps smaller than 20px
    setCropRect((prev) => (prev && prev.w > 20 && prev.h > 20 ? prev : null))
  }

  // ── Accept / discard ───────────────────────────────────────────────────────

  const acceptEdit = async () => {
    if (!editState || !outputCanvasRef.current) return
    try {
      const nextFile = await buildEditedFile(
        editImageUrl,
        editState.rotation,
        null,
        null,
        files[editState.index].name,
      )

      if (!nextFile) {
        toast.error('Falha ao aplicar as transformacoes.')
        return
      }

      setFiles((current) => {
        const next = [...current]
        next[editState.index] = nextFile
        return next
      })

      setEditState(null)
      setEditImageUrl('')
      setEditOriginalUrl('')
      resetEditorState()
      clearGeneratedEditUrls()
      toast.success('Foto editada com sucesso.')
    } catch {
      toast.error('Falha ao aplicar as transformacoes.')
    }
  }

  const discardEdit = () => {
    setFiles((current) => current.filter((_, i) => i !== editState?.index))
    setEditState(null)
    setEditImageUrl('')
    setEditOriginalUrl('')
    resetEditorState()
    clearGeneratedEditUrls()
  }

  const closeEditor = () => {
    setEditState(null)
    setEditImageUrl('')
    setEditOriginalUrl('')
    resetEditorState()
    clearGeneratedEditUrls()
  }

  // ── File management ────────────────────────────────────────────────────────

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setFiles((current) => {
      const next = [...current]
      let firstInsertedIndex: number | null = null
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith('image/')) continue
        if (firstInsertedIndex === null) firstInsertedIndex = next.length
        next.push(file)
        if (next.length >= 6) break
      }
      if (firstInsertedIndex !== null) setPendingAutoEditIndex(firstInsertedIndex)
      return next
    })
  }

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index))
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
      for (let i = 0; i < files.length; i++) {
        setStatusMessage(`Processando foto ${i + 1} de ${files.length}...`)
        const dataUrl = await fileToCompressedDataUrl(files[i])
        await uploadMobileCapturePhoto(query.sessionId, query.token, dataUrl)
      }
      setStatusMessage('Finalizando sessao de captura...')
      await completeMobileCaptureSession(query.sessionId, query.token)
      setIsDone(true)
      toast.success('Fotos enviadas com sucesso para o desktop.')
      setStatusMessage('Concluido. Volte para o desktop.')
    } catch (error: any) {
      const message = getEdgeFunctionMessage(error, t, 'Falha ao enviar as fotos.')
      toast.error(message)
      setStatusMessage(message)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!query.sessionId || !query.token) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <p className="font-semibold">Link invalido</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O link de captura nao contem os parametros esperados. Gere um novo QR code na tela desktop.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md space-y-4">
        {/* ── Photo list ── */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <p className="font-semibold text-base">Capturar fotos para o desktop</p>
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
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />

          <Button
            type="button"
            className="w-full"
            variant="outline"
            onClick={() => (document.getElementById('mobile-capture-input') as HTMLInputElement | null)?.click()}
            disabled={isUploading || isDone}
          >
            <Camera size={16} className="mr-2" />
            Tirar / selecionar fotos
          </Button>

          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-md border">
                  <img src={previewUrls[index]} alt={`Foto ${index + 1}`} className="h-28 w-full object-cover" />
                  <button
                    type="button"
                    className="absolute inset-0 flex items-end justify-start p-1.5"
                    onClick={() => startEditingPhoto(index)}
                    disabled={isUploading || isDone}
                    aria-label="Editar foto"
                  >
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Editar
                    </span>
                  </button>
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    onClick={(e) => { e.stopPropagation(); removeFile(index) }}
                    disabled={isUploading || isDone}
                    aria-label="Remover foto"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={() => void finishCapture()}
            disabled={isUploading || isDone || files.length === 0}
          >
            {isUploading ? (
              <><CircleNotch size={16} className="mr-2 animate-spin" />Enviando...</>
            ) : isDone ? (
              <><CheckCircle size={16} className="mr-2" />Concluido</>
            ) : (
              'Finalizar e enviar para desktop'
            )}
          </Button>

          {statusMessage && (
            <p className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
              {statusMessage}
            </p>
          )}
        </div>

        {/* ── Image editor bottom sheet ── */}
        {editState !== null && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
            <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-background">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold">
                  {isCropMode ? 'Cortar / Enquadrar' : 'Editar foto'}
                </span>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-md p-1 hover:bg-muted"
                  aria-label="Fechar editor"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 p-4 pb-8">
                {/* ── Crop mode: interactive canvas ── */}
                {isCropMode ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Arraste para selecionar a area de corte. As linhas mostram a regra dos tercos.
                    </p>

                    <div className="overflow-hidden rounded-lg border bg-black">
                      {isBuildingCanvas ? (
                        <div className="flex h-72 items-center justify-center text-white/60">
                          <CircleNotch size={24} className="animate-spin" />
                        </div>
                      ) : (
                        <canvas
                          ref={cropCanvasRef}
                          className="h-72 w-full cursor-crosshair touch-none select-none"
                          onPointerDown={onPointerDown}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onPointerCancel={onPointerUp}
                        />
                      )}
                    </div>

                    {/* Rotation also available in crop mode */}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => rotateImage(-90)}>
                        <ArrowCounterClockwise size={15} className="mr-1" /> Girar
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => rotateImage(90)}>
                        Girar <ArrowClockwise size={15} className="ml-1" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={resetCrop}>
                        Limpar selecao
                      </Button>
                      <Button type="button" size="sm" className="flex-1" onClick={() => void exitCropMode()}>
                        {cropRect ? 'Confirmar corte' : 'Cancelar'}
                      </Button>
                    </div>
                  </>
                ) : (
                  /* ── Rotation mode ── */
                  <>
                    <div className="flex h-64 items-center justify-center overflow-hidden rounded-lg border bg-black">
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                        style={{ transform: `rotate(${editState.rotation}deg)`, transition: 'transform 150ms' }}
                      />
                    </div>

                    <p className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      Corte e rotacao ficam visiveis aqui antes do aceite final.
                    </p>

                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Rotacao: {editState.rotation}°</span>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => rotateImage(-90)}>
                          <ArrowCounterClockwise size={15} className="mr-1" /> Esquerda
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => rotateImage(90)}>
                          Direita <ArrowClockwise size={15} className="ml-1" />
                        </Button>
                      </div>
                    </div>

                    <Button type="button" variant="outline" className="w-full" onClick={enterCropMode}>
                      <Scissors size={16} className="mr-2" />
                      Cortar / Enquadrar
                    </Button>

                    <Button type="button" variant="outline" className="w-full" onClick={resetAdjustments}>
                      Resetar ajustes
                    </Button>

                    <div className="flex gap-2 pt-1">
                      <Button type="button" variant="destructive" className="flex-1" onClick={discardEdit}>
                        <Trash size={16} className="mr-1" /> Descartar
                      </Button>
                      <Button type="button" className="flex-1" onClick={() => void acceptEdit()}>
                        <CheckCircle size={16} className="mr-1" /> Aceitar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden output canvas for final rendering */}
        <canvas ref={outputCanvasRef} className="hidden" />
      </div>
    </div>
  )
}