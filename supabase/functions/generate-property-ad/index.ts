import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { estimateCost } from './helpers.ts'

const STARTER_PLAN_CODE = 'starter'
const AI_PLAN_ERROR_KEYS = {
  tokenLimitReached: 'ai_token_limit_reached',
  blockedByPlan: 'ai_blocked_by_plan',
} as const

const ERROR_KEYS = {
  methodNotAllowed: 'edge_method_not_allowed',
  anthropicNotConfigured: 'edge_anthropic_not_configured',
  anthropicApiError: 'edge_anthropic_api_error',
  supabaseNotConfigured: 'edge_supabase_not_configured',
  missingAuthorization: 'edge_missing_authorization',
  invalidAuthToken: 'edge_invalid_auth_token',
  unexpectedError: 'edge_unexpected_error',
  onlyApprovedAdmins: 'ai_assistant_only_approved_admins',
  tenantContextMissing: 'ai_tenant_context_missing',
  propertyRequired: 'generate_property_property_required',
  generateCopyFailed: 'generate_property_copy_failed',
  parseCopyFailed: 'generate_property_parse_failed',
} as const

const ERROR_FALLBACKS = {
  methodNotAllowed: 'Method not allowed',
  anthropicNotConfigured: 'ANTHROPIC_API_KEY is not configured',
  anthropicApiError: 'AI provider API request failed.',
  supabaseNotConfigured: 'Supabase environment is not configured',
  missingAuthorization: 'Missing Authorization header',
  invalidAuthToken: 'Invalid user token',
  unexpectedError: 'Unexpected edge function error.',
  onlyApprovedAdmins: 'Only approved administrators can use the ad generator',
  tenantContextMissing: 'Tenant context was not found for the current user',
  propertyRequired: 'property is required',
  generateCopyFailed: 'Failed to generate ad copy',
  parseCopyFailed: 'Failed to parse ad copy response',
} as const

const ERROR_MESSAGES = {
  pt: {
    methodNotAllowed: 'Metodo nao permitido',
    anthropicNotConfigured: 'ANTHROPIC_API_KEY nao configurada',
    supabaseNotConfigured: 'Ambiente do Supabase nao configurado',
    missingAuthorization: 'Cabecalho Authorization ausente',
    propertyRequired: 'property e obrigatorio',
    onlyApprovedAdmins: 'Apenas administradores aprovados podem usar o gerador de anuncio',
    tenantContextMissing: 'Contexto de conta nao encontrado para o usuario atual',
    generateCopyFailed: 'Falha ao gerar copia do anuncio',
    parseCopyFailed: 'Falha ao interpretar resposta de copia do anuncio',
  },
  en: {
    methodNotAllowed: 'Method not allowed',
    anthropicNotConfigured: 'ANTHROPIC_API_KEY is not configured',
    supabaseNotConfigured: 'Supabase environment is not configured',
    missingAuthorization: 'Missing Authorization header',
    propertyRequired: 'property is required',
    onlyApprovedAdmins: 'Only approved administrators can use the ad generator',
    tenantContextMissing: 'Tenant context was not found for the current user',
    generateCopyFailed: 'Failed to generate ad copy',
    parseCopyFailed: 'Failed to parse ad copy response',
  },
} as const

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
      message: 'AI features are blocked for the current plan. Change the plan to enable access.',
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
      message: 'Monthly AI token limit reached for the current plan. Upgrade to continue using AI features.',
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

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
])

const DEFAULT_MODEL = 'claude-sonnet-4-6'

type PropertyInput = {
  id: string
  name: string
  type: string
  capacity?: number
  pricePerNight?: number
  pricePerMonth?: number
  address?: string
  city?: string
  conservationState?: string
  environments?: string[]
  furnitureItems?: string[]
  description?: string
  photos?: Array<{ id: string }>
}

type SupportedLanguage = 'pt' | 'en'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function resolveLanguage(language: string | undefined): SupportedLanguage {
  return language === 'pt' ? 'pt' : 'en'
}

function resolveRequestLanguage(req: Request, language: string | undefined): SupportedLanguage {
  const fromBody = resolveLanguage(language)
  if (fromBody === 'pt') return 'pt'

  const acceptLanguage = String(req.headers.get('Accept-Language') || '').toLowerCase()
  if (acceptLanguage.includes('pt')) return 'pt'
  if (acceptLanguage.includes('en')) return 'en'
  return 'en'
}

Deno.serve(async (req) => {
  try {
    let requestLanguage = resolveRequestLanguage(req, undefined)

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: ERROR_FALLBACKS.methodNotAllowed, errorKey: ERROR_KEYS.methodNotAllowed }, 405)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!anthropicApiKey) return jsonResponse({ error: ERROR_FALLBACKS.anthropicNotConfigured, errorKey: ERROR_KEYS.anthropicNotConfigured }, 500)
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: ERROR_FALLBACKS.supabaseNotConfigured, errorKey: ERROR_KEYS.supabaseNotConfigured }, 500)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: ERROR_FALLBACKS.missingAuthorization, errorKey: ERROR_KEYS.missingAuthorization }, 401)
    const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()

    const body = await req.json().catch(() => null)
    requestLanguage = resolveRequestLanguage(req, String(body?.language ?? '').trim())
    const property = (body?.property ?? null) as PropertyInput | null
    const language = requestLanguage
    const ownerContact = String(body?.ownerContact ?? '').trim()
    const hasContactBox = Boolean(body?.hasContactBox)
    const hasPricingBox = Boolean(body?.hasPricingBox)
    const includeContactInAi = body?.includeContactInAi === undefined ? !hasContactBox : Boolean(body?.includeContactInAi)
    const includePricingInAi = body?.includePricingInAi === undefined ? !hasPricingBox : Boolean(body?.includePricingInAi)
    const requestedModel = String(body?.model ?? '').trim()
    const configuredDefaultModel = Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL
    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : configuredDefaultModel

    if (!property?.id || !property?.name) {
      return jsonResponse({ error: ERROR_FALLBACKS.propertyRequired, errorKey: ERROR_KEYS.propertyRequired }, 400)
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser(userJwt)
    if (authError || !authData.user) {
      return jsonResponse({ error: authError?.message ?? ERROR_FALLBACKS.invalidAuthToken, errorKey: authError?.message ? undefined : ERROR_KEYS.invalidAuthToken }, 401)
    }

    const authUserId = authData.user.id
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('tenant_id, role, status, github_login')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (profileError) return jsonResponse({ error: profileError.message }, 500)

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    const isPlatformAdmin = Boolean(platformAdmin)
    const isApprovedTenantAdmin = profile?.role === 'admin' && profile?.status === 'approved'
    if (!isPlatformAdmin && !isApprovedTenantAdmin) {
      return jsonResponse({ error: ERROR_FALLBACKS.onlyApprovedAdmins, errorKey: ERROR_KEYS.onlyApprovedAdmins }, 403)
    }

    let tenantId = profile?.tenant_id as string | undefined
    if (isPlatformAdmin) {
      const { data: sessionTenant } = await adminClient
        .from('platform_admin_session_tenants')
        .select('tenant_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()
      tenantId = sessionTenant?.tenant_id ?? tenantId
    }

    if (!tenantId) return jsonResponse({ error: ERROR_FALLBACKS.tenantContextMissing, errorKey: ERROR_KEYS.tenantContextMissing }, 400)

    const aiPlanAccess = await ensureAiPlanAccess(adminClient, tenantId, language)
    if (!aiPlanAccess.allowed) {
      return jsonResponse({ error: aiPlanAccess.message, errorKey: aiPlanAccess.messageKey, code: aiPlanAccess.reason || 'ai_access_denied', planCode: aiPlanAccess.planCode }, 403)
    }

    const { data: tenantData } = await adminClient
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()
    const tenantName = tenantData?.name ?? 'RPM'

    const promptPayload = {
      tenantName,
      language,
      property: {
        name: property.name,
        type: property.type,
        capacity: property.capacity ?? 0,
        pricePerNight: property.pricePerNight ?? 0,
        pricePerMonth: property.pricePerMonth ?? 0,
        address: property.address ?? '',
        city: property.city ?? '',
        conservationState: property.conservationState ?? '',
        environments: property.environments ?? [],
        furnitureItems: property.furnitureItems ?? [],
        description: property.description ?? '',
        photoCount: property.photos?.length ?? 0,
      },
      ownerContact: ownerContact || null,
      visualStructure: {
        hasContactBox,
        hasPricingBox,
        includeContactInAi,
        includePricingInAi,
      },
    }

    const writingLanguageInstruction = language === 'en'
      ? 'Write in English.'
      : 'Escreva em português brasileiro.'

    const ownerContactInstruction = language === 'en'
      ? 'If ownerContact is provided, you may naturally incorporate it into the CTA or contact-oriented phrasing, but do not invent extra contact details.'
      : 'Se ownerContact vier preenchido, você pode incorporá-lo de forma natural no CTA ou em trechos orientados a contato, sem inventar dados adicionais.'

    const pricingAndContactInstruction = language === 'en'
      ? [
          !includePricingInAi ? 'A dedicated pricing box already exists in the layout, so do not repeat prices, rate tables, pricing summaries, or pricing-focused marketing inside the AI content box.' : '',
          !includeContactInAi ? 'A dedicated contact box already exists in the layout, so do not repeat contact details, direct contact calls, or contact-focused CTA inside the AI content box.' : '',
          !includePricingInAi && !includeContactInAi ? 'Focus the AI content on positioning, lifestyle, location, atmosphere, highlights, and persuasive presentation.' : '',
        ].filter(Boolean).join(' ')
      : [
          !includePricingInAi ? 'Ja existe um quadro exclusivo de valores no layout, entao nao repita precos, tabelas, resumos de valores ou argumentos centrados em preco dentro do quadro de conteudo por IA.' : '',
          !includeContactInAi ? 'Ja existe um quadro exclusivo de contato no layout, entao nao repita dados de contato, chamadas de contato direto ou CTA de contato dentro do quadro de conteudo por IA.' : '',
          !includePricingInAi && !includeContactInAi ? 'Concentre o conteudo de IA em posicionamento, estilo de vida, localizacao, atmosfera, destaques e apresentacao persuasiva.' : '',
        ].filter(Boolean).join(' ')

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        system: [
          'Você é um redator publicitário sênior especializado em anúncios imobiliários premium.',
          writingLanguageInstruction,
          'Seu objetivo é criar um anúncio sofisticado, elegante, confiável e comercialmente forte, sem exageros inverossímeis.',
          'Não invente informações que não estejam no payload.',
          'Use apenas os dados fornecidos.',
          ownerContactInstruction,
          pricingAndContactInstruction,
          'Retorne somente JSON válido, sem markdown.',
          'Formato exato esperado:',
          '{"headline":"","subheadline":"","description":"","highlights":["","",""],"cta":"","toneTag":"","marketingFrames":[{"eyebrow":"","title":"","body":"","style":"accent"}],"sections":{"locationTitle":"","locationBody":"","lifestyleTitle":"","lifestyleBody":"","pricingTitle":"","pricingBody":""}}',
          'marketingFrames deve trazer de 2 a 4 subquadros curtos de marketing que possam ser distribuídos visualmente dentro do bloco principal do anúncio.',
          'Cada marketingFrame deve ser curto, útil e complementar, com style em "accent", "detail" ou "highlight".',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: `Crie um anúncio premium a partir deste payload:\n${JSON.stringify(promptPayload, null, 2)}`,
          },
        ],
      }),
    })

    const responseData = await anthropicResponse.json()
    if (!anthropicResponse.ok) {
      console.error('generate-property-ad anthropic error', responseData)
      return jsonResponse({ error: responseData?.error?.message ?? ERROR_FALLBACKS.generateCopyFailed, errorKey: responseData?.error?.message ? ERROR_KEYS.anthropicApiError : ERROR_KEYS.generateCopyFailed }, 500)
    }

    const text = Array.isArray(responseData?.content)
      ? responseData.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n').trim()
      : ''

    const parsed = parseJsonObject(text)
    if (!parsed) {
      return jsonResponse({ error: ERROR_FALLBACKS.parseCopyFailed, errorKey: ERROR_KEYS.parseCopyFailed }, 500)
    }
    if (!Array.isArray(parsed.marketingFrames)) {
      parsed.marketingFrames = []
    }

    const inputTokens = responseData?.usage?.input_tokens ?? 0
    const outputTokens = responseData?.usage?.output_tokens ?? 0
    const costUsd = estimateCost(model, inputTokens, outputTokens)

    adminClient.from('ai_usage_logs').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      auth_user_id: authUserId,
      user_login: profile?.github_login ?? '',
      model,
      question_chars: JSON.stringify(promptPayload).length,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      estimated_cost_usd: costUsd,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn('ai_usage_logs insert failed:', error.message)
    })

    return jsonResponse({
      copy: parsed,
      model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd,
      },
    })
  } catch (error) {
    console.error('generate-property-ad unexpected error', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : ERROR_FALLBACKS.unexpectedError,
      errorKey: ERROR_KEYS.unexpectedError,
    }, 500)
  }
})
