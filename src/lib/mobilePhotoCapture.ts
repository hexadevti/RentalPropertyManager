import { supabase } from '@/lib/supabase'
import { getEdgeFunctionErrorFromInvokeError, getEdgeFunctionErrorFromPayload } from '@/lib/edgeFunctionMessages'

export type MobileCaptureSession = {
  sessionId: string
  status: 'pending' | 'completed' | 'cancelled' | 'consumed' | 'expired'
  expiresAt: string
  mobileUrl: string
}

export type MobileCapturePhoto = {
  id: string
  mimeType: string
  fileSize: number
  createdAt: string
  signedUrl?: string
}

export type MobileCaptureSessionStatus = {
  status: 'pending' | 'completed' | 'cancelled' | 'consumed' | 'expired' | 'not-found'
  expiresAt?: string
  photos: MobileCapturePhoto[]
}

async function invokeBridge<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T & { error?: string; errorKey?: string; errorParams?: Record<string, string | number> }>('mobile-photo-capture', {
    body,
  })

  if (error) throw await getEdgeFunctionErrorFromInvokeError(error, 'Falha no fluxo de captura por celular.')
  const responseError = getEdgeFunctionErrorFromPayload(data, 'Falha no fluxo de captura por celular.')
  if (responseError) throw responseError

  return data as T
}

export async function createMobileCaptureSession(origin: string): Promise<MobileCaptureSession> {
  return invokeBridge<MobileCaptureSession>({
    action: 'createSession',
    origin,
  })
}

export async function getMobileCaptureSessionStatus(sessionId: string): Promise<MobileCaptureSessionStatus> {
  return invokeBridge<MobileCaptureSessionStatus>({
    action: 'getSessionStatus',
    sessionId,
  })
}

export async function uploadMobileCapturePhoto(sessionId: string, token: string, imageDataUrl: string) {
  return invokeBridge<{ itemId: string; captureIndex: number }>({
    action: 'uploadPhoto',
    sessionId,
    token,
    imageDataUrl,
  })
}

export async function completeMobileCaptureSession(sessionId: string, token: string) {
  return invokeBridge<{ status: 'completed'; photoCount: number }>({
    action: 'completeSession',
    sessionId,
    token,
  })
}

export async function consumeMobileCaptureSession(sessionId: string) {
  return invokeBridge<{ status: 'consumed' }>({
    action: 'consumeSession',
    sessionId,
  })
}

function inferFileName(index: number, mimeType: string) {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  return `mobile-capture-${index + 1}.${ext}`
}

export async function signedUrlsToFiles(photos: MobileCapturePhoto[]) {
  const files: File[] = []

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]
    if (!photo.signedUrl) continue

    const response = await fetch(photo.signedUrl)
    if (!response.ok) {
      throw new Error('Falha ao baixar uma foto capturada pelo celular.')
    }

    const blob = await response.blob()
    const file = new File([blob], inferFileName(index, photo.mimeType || blob.type || 'image/jpeg'), {
      type: photo.mimeType || blob.type || 'image/jpeg',
      lastModified: Date.now(),
    })
    files.push(file)
  }

  return files
}

export async function fileToCompressedDataUrl(file: File) {
  const imageBitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')

  const maxEdge = 1920
  const scale = Math.min(1, maxEdge / Math.max(imageBitmap.width, imageBitmap.height))
  const width = Math.max(1, Math.round(imageBitmap.width * scale))
  const height = Math.max(1, Math.round(imageBitmap.height * scale))

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Nao foi possivel preparar a imagem para upload.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(imageBitmap, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  imageBitmap.close()
  return dataUrl
}
