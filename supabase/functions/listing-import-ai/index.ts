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

type ListingType = 'room' | 'apartment' | 'house' | 'parking'

type ListingDraft = {
  sourceUrl: string
  name: string
  description: string
  address: string
  city: string
  capacity: number
  pricePerNight: number
  pricePerMonth: number
  type: ListingType
  photoUrls: string[]
}

type RoomVariant = {
  label: string
  details: string
  capacity: number | null
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

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function parsePriceToNumber(raw: unknown) {
  const text = String(raw ?? '')
  const cleaned = text.replace(/[^\d.,]/g, '').trim()
  if (!cleaned) return 0
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(',', '.')) || 0
  }
  return Number(cleaned) || 0
}

function coerceType(value: unknown): ListingType {
  const text = String(value || '').toLowerCase()
  if (text.includes('room') || text.includes('quarto')) return 'room'
  if (text.includes('parking') || text.includes('garage') || text.includes('garagem') || text.includes('estacionamento')) return 'parking'
  if (text.includes('house') || text.includes('casa')) return 'house'
  return 'apartment'
}

function toPositiveInt(value: unknown, fallback = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.round(n))
}

function extractGuestCapacityHint(text: string) {
  if (!text) return null

  const patterns = [
    /(\d{1,2})\s*(?:guests?|h[oó]spedes?|pessoas?|people|personas?)/i,
    /(?:accommodates?|acomoda(?:\s+at[eé])?|capacidade(?:\s+para)?)\s*(\d{1,2})/i,
    /(\d{1,2})\s*(?:person|persons)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.round(parsed))
    }
  }

  return null
}

function safeText(value: unknown, max = 1200) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizePhotoUrls(value: unknown) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const urls: string[] = []
  for (const item of value) {
    const url = String(item ?? '').trim()
    if (!/^https?:\/\//i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    urls.push(url)
    if (urls.length >= 12) break
  }
  return urls
}

function stripHtmlTags(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
}

function decodeBasicHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function normalizeText(input: string) {
  return decodeBasicHtmlEntities(stripHtmlTags(input)).replace(/\s+/g, ' ').trim()
}

function isRoomLabel(text: string) {
  if (!text) return false
  if (/tipo\s+de\s+quarto|room\s+type|quantas\s+pessoas|how\s+many\s+people/i.test(text)) return false
  return /(quarto|su[ií]te|suite|studio|apartamento|room|triple|triplo|quadruple|qu[aá]druplo|duplo|single|double|twin|family|deluxe|superior|standard|dormitory|bunk)/i.test(text)
}

function extractCapacityFromSegment(segment: string) {
  const compact = String(segment || '').replace(/\s+/g, ' ').trim()
  if (!compact) return null

  const patterns = [
    /(?:x|×)\s*(\d{1,2})\b/i,
    /(\d{1,2})\s*(?:guests?|h[oó]spedes?|pessoas?|people|persons?|adults?)/i,
    /(?:max(?:imum)?|capacidade(?:\s+para)?|acomoda(?:\s+at[eé])?)\s*(\d{1,2})/i,
  ]

  for (const pattern of patterns) {
    const match = compact.match(pattern)
    if (!match?.[1]) continue
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) return Math.max(1, Math.round(parsed))
  }

  return null
}

function inferCapacityFromRoomLabel(label: string) {
  const text = String(label || '').toLowerCase()
  if (!text) return null

  const rules: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /qu[aá]druplo|quadruple|x\s*4\b/, value: 4 },
    { pattern: /triplo|triple|x\s*3\b/, value: 3 },
    { pattern: /duplo|double|casal|x\s*2\b/, value: 2 },
    { pattern: /solteiro|single|x\s*1\b/, value: 1 },
  ]

  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.value
  }

  return null
}

function dedupeRoomVariants(items: RoomVariant[]) {
  const next: RoomVariant[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const label = item.label.trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push({ ...item, label })
    if (next.length >= 3) break
  }

  return next
}

function extractRoomVariantsFromBookingHtml(pageText: string) {
  if (!/<table|<tr|<td/i.test(pageText)) return []

  const variants: RoomVariant[] = []
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null = null

  while ((rowMatch = rowRegex.exec(pageText))) {
    const rowHtml = rowMatch[1]
    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null = null

    while ((cellMatch = cellRegex.exec(rowHtml))) {
      cells.push(cellMatch[1])
    }

    if (cells.length < 2) continue

    const roomCellText = normalizeText(cells[0])
    if (!isRoomLabel(roomCellText)) continue

    const roomLines = roomCellText.split(/\s{2,}|\s*\|\s*/).map((line) => line.trim()).filter(Boolean)
    const label = roomLines[0] || roomCellText.slice(0, 120)
    if (!isRoomLabel(label)) continue

    const details = roomLines.slice(1).join(' ').trim()
    const capacity = extractCapacityFromSegment(`${normalizeText(cells[1])} ${roomCellText}`)

    variants.push({
      label: safeText(label, 120),
      details: safeText(details, 260),
      capacity,
    })
  }

  return dedupeRoomVariants(variants)
}

function extractRoomVariantsFromBookingText(pageText: string) {
  const plain = normalizeText(pageText)
  if (!plain) return []

  const segments = plain
    .split(/(?=(?:quarto|su[ií]te|suite|studio|apartamento|room)\s)/i)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const variants: RoomVariant[] = []

  for (const segment of segments) {
    const firstSentence = segment.split(/[\n\.]/)[0]?.trim() || ''
    if (!isRoomLabel(firstSentence)) continue

    const label = safeText(firstSentence, 120)
    const details = safeText(segment.replace(firstSentence, '').trim(), 260)
    const capacity = extractCapacityFromSegment(segment)
    variants.push({ label, details, capacity })
  }

  return dedupeRoomVariants(variants)
}

function extractBookingRoomVariants(pageText: string) {
  const htmlVariants = extractRoomVariantsFromBookingHtml(pageText)
  if (htmlVariants.length >= 2) return htmlVariants

  const textVariants = extractRoomVariantsFromBookingText(pageText)
  return textVariants
}

function normalizeRoomTypeHints(value: unknown) {
  if (!Array.isArray(value)) return []
  const labels: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    const label = String(item ?? '').trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(label)
    if (labels.length >= 6) break
  }

  return labels
}

function detectRoomTypeHints(text: string) {
  const rules: Array<{ regex: RegExp; label: string }> = [
    { regex: /suite|su[ií]te/i, label: 'Suite' },
    { regex: /quarto\s+casal|cama\s+casal|double\s+bed|double\s+room|queen|king/i, label: 'Double room' },
    { regex: /quarto\s+solteiro|cama\s+solteiro|single\s+bed|single\s+room/i, label: 'Single room' },
    { regex: /twin\s+room|\btwin\b/i, label: 'Twin room' },
    { regex: /triplo|triple/i, label: 'Triple room' },
    { regex: /qu[aá]druplo|quadruple/i, label: 'Quadruple room' },
    { regex: /beliche|bunk\s*bed/i, label: 'Bunk room' },
    { regex: /sof[aá]\s*cama|sofa\s*bed/i, label: 'Sofa-bed room' },
    { regex: /studio|est[uú]dio|loft/i, label: 'Studio/Loft' },
  ]

  const labels: string[] = []
  for (const rule of rules) {
    if (rule.regex.test(text)) labels.push(rule.label)
  }

  return labels
}

function toThreeLabels(labels: string[]) {
  const next = [...labels]
  while (next.length < 3) {
    next.push(`Profile ${next.length + 1}`)
  }
  return next.slice(0, 3)
}

function buildSplitDrafts(baseDraft: ListingDraft, labels: string[]) {
  return toThreeLabels(labels).map((label, index) => {
    const suffix = `${index + 1}`.padStart(2, '0')
    const nextDescription = [
      baseDraft.description,
      `Room profile detected: ${label}.`,
    ].filter(Boolean).join('\n\n')

    return {
      ...baseDraft,
      name: `${baseDraft.name} - ${label} (${suffix})`,
      description: nextDescription,
    }
  })
}

function buildBookingRoomDrafts(baseDraft: ListingDraft, variants: RoomVariant[]) {
  return variants.slice(0, 3).map((variant, index) => {
    const suffix = `${index + 1}`.padStart(2, '0')
    const descriptionParts = [
      baseDraft.description,
      `Room profile detected: ${variant.label}.`,
      variant.details ? `Room details: ${variant.details}` : '',
    ].filter(Boolean)

    return {
      ...baseDraft,
      name: `${baseDraft.name} - ${variant.label} (${suffix})`,
      description: descriptionParts.join('\n\n'),
      type: 'room' as ListingType,
      capacity: variant.capacity ?? inferCapacityFromRoomLabel(variant.label) ?? baseDraft.capacity,
    }
  })
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

async function fetchPageSnapshot(url: string) {
  const normalized = normalizeUrl(url)
  if (!normalized) throw new Error('Please provide a valid listing URL.')

  let html = ''
  try {
    const direct = await fetch(normalized, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RPM-ListingImporter/1.0)',
      },
    })
    if (direct.ok) {
      html = await direct.text()
      if (html.trim().length > 1000) return html
    }
  } catch {
    // Ignore and fallback to text proxy.
  }

  const proxyUrl = `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//i, '')}`
  const proxy = await fetch(proxyUrl)
  if (!proxy.ok) throw new Error('Could not fetch page content for import.')
  const text = await proxy.text()
  if (!text.trim()) throw new Error('No content found at this URL.')
  return text
}

async function extractWithAnthropic(anthropicApiKey: string, sourceUrl: string, pageText: string) {
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6'
  const prompt = [
    'You are a data extraction engine for real-estate listing pages from any platform.',
    'Extract one listing in strict JSON and infer missing values conservatively.',
    'Return ONLY JSON, no markdown, no prose.',
    '',
    'Required JSON shape:',
    '{',
    '  "name": string,',
    '  "description": string,',
    '  "address": string,',
    '  "city": string,',
    '  "capacity": number,',
    '  "pricePerNight": number,',
    '  "pricePerMonth": number,',
    '  "type": "room" | "apartment" | "house" | "parking",',
    '  "photoUrls": string[],',
    '  "roomTypeHints": string[],',
    '  "confidence": number,',
    '  "warning": string',
    '}',
    '',
    'Rules:',
    '- confidence is 0..1',
    '- if a field is unknown, use empty string for text and 0 for numeric',
    '- capacity must represent guests/hóspedes (occupancy), not beds/camas',
    '- if both beds and guests are present, always use guests for capacity',
    '- capacity must be at least 1 when found, else 1',
    '- type must be one of the allowed enum values',
    '- photoUrls must be absolute image URLs and can be empty if unavailable',
    '- if you identify multiple room-type profiles (e.g. suite + double room + single room), include them in roomTypeHints',
    '',
    `Source URL: ${sourceUrl}`,
    'Page content below:',
    pageText.slice(0, 120000),
  ].join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`AI extraction failed: ${detail}`)
  }

  const payload = await response.json()
  const text = Array.isArray(payload?.content)
    ? payload.content.filter((item: any) => item?.type === 'text').map((item: any) => String(item?.text || '')).join('\n')
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

    const body = await req.json().catch(() => ({})) as { url?: string }
    const sourceUrl = normalizeUrl(String(body?.url || ''))
    if (!sourceUrl) return jsonResponse({ error: 'A valid URL is required.' }, 400)

    const pageText = await fetchPageSnapshot(sourceUrl)
    const aiResponse = await extractWithAnthropic(anthropicApiKey, sourceUrl, pageText)
    const aiResult = aiResponse.parsed

    const pricePerNight = parsePriceToNumber(aiResult.pricePerNight)
    const pricePerMonth = parsePriceToNumber(aiResult.pricePerMonth) || (pricePerNight > 0 ? Math.round(pricePerNight * 30) : 0)

    const aiCapacity = toPositiveInt(aiResult.capacity, 1)
    const guestCapacityHint = extractGuestCapacityHint([
      String(aiResult.name ?? ''),
      String(aiResult.description ?? ''),
      String(aiResult.warning ?? ''),
      pageText.slice(0, 20000),
    ].join(' '))

    const resolvedCapacity = guestCapacityHint ?? aiCapacity

    const draft: ListingDraft = {
      sourceUrl,
      name: safeText(aiResult.name, 180),
      description: safeText(aiResult.description, 2000),
      address: safeText(aiResult.address, 300),
      city: safeText(aiResult.city, 120),
      capacity: resolvedCapacity,
      pricePerNight,
      pricePerMonth,
      type: coerceType(aiResult.type),
      photoUrls: normalizePhotoUrls(aiResult.photoUrls),
    }

    if (!draft.name) {
      return jsonResponse({ error: 'Could not identify listing name from this URL.' }, 422)
    }

    const confidenceRaw = Number(aiResult.confidence)
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6
    const aiRoomTypeHints = normalizeRoomTypeHints(aiResult.roomTypeHints)
    const heuristicRoomTypeHints = detectRoomTypeHints([
      String(aiResult.name ?? ''),
      String(aiResult.description ?? ''),
      pageText.slice(0, 20000),
    ].join(' '))
    const roomTypeHints = Array.from(new Set([...aiRoomTypeHints, ...heuristicRoomTypeHints]))
    const bookingRoomVariants = extractBookingRoomVariants(pageText)

    if (bookingRoomVariants.length >= 2) {
      const drafts = buildBookingRoomDrafts(draft, bookingRoomVariants)
      const warning = safeText(
        aiResult.warning || 'Booking room table detected. Created 3 room imports for one-by-one review.',
        500,
      )
      const costUsd = estimateCost(aiResponse.model, aiResponse.inputTokens, aiResponse.outputTokens)
      if (tenantContext.tenantId) {
        adminClient.from('ai_usage_logs').insert({
          id: crypto.randomUUID(),
          tenant_id: tenantContext.tenantId,
          auth_user_id: authUserId,
          user_login: tenantContext.userLogin,
          model: aiResponse.model,
          question_chars: sourceUrl.length,
          input_tokens: aiResponse.inputTokens,
          output_tokens: aiResponse.outputTokens,
          total_tokens: aiResponse.inputTokens + aiResponse.outputTokens,
          estimated_cost_usd: costUsd,
        }).then(({ error }: any) => {
          if (error) console.warn('ai_usage_logs insert failed:', error.message)
        })
      }
      return jsonResponse({ draft: drafts[0], drafts, confidence, warning, model: aiResponse.model })
    }

    if (roomTypeHints.length > 1) {
      const drafts = buildSplitDrafts(draft, roomTypeHints)
      const warning = safeText(
        aiResult.warning || 'Multiple room types detected. Created 3 imports for one-by-one review.',
        500,
      )
      const costUsd = estimateCost(aiResponse.model, aiResponse.inputTokens, aiResponse.outputTokens)
      if (tenantContext.tenantId) {
        adminClient.from('ai_usage_logs').insert({
          id: crypto.randomUUID(),
          tenant_id: tenantContext.tenantId,
          auth_user_id: authUserId,
          user_login: tenantContext.userLogin,
          model: aiResponse.model,
          question_chars: sourceUrl.length,
          input_tokens: aiResponse.inputTokens,
          output_tokens: aiResponse.outputTokens,
          total_tokens: aiResponse.inputTokens + aiResponse.outputTokens,
          estimated_cost_usd: costUsd,
        }).then(({ error }: any) => {
          if (error) console.warn('ai_usage_logs insert failed:', error.message)
        })
      }
      return jsonResponse({ draft: drafts[0], drafts, confidence, warning, model: aiResponse.model })
    }

    const warning = safeText(aiResult.warning, 500)
    const costUsd = estimateCost(aiResponse.model, aiResponse.inputTokens, aiResponse.outputTokens)
    if (tenantContext.tenantId) {
      adminClient.from('ai_usage_logs').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantContext.tenantId,
        auth_user_id: authUserId,
        user_login: tenantContext.userLogin,
        model: aiResponse.model,
        question_chars: sourceUrl.length,
        input_tokens: aiResponse.inputTokens,
        output_tokens: aiResponse.outputTokens,
        total_tokens: aiResponse.inputTokens + aiResponse.outputTokens,
        estimated_cost_usd: costUsd,
      }).then(({ error }: any) => {
        if (error) console.warn('ai_usage_logs insert failed:', error.message)
      })
    }
    return jsonResponse({ draft, confidence, warning, model: aiResponse.model })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while importing listing.'
    return jsonResponse({ error: message }, 500)
  }
})
