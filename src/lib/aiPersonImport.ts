import { supabase } from '@/lib/supabase'
import { getEdgeFunctionErrorFromInvokeError, getEdgeFunctionErrorFromPayload } from '@/lib/edgeFunctionMessages'
import type { GuestDocument } from '@/types'

export type PersonImportTarget = 'owner' | 'guest'

export type PersonAIDraft = {
  name: string
  email: string
  phone: string
  address: string
  nationality: string
  maritalStatus: string
  profession: string
  dateOfBirth: string
  notes: string
  documents: GuestDocument[]
}

export type PersonAIDraftResult = {
  draft: PersonAIDraft
  confidence: number
  warnings: string[]
}

function normalizeDocuments(value: unknown): GuestDocument[] {
  if (!Array.isArray(value)) return []

  const next: GuestDocument[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const type = String((item as any)?.type ?? '').trim()
    const number = String((item as any)?.number ?? '').trim()
    if (!number) continue

    const key = `${type.toLowerCase()}::${number.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    next.push({ type, number })
    if (next.length >= 8) break
  }

  return next
}

function safeText(value: unknown, max = 400) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) return []

  const warnings: string[] = []
  for (const item of value) {
    const warning = safeText(item, 180)
    if (!warning) continue
    warnings.push(warning)
    if (warnings.length >= 6) break
  }

  return warnings
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

export async function extractPersonFromImageFiles(personType: PersonImportTarget, files: File[]): Promise<PersonAIDraftResult> {
  if (files.length === 0) {
    throw new Error('Select at least one image.')
  }

  const selectedFiles = files.slice(0, 6)
  const images = await Promise.all(selectedFiles.map((file) => readFileAsDataUrl(file)))

  const { data, error } = await supabase.functions.invoke<{
    draft?: Record<string, unknown>
    confidence?: number
    warnings?: unknown[]
    error?: string
    errorKey?: string
    errorParams?: Record<string, string | number>
  }>('extract-person-from-documents-ai', {
    body: { personType, images },
  })

  if (error) {
    throw await getEdgeFunctionErrorFromInvokeError(error, 'Failed to extract data from images.')
  }

  const responseError = getEdgeFunctionErrorFromPayload(data, 'Failed to extract data from images.')
  if (responseError) {
    throw responseError
  }

  const rawDraft = data?.draft || {}
  const confidenceRaw = Number(data?.confidence)

  return {
    draft: {
      name: safeText(rawDraft.name, 180),
      email: safeText(rawDraft.email, 180),
      phone: safeText(rawDraft.phone, 40),
      address: safeText(rawDraft.address, 260),
      nationality: safeText(rawDraft.nationality, 80),
      maritalStatus: safeText(rawDraft.maritalStatus, 80),
      profession: safeText(rawDraft.profession, 120),
      dateOfBirth: safeText(rawDraft.dateOfBirth, 30),
      notes: safeText(rawDraft.notes, 1200),
      documents: normalizeDocuments(rawDraft.documents),
    },
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6,
    warnings: normalizeWarnings(data?.warnings),
  }
}
