import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ERROR_KEYS = {
  methodNotAllowed: 'edge_method_not_allowed',
  supabaseNotConfigured: 'edge_supabase_not_configured',
  missingAuthorization: 'edge_missing_authorization',
  tenantRequired: 'billing_checkout_tenant_required',
  paidPlanRequired: 'billing_checkout_paid_plan_required',
  unauthorized: 'edge_unauthorized',
  onlyAdmins: 'billing_checkout_only_admins',
  unexpectedError: 'edge_unexpected_error',
} as const

const ERROR_FALLBACKS = {
  methodNotAllowed: 'Method not allowed',
  supabaseNotConfigured: 'Supabase environment is not configured',
  missingAuthorization: 'Missing Authorization header',
  tenantRequired: 'tenantId is required',
  paidPlanRequired: 'planCode must be a paid plan (professional or enterprise)',
  unauthorized: 'Unauthorized',
  onlyAdmins: 'Only approved tenant administrators can manage billing',
  unexpectedError: 'Unexpected error',
} as const

function isKnownPaidPlanCode(planCode?: string | null) {
  const normalized = String(planCode || '').trim().toLowerCase()
  return normalized === 'professional' || normalized === 'enterprise'
}

function toUrlEncodedBody(record: Record<string, string>) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(record)) {
    searchParams.append(key, value)
  }
  return searchParams.toString()
}

async function createStripeCheckoutSession(input: {
  tenantId: string
  planCode: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string | null
  customerName?: string | null
  initiatedByAuthUserId?: string | null
}) {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured')

  const priceMap: Record<string, string> = {
    professional: Deno.env.get('STRIPE_PRICE_ID_PROFESSIONAL') || '',
    enterprise: Deno.env.get('STRIPE_PRICE_ID_ENTERPRISE') || '',
  }
  const priceId = priceMap[input.planCode.toLowerCase()] || ''
  if (!priceId) throw new Error(`No Stripe price configured for plan: ${input.planCode}`)

  const body = toUrlEncodedBody({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.tenantId,
    customer_email: input.customerEmail || '',
    allow_promotion_codes: 'true',
    'metadata[tenant_id]': input.tenantId,
    'metadata[plan_code]': input.planCode,
    'metadata[initiated_by_auth_user_id]': input.initiatedByAuthUserId || '',
    'subscription_data[metadata][tenant_id]': input.tenantId,
    'subscription_data[metadata][plan_code]': input.planCode,
    'subscription_data[metadata][initiated_by_auth_user_id]': input.initiatedByAuthUserId || '',
  })

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload?.id || !payload?.url) {
    const message = typeof payload?.error === 'object' && payload?.error
      ? String((payload.error as Record<string, unknown>).message || 'Failed to create Stripe checkout session')
      : 'Failed to create Stripe checkout session'
    throw new Error(message)
  }

  return {
    provider: 'stripe' as const,
    providerSessionId: String(payload.id),
    checkoutUrl: String(payload.url),
    metadata: { stripeMode: payload.mode },
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type CheckoutBody = {
  tenantId?: string
  planCode?: string
  successUrl?: string
  cancelUrl?: string
}

function normalizeUrl(urlValue: string | undefined, fallback: string) {
  const raw = String(urlValue || '').trim()
  if (!raw) return fallback
  try {
    const parsed = new URL(raw)
    return parsed.toString()
  } catch {
    return fallback
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: ERROR_FALLBACKS.methodNotAllowed, errorKey: ERROR_KEYS.methodNotAllowed }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: ERROR_FALLBACKS.supabaseNotConfigured, errorKey: ERROR_KEYS.supabaseNotConfigured }, 500)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonResponse({ error: ERROR_FALLBACKS.missingAuthorization, errorKey: ERROR_KEYS.missingAuthorization }, 401)
    }

    const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()
    const body = await req.json().catch(() => null) as CheckoutBody | null

    const requestedTenantId = String(body?.tenantId || '').trim()
    const requestedPlanCode = String(body?.planCode || '').trim().toLowerCase()

    if (!requestedTenantId) {
      return jsonResponse({ error: ERROR_FALLBACKS.tenantRequired, errorKey: ERROR_KEYS.tenantRequired }, 400)
    }

    if (!isKnownPaidPlanCode(requestedPlanCode)) {
      return jsonResponse({ error: ERROR_FALLBACKS.paidPlanRequired, errorKey: ERROR_KEYS.paidPlanRequired }, 400)
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${userJwt}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse({ error: ERROR_FALLBACKS.unauthorized, errorKey: ERROR_KEYS.unauthorized }, 401)
    }

    const authUserId = authData.user.id

    const { data: ownProfile } = await adminClient
      .from('user_profiles')
      .select('tenant_id, role, status, email, github_login')
      .eq('auth_user_id', authUserId)
      .eq('tenant_id', requestedTenantId)
      .maybeSingle()

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (!platformAdmin) {
      const isAllowedTenantAdmin = ownProfile && ownProfile.status === 'approved' && ownProfile.role === 'admin'
      if (!isAllowedTenantAdmin) {
        return jsonResponse({ error: ERROR_FALLBACKS.onlyAdmins, errorKey: ERROR_KEYS.onlyAdmins }, 403)
      }
    }

    const fallbackAppUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173'
    const successUrl = normalizeUrl(body?.successUrl, `${fallbackAppUrl}/?tab=tenant&billing=success`)
    const cancelUrl = normalizeUrl(body?.cancelUrl, `${fallbackAppUrl}/?tab=tenant&billing=cancelled`)

    const result = await createStripeCheckoutSession({
      tenantId: requestedTenantId,
      planCode: requestedPlanCode,
      successUrl,
      cancelUrl,
      customerEmail: ownProfile?.email || authData.user.email || null,
      customerName: ownProfile?.github_login || authData.user.email || null,
      initiatedByAuthUserId: authUserId,
    })

    const { error: sessionInsertError } = await adminClient
      .from('billing_checkout_sessions')
      .insert({
        tenant_id: requestedTenantId,
        provider: result.provider,
        provider_session_id: result.providerSessionId,
        requested_plan_code: requestedPlanCode,
        initiated_by_auth_user_id: authUserId,
        checkout_url: result.checkoutUrl,
        status: 'created',
        metadata: result.metadata || {},
      })

    if (sessionInsertError) {
      console.warn('Failed to insert billing checkout session', sessionInsertError)
    }

    return jsonResponse({
      success: true,
      provider: result.provider,
      checkoutUrl: result.checkoutUrl,
      providerSessionId: result.providerSessionId,
    })
  } catch (error) {
    console.error('billing-checkout error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : ERROR_FALLBACKS.unexpectedError, errorKey: ERROR_KEYS.unexpectedError }, 500)
  }
})
