import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type PersonType = 'owner' | 'guest'

type DraftDocument = {
  type: string
  number: string
}

type PersonDraft = {
  name: string
  email: string
  phone: string
  address: string
  nationality: string
  maritalStatus: string
  profession: string
  dateOfBirth: string
  notes: string
  documents: DraftDocument[]
}

type ParsedImageInput = {
  mediaType: string
  base64: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizePhone(value: unknown) {
  return safeText(value, 40)
}

function normalizeDate(value: unknown) {
  const text = safeText(value, 30)
  if (!text) return ''

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return text

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch
    return `${yyyy}-${mm}-${dd}`
  }

  return text
}

function normalizeDocumentType(value: unknown) {
  const text = safeText(value, 80)
  if (!text) return ''

  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('passport')) return 'Passport'
  if (normalized.includes('passaporte')) return 'Passport'
  if (normalized.includes('cpf')) return 'CPF'
  if (normalized.includes('cnpj')) return 'CNPJ'
  if (normalized.includes('rg')) return 'RG'
  if (normalized.includes('cnh')) return 'CNH'
  if (normalized.includes('driver')) return 'Driver License'
  if (normalized.includes('license')) return 'Driver License'
  if (normalized.includes('carteira nacional de habilitacao')) return 'CNH'
  if (normalized.includes('dni')) return 'DNI'
  if (normalized.includes('nie')) return 'NIE'
  if (normalized.includes('nif')) return 'NIF'
  if (normalized.includes('tax id')) return 'Tax ID'
  if (normalized.includes('residence permit')) return 'Residence Permit'
  if (normalized.includes('residenc')) return 'Residence Permit'
  if (normalized === 'id' || normalized.includes('identity') || normalized.includes('identidad')) return 'ID'

  return text
}

function normalizeDocuments(value: unknown) {
  if (!Array.isArray(value)) return []

  const next: DraftDocument[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const docType = normalizeDocumentType((item as any)?.type)
    const docNumber = safeText((item as any)?.number, 120)
    if (!docNumber) continue

    const key = `${docType.toLowerCase()}::${docNumber.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    next.push({ type: docType, number: docNumber })
    if (next.length >= 8) break
  }

  return next
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) return []

  const next: string[] = []
  for (const item of value) {
    const warning = safeText(item, 180)
    if (!warning) continue
    next.push(warning)
    if (next.length >= 6) break
  }

  return next
}

function parseDataUrl(input: string): ParsedImageInput | null {
  const trimmed = String(input || '').trim()
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/)
  if (!match) return null

  const mediaType = match[1].toLowerCase()
  const base64 = match[2].replace(/\s+/g, '')
  if (!base64) return null

  return { mediaType, base64 }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return null
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
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

async function extractWithAnthropicVision(anthropicApiKey: string, personType: PersonType, images: ParsedImageInput[]) {
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6'

  const prompt = [
    `You are an OCR and data extraction engine for ${personType} registration forms.`,
    'You will receive one or more images of IDs/documents or photos taken by phone camera.',
    'Images may represent the same document front and back, multiple different documents, or casual phone photos of printed paperwork.',
    'Extract structured person data conservatively and return ONLY strict JSON.',
    '',
    'Required JSON shape:',
    '{',
    '  "name": string,',
    '  "email": string,',
    '  "phone": string,',
    '  "address": string,',
    '  "nationality": string,',
    '  "maritalStatus": string,',
    '  "profession": string,',
    '  "dateOfBirth": string,',
    '  "notes": string,',
    '  "documents": [{ "type": string, "number": string }],',
    '  "confidence": number,',
    '  "warnings": string[]',
    '}',
    '',
    'Rules:',
    '- confidence must be 0..1',
    '- dateOfBirth should be ISO YYYY-MM-DD when possible',
    '- preserve the original language of names and document fields',
    '- use empty string for unknown text fields',
    '- if uncertain, still include best-effort value and add a warning',
    '- documents can include CPF/RG/CNPJ/Passport/NIF/ID depending on source',
    '- include up to 8 documents',
    '- consolidate information across all images before answering',
    '- if front and back of the same document are present, merge them into a single person and single document entry',
    '- prefer text that is repeated consistently across multiple images',
    '- prefer the main identified person in the documents, not relatives, parents, spouses, or secondary people mentioned in the document',
    '- extract full legal name exactly as shown when readable',
    '- email and phone should only be filled when explicitly visible in the images',
    '- address should only be filled when it clearly belongs to the identified person',
    '- do not invent or infer email, phone, address, profession, nationality, or marital status',
    '- if there are multiple conflicting values for a field, choose the most plausible one and add a warning describing the conflict',
    '- if the images are blurry, cropped, glared, rotated, or partially unreadable, add warnings for the affected fields',
    '- if more than one person seems present in the uploaded images, extract the primary person only and add a warning',
    '- use canonical document types when possible: CPF, RG, CNPJ, Passport, NIF, ID, CNH, Driver License, DNI, NIE, Residence Permit, Tax ID',
    '- include document numbers exactly as visible, preserving useful separators when present',
    '- if the same document number appears more than once across images, include it only once',
    '- notes should contain only short relevant identity details not represented elsewhere, such as issuing authority or document country when useful',
  ].join('\n')

  const content = [
    { type: 'text', text: prompt },
    ...images.map((image) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.base64,
      },
    })),
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`AI extraction failed: ${detail}`)
  }

  const payload = await response.json()
  const text = Array.isArray(payload?.content)
    ? payload.content
      .filter((item: any) => item?.type === 'text')
      .map((item: any) => String(item?.text || ''))
      .join('\n')
    : ''

  const parsed = tryParseJson(text)
  if (!parsed) {
    throw new Error('AI returned an invalid extraction format.')
  }

  return parsed
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    if (!anthropicApiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401)

    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user) return jsonResponse({ error: 'Invalid authentication token' }, 401)

    const body = await req.json().catch(() => ({})) as {
      personType?: PersonType
      images?: string[]
    }

    const personType = body.personType === 'owner' ? 'owner' : 'guest'
    const rawImages = Array.isArray(body.images) ? body.images : []
    const images = rawImages.map(parseDataUrl).filter(Boolean) as ParsedImageInput[]

    if (images.length === 0) {
      return jsonResponse({ error: 'At least one valid image is required.' }, 400)
    }

    if (images.length > 6) {
      return jsonResponse({ error: 'You can send up to 6 images per extraction.' }, 400)
    }

    const aiResult = await extractWithAnthropicVision(anthropicApiKey, personType, images)

    const draft: PersonDraft = {
      name: safeText(aiResult.name, 180),
      email: safeText(aiResult.email, 180),
      phone: normalizePhone(aiResult.phone),
      address: safeText(aiResult.address, 260),
      nationality: safeText(aiResult.nationality, 80),
      maritalStatus: safeText(aiResult.maritalStatus, 80),
      profession: safeText(aiResult.profession, 120),
      dateOfBirth: normalizeDate(aiResult.dateOfBirth),
      notes: safeText(aiResult.notes, 1200),
      documents: normalizeDocuments(aiResult.documents),
    }

    const confidenceRaw = Number(aiResult.confidence)
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6
    const warnings = normalizeWarnings(aiResult.warnings)

    return jsonResponse({ draft, confidence, warnings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while extracting person data.'
    return jsonResponse({ error: message }, 500)
  }
})
