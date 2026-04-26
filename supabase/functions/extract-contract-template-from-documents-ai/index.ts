import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STARTER_PLAN_CODE = 'starter'
type SupportedLanguage = 'pt' | 'en'

const AI_PLAN_MESSAGES = {
  pt: {
    tokenLimitReached: 'Limite mensal de tokens de IA atingido para o plano atual. Faça upgrade para continuar usando funcionalidades de IA.',
    blockedByPlan: 'Funcionalidades de IA estao bloqueadas para o plano atual. Ajuste o plano para habilitar o acesso.',
  },
  en: {
    tokenLimitReached: 'Monthly AI token limit reached for the current plan. Upgrade to continue using AI features.',
    blockedByPlan: 'AI features are blocked for the current plan. Change the plan to enable access.',
  },
} as const

const AI_PLAN_ERROR_KEYS = {
  tokenLimitReached: 'ai_token_limit_reached',
  blockedByPlan: 'ai_blocked_by_plan',
} as const

const ERROR_KEYS = {
  methodNotAllowed: 'edge_method_not_allowed',
  supabaseNotConfigured: 'edge_supabase_not_configured',
  anthropicNotConfigured: 'edge_anthropic_not_configured',
  serviceRoleNotConfigured: 'edge_service_role_not_configured',
  missingAuthorization: 'edge_missing_authorization',
  invalidAuthToken: 'edge_invalid_auth_token',
  tenantContextMissing: 'ai_tenant_context_missing',
  templateContentRequired: 'extract_template_content_required',
  imageOrSourceRequired: 'extract_template_image_or_source_required',
  maxImagesExceeded: 'extract_template_max_images_exceeded',
  aiReturnedNoContent: 'extract_template_ai_returned_no_content',
  unexpectedError: 'extract_template_unexpected_error',
} as const

const ERROR_MESSAGES = {
  pt: {
    methodNotAllowed: 'Metodo nao permitido',
    supabaseNotConfigured: 'Ambiente do Supabase nao configurado',
    anthropicNotConfigured: 'ANTHROPIC_API_KEY nao configurada',
    serviceRoleNotConfigured: 'SUPABASE_SERVICE_ROLE_KEY nao configurada',
    missingAuthorization: 'Cabecalho Authorization ausente',
    invalidAuthToken: 'Token de autenticacao invalido',
    tenantContextMissing: 'Contexto de conta nao encontrado para o usuario atual.',
    templateContentRequired: 'Conteudo do template e obrigatorio.',
    imageOrSourceRequired: 'Envie ao menos uma imagem valida ou texto-fonte extraido.',
    maxImagesExceeded: 'Voce pode enviar no maximo 6 imagens por extracao.',
    aiReturnedNoContent: 'A IA nao retornou conteudo do template.',
    unexpectedExtractionError: 'Erro inesperado ao extrair dados do template.',
  },
  en: {
    methodNotAllowed: 'Method not allowed',
    supabaseNotConfigured: 'Supabase environment is not configured',
    anthropicNotConfigured: 'ANTHROPIC_API_KEY is not configured',
    serviceRoleNotConfigured: 'SUPABASE_SERVICE_ROLE_KEY is not configured',
    missingAuthorization: 'Missing Authorization header',
    invalidAuthToken: 'Invalid authentication token',
    tenantContextMissing: 'Tenant context was not found for the current user.',
    templateContentRequired: 'Template content is required.',
    imageOrSourceRequired: 'Send at least one valid image or extracted source text.',
    maxImagesExceeded: 'You can send up to 6 images per extraction.',
    aiReturnedNoContent: 'AI did not return template content.',
    unexpectedExtractionError: 'Unexpected error while extracting template data.',
  },
} as const

function resolveRequestLanguage(req: Request, requestedLanguage?: unknown): SupportedLanguage {
  const bodyLanguage = String(requestedLanguage ?? '').trim().toLowerCase()
  if (bodyLanguage.startsWith('en')) return 'en'
  if (bodyLanguage.startsWith('pt')) return 'pt'

  const acceptLanguage = String(req.headers.get('Accept-Language') || '').toLowerCase()
  if (acceptLanguage.includes('pt')) return 'pt'
  if (acceptLanguage.includes('en')) return 'en'
  return 'en'
}

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

async function ensureAiPlanAccess(adminClient: any, tenantId: string, language: SupportedLanguage) {
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
      message: AI_PLAN_MESSAGES[language].blockedByPlan,
      messageKey: AI_PLAN_ERROR_KEYS.blockedByPlan,
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
      message: AI_PLAN_MESSAGES[language].tokenLimitReached,
      messageKey: AI_PLAN_ERROR_KEYS.tokenLimitReached,
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

function safeText(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) return []

  const next: string[] = []
  for (const item of value) {
    const warning = safeText(item, 200)
    if (!warning) continue
    next.push(warning)
    if (next.length >= 8) break
  }

  return next
}

function normalizeReplacements(value: unknown) {
  if (!Array.isArray(value)) return []

  const next: string[] = []
  for (const item of value) {
    const replacement = safeText(item, 220)
    if (!replacement) continue
    next.push(replacement)
    if (next.length >= 12) break
  }

  return next
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plainTextToHtml(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  const paragraphs = normalized.split(/\n{2,}/)
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

function normalizeModelTextOutput(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const codeBlockMatch = trimmed.match(/```(?:html|json|text)?\s*([\s\S]*?)\s*```/i)
  return (codeBlockMatch ? codeBlockMatch[1] : trimmed).trim()
}

function stripContentEnvelopeHeuristic(text: string): string {
  let next = text.trim()
  if (!next) return ''

  next = next
    .replace(/^```(?:json|html|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  if (!/^\{\s*"content"\s*:\s*"/s.test(next)) {
    return next
  }

  next = next
    .replace(/^\{\s*"content"\s*:\s*"/s, '')
    .replace(/"\s*(,\s*"confidence"[\s\S]*|\})\s*$/s, '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()

  return next
}

function unwrapNestedContentCandidate(value: unknown): string {
  let current = String(value ?? '').trim()
  if (!current) return ''

  for (let i = 0; i < 3; i += 1) {
    const normalized = stripContentEnvelopeHeuristic(normalizeModelTextOutput(current))
    const parsed = tryParseJson(normalized)
    if (!parsed) return normalized

    const nested = parsed.content
    if (typeof nested !== 'string') return normalized

    const next = nested.trim()
    if (!next || next === current) return next || normalized
    current = next
  }

  return stripContentEnvelopeHeuristic(normalizeModelTextOutput(current))
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

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidateText = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed

  try {
    const parsed = JSON.parse(candidateText)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return null
  } catch {
    const match = candidateText.match(/\{[\s\S]*\}/)
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

async function extractTemplateWithAnthropicVision(
  anthropicApiKey: string,
  templateContent: string,
  availablePaths: string[],
  images: ParsedImageInput[],
  sourceText?: string,
) {
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6'
  const pathList = availablePaths.slice(0, 220).map((path) => `- ${path}`).join('\n')

  const prompt = [
    'You are a legal-template OCR and tokenization engine.',
    'You may receive photos/images of contract documents and/or extracted text from PDF/DOC/DOCX sources.',
    'You also receive an existing HTML contract template that may contain literal names/document numbers and some {{xpath}} tokens.',
    'Your goal is to rewrite the provided template content replacing literal personal data with the best matching {{xpath}} tokens from the allowed path list.',
    '',
    'Input template content (HTML):',
    templateContent,
    '',
    'Extracted text source (when available):',
    sourceText && sourceText.trim()
      ? sourceText.slice(0, 120000)
      : '[No extracted text provided. Use image OCR only.]',
    '',
    'Allowed template paths (source of truth):',
    pathList || '- guest.name\n- guest.documents{1}.number\n- owners{1}.name\n- owners{1}.documents{1}.number\n- contract.startDate\n- contract.endDate\n- properties{1}.name\n- properties{1}.address',
    '',
    'Hard constraints:',
    '- Return ONLY strict JSON',
    '- Keep HTML structure valid and as close as possible to the original template',
    '- Do not remove legal clauses that are unrelated to extracted identity/property/contract data',
    '- Never invent new xpaths; use only allowed paths',
    '- If you are not confident about a replacement, keep original text and add a warning',
    '- Prefer replacing names and document numbers first (guest/owners)',
    '- Also replace other fields when clearly mapped (address, dates, amounts, property name)',
    '- Preserve existing {{xpath}} tokens already present unless they are clearly wrong and confidently replaceable by an allowed path',
    '',
    'Required JSON shape:',
    '{',
    '  "content": string,',
    '  "confidence": number,',
    '  "warnings": string[],',
    '  "replacements": string[]',
    '}',
    '',
    'replacements should be short lines like:',
    '- "Joao Silva -> {{guest.name}}"',
    '- "CPF 000.000.000-00 -> {{guest.documents{1}.number}}"',
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
      max_tokens: 3000,
      temperature: 0,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`AI template extraction failed: ${detail}`)
  }

  const payload = await response.json()
  const text = Array.isArray(payload?.content)
    ? payload.content
      .filter((item: any) => item?.type === 'text')
      .map((item: any) => String(item?.text || ''))
      .join('\n')
    : ''

  const parsed = tryParseJson(text)
  let parsedPayload = parsed
  if (!parsedPayload) {
    const normalizedText = normalizeModelTextOutput(text)
    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(normalizedText)
    const fallbackContent = looksLikeHtml
      ? normalizedText
      : (plainTextToHtml(normalizedText) || templateContent)

    parsedPayload = {
      content: fallbackContent,
      confidence: 0.45,
      warnings: [],
      replacements: [],
    }
  }

  return {
    parsed: parsedPayload,
    model,
    inputTokens: Number(payload?.usage?.input_tokens ?? 0),
    outputTokens: Number(payload?.usage?.output_tokens ?? 0),
  }
}

Deno.serve(async (req: Request) => {
  try {
    let requestLanguage = resolveRequestLanguage(req)

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: ERROR_MESSAGES.en.methodNotAllowed, errorKey: ERROR_KEYS.methodNotAllowed }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: ERROR_MESSAGES.en.supabaseNotConfigured, errorKey: ERROR_KEYS.supabaseNotConfigured }, 500)
    if (!anthropicApiKey) return jsonResponse({ error: ERROR_MESSAGES.en.anthropicNotConfigured, errorKey: ERROR_KEYS.anthropicNotConfigured }, 500)
    if (!supabaseServiceRoleKey) return jsonResponse({ error: ERROR_MESSAGES.en.serviceRoleNotConfigured, errorKey: ERROR_KEYS.serviceRoleNotConfigured }, 500)

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: ERROR_MESSAGES.en.missingAuthorization, errorKey: ERROR_KEYS.missingAuthorization }, 401)

    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user) return jsonResponse({ error: ERROR_MESSAGES.en.invalidAuthToken, errorKey: ERROR_KEYS.invalidAuthToken }, 401)

    const authUserId = userData.user.id
    const body = await req.json().catch(() => ({})) as {
      templateContent?: string
      availablePaths?: string[]
      images?: string[]
      sourceText?: string
      language?: string
    }
    requestLanguage = resolveRequestLanguage(req, body?.language)

    const tenantContext = await resolveTenantContext(adminClient, authUserId)
    if (!tenantContext.tenantId) return jsonResponse({ error: ERROR_MESSAGES.en.tenantContextMissing, errorKey: ERROR_KEYS.tenantContextMissing }, 400)

    const aiPlanAccess = await ensureAiPlanAccess(adminClient, tenantContext.tenantId, requestLanguage)
    if (!aiPlanAccess.allowed) {
      return jsonResponse({ error: aiPlanAccess.message, errorKey: aiPlanAccess.messageKey, code: aiPlanAccess.reason || 'ai_access_denied', planCode: aiPlanAccess.planCode }, 403)
    }

    const templateContent = safeText(body.templateContent, 50000)
    const availablePaths = Array.isArray(body.availablePaths)
      ? body.availablePaths.map((path) => safeText(path, 160)).filter(Boolean)
      : []
    const rawImages = Array.isArray(body.images) ? body.images : []
    const images = rawImages.map(parseDataUrl).filter(Boolean) as ParsedImageInput[]
    const sourceText = safeText(body.sourceText, 120000)

    if (!templateContent) return jsonResponse({ error: ERROR_MESSAGES.en.templateContentRequired, errorKey: ERROR_KEYS.templateContentRequired }, 400)
    if (images.length === 0 && !sourceText) return jsonResponse({ error: ERROR_MESSAGES.en.imageOrSourceRequired, errorKey: ERROR_KEYS.imageOrSourceRequired }, 400)
    if (images.length > 6) return jsonResponse({ error: ERROR_MESSAGES.en.maxImagesExceeded, errorKey: ERROR_KEYS.maxImagesExceeded }, 400)

    const aiResponse = await extractTemplateWithAnthropicVision(
      anthropicApiKey,
      templateContent,
      availablePaths,
      images,
      sourceText,
    )
    const aiResult = aiResponse.parsed

    const content = safeText(unwrapNestedContentCandidate(aiResult.content), 50000)
    const confidenceRaw = Number(aiResult.confidence)
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.6
    const warnings = normalizeWarnings(aiResult.warnings)
    const replacements = normalizeReplacements(aiResult.replacements)

    if (!content) {
      return jsonResponse({ error: ERROR_MESSAGES.en.aiReturnedNoContent, errorKey: ERROR_KEYS.aiReturnedNoContent }, 500)
    }

    const costUsd = estimateCost(aiResponse.model, aiResponse.inputTokens, aiResponse.outputTokens)
    if (tenantContext.tenantId) {
      adminClient.from('ai_usage_logs').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantContext.tenantId,
        auth_user_id: authUserId,
        user_login: tenantContext.userLogin,
        model: aiResponse.model,
        question_chars: templateContent.length + sourceText.length,
        input_tokens: aiResponse.inputTokens,
        output_tokens: aiResponse.outputTokens,
        total_tokens: aiResponse.inputTokens + aiResponse.outputTokens,
        estimated_cost_usd: costUsd,
      }).then(({ error }: any) => {
        if (error) console.warn('ai_usage_logs insert failed:', error.message)
      })
    }

    return jsonResponse({ content, confidence, warnings, replacements, model: aiResponse.model })
  } catch (error) {
    const requestLanguage = resolveRequestLanguage(req)
    const message = error instanceof Error ? error.message : ERROR_MESSAGES[requestLanguage].unexpectedExtractionError
    return jsonResponse({ error: message, errorKey: ERROR_KEYS.unexpectedError }, 500)
  }
})
