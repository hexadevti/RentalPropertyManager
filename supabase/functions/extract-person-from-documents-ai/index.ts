import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STARTER_PLAN_CODE = 'starter'
const AI_TOKEN_LIMIT_REACHED_MESSAGE = 'Limite mensal de tokens de IA atingido para o plano atual. Faça upgrade para continuar usando funcionalidades de IA.'
const AI_BLOCKED_BY_PLAN_MESSAGE = 'Funcionalidades de IA estao bloqueadas para o plano atual. Ajuste o plano para habilitar o acesso.'

function getUtcDateForAnchorDay(year: number, month: number, anchorDay: number) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(Math.max(anchorDay, 1), daysInMonth)
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

function resolveTenantCycleWindow(now: Date, anchorDay: number) {
  const normalizedAnchorDay = Number.isFinite(anchorDay) && anchorDay > 0 ? Math.floor(anchorDay) : 1
  let cycleStart = getUtcDateForAnchorDay(now.getUTCFullYear(), now.getUTCMonth(), normalizedAnchorDay)

  if (now.getTime() < cycleStart.getTime()) {
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    cycleStart = getUtcDateForAnchorDay(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth(), normalizedAnchorDay)
  }

  const renewalDate = getUtcDateForAnchorDay(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() + 1, normalizedAnchorDay)
  return { cycleStart, renewalDate }
}

async function getEffectiveTenantPlanCode(adminClient: any, tenantId: string) {
  const { data, error } = await adminClient
    .from('tenant_usage_plans')
    .select('plan_code')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to resolve tenant usage plan.')
  }

  return String(data?.plan_code || STARTER_PLAN_CODE).trim().toLowerCase()
}

async function ensureAiPlanAccess(adminClient: any, tenantId: string) {
  const planCode = await getEffectiveTenantPlanCode(adminClient, tenantId)

  const { data: planData, error: planError } = await adminClient
    .from('tenant_usage_plans')
    .select('custom_max_ai_tokens, usage_plans(max_ai_tokens, ai_enabled)')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (planError) {
    throw new Error(planError.message || 'Failed to resolve AI token limits for tenant plan.')
  }

  const customMaxAiTokens = Number(planData?.custom_max_ai_tokens ?? 0)
  const baseMaxAiTokens = Number(planData?.usage_plans?.max_ai_tokens ?? 0)
  const aiEnabled = planData?.usage_plans?.ai_enabled !== false
  const maxAiTokens = Number.isFinite(customMaxAiTokens) && customMaxAiTokens > 0
    ? customMaxAiTokens
    : (Number.isFinite(baseMaxAiTokens) && baseMaxAiTokens > 0 ? baseMaxAiTokens : null)

  if (!aiEnabled) {
    return {
      planCode,
      allowed: false,
      message: AI_BLOCKED_BY_PLAN_MESSAGE,
      maxAiTokens,
      usedAiTokens: 0,
      remainingAiTokens: maxAiTokens,
      reason: 'ai_blocked_by_plan',
    }
  }

  const { data: tenantData, error: tenantError } = await adminClient
    .from('tenants')
    .select('created_at')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) {
    throw new Error(tenantError.message || 'Failed to resolve tenant creation date for AI cycle window.')
  }

  const anchorDay = tenantData?.created_at ? new Date(String(tenantData.created_at)).getUTCDate() : 1
  const { cycleStart } = resolveTenantCycleWindow(new Date(), anchorDay)

  const { data: usageRows, error: usageError } = await adminClient
    .from('ai_usage_logs')
    .select('total_tokens')
    .eq('tenant_id', tenantId)
    .gte('created_at', cycleStart.toISOString())

  if (usageError) {
    throw new Error(usageError.message || 'Failed to resolve tenant AI usage.')
  }

  const usedAiTokens = (usageRows || []).reduce((sum: number, row: any) => {
    const total = Number(row?.total_tokens || 0)
    return sum + (Number.isFinite(total) ? total : 0)
  }, 0)

  if (maxAiTokens !== null && usedAiTokens >= maxAiTokens) {
    return {
      planCode,
      allowed: false,
      message: AI_TOKEN_LIMIT_REACHED_MESSAGE,
      maxAiTokens,
      usedAiTokens,
      remainingAiTokens: 0,
      reason: 'ai_token_limit_reached',
    }
  }

  return {
    planCode,
    allowed: true,
    message: null,
    maxAiTokens,
    usedAiTokens,
    remainingAiTokens: maxAiTokens === null ? null : Math.max(0, maxAiTokens - usedAiTokens),
    reason: null,
  }
}

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

const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-sonnet-4-6': [3.0, 15.0],
  'claude-opus-4-7': [15.0, 75.0],
  'claude-haiku-4-5-20251001': [0.8, 4.0],
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inputRate, outputRate] = MODEL_PRICING[model] ?? [3.0, 15.0]
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
}

async function resolveTenantContext(adminClient: any, authUserId: string) {
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('tenant_id, github_login, email')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const { data: platformAdmin } = await adminClient
    .from('platform_admins')
    .select('auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  let tenantId = profile?.tenant_id as string | undefined
  if (platformAdmin) {
    const { data: sessionTenant } = await adminClient
      .from('platform_admin_session_tenants')
      .select('tenant_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    tenantId = sessionTenant?.tenant_id ?? tenantId
  }

  return {
    tenantId: tenantId ?? null,
    userLogin: profile?.github_login ?? profile?.email ?? '',
  }
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

  return {
    parsed,
    model,
    inputTokens: Number(payload?.usage?.input_tokens ?? 0),
    outputTokens: Number(payload?.usage?.output_tokens ?? 0),
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    if (!anthropicApiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
    if (!supabaseServiceRoleKey) return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, 500)

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401)

    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user) return jsonResponse({ error: 'Invalid authentication token' }, 401)

    const authUserId = userData.user.id
    const tenantContext = await resolveTenantContext(adminClient, authUserId)
    if (!tenantContext.tenantId) return jsonResponse({ error: 'Tenant context was not found for the current user.' }, 400)

    const aiPlanAccess = await ensureAiPlanAccess(adminClient, tenantContext.tenantId)
    if (!aiPlanAccess.allowed) {
      return jsonResponse({ error: aiPlanAccess.message, code: aiPlanAccess.reason || 'ai_access_denied', planCode: aiPlanAccess.planCode }, 403)
    }

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

    const aiResponse = await extractWithAnthropicVision(anthropicApiKey, personType, images)
    const aiResult = aiResponse.parsed

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

    const costUsd = estimateCost(aiResponse.model, aiResponse.inputTokens, aiResponse.outputTokens)
    if (tenantContext.tenantId) {
      adminClient.from('ai_usage_logs').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantContext.tenantId,
        auth_user_id: authUserId,
        user_login: tenantContext.userLogin,
        model: aiResponse.model,
        question_chars: images.length,
        input_tokens: aiResponse.inputTokens,
        output_tokens: aiResponse.outputTokens,
        total_tokens: aiResponse.inputTokens + aiResponse.outputTokens,
        estimated_cost_usd: costUsd,
      }).then(({ error }: any) => {
        if (error) console.warn('ai_usage_logs insert failed:', error.message)
      })
    }

    return jsonResponse({ draft, confidence, warnings, model: aiResponse.model })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while extracting person data.'
    return jsonResponse({ error: message }, 500)
  }
})
