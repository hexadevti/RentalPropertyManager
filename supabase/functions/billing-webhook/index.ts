import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ERROR_KEYS = {
  methodNotAllowed: 'edge_method_not_allowed',
  supabaseNotConfigured: 'edge_supabase_not_configured',
  invalidRequest: 'billing_webhook_invalid_request',
} as const

function parseStripeSignatureHeader(headerValue: string) {
  const entries = headerValue.split(',').map((s) => s.trim())
  const pairs = entries
    .map((entry) => {
      const idx = entry.indexOf('=')
      if (idx < 0) return null
      return [entry.slice(0, idx), entry.slice(idx + 1)] as const
    })
    .filter((e): e is readonly [string, string] => Boolean(e))
  return {
    timestamp: pairs.find(([k]) => k === 't')?.[1],
    signatures: pairs.filter(([k]) => k === 'v1').map(([, v]) => v),
  }
}

function constantTimeEqualsHex(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return result === 0
}

async function hmacSha256Hex(secret: string, value: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function parseStripeWebhookEvent(req: Request, rawBody: string) {
  const signature = req.headers.get('stripe-signature') || ''
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

  if (!signature) throw new Error('Missing Stripe signature header')
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured')

  const parsed = parseStripeSignatureHeader(signature)
  if (!parsed.timestamp || parsed.signatures.length === 0) throw new Error('Invalid Stripe signature header')

  const timestamp = Number(parsed.timestamp)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid Stripe signature timestamp')

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestamp) > 5 * 60) throw new Error('Stripe signature timestamp outside tolerance')

  const expected = await hmacSha256Hex(webhookSecret, `${parsed.timestamp}.${rawBody}`)
  const isValid = parsed.signatures.some((s) => constantTimeEqualsHex(s, expected))
  if (!isValid) throw new Error('Stripe signature verification failed')

  const event = JSON.parse(rawBody) as Record<string, unknown>
  const eventId = String(event.id || '')
  const eventType = String(event.type || '')
  if (!eventId || !eventType) throw new Error('Invalid Stripe webhook payload')

  return { provider: 'stripe' as const, eventId, eventType, payload: event }
}

type StripeEventDataObject = {
  id?: string
  metadata?: Record<string, unknown>
  status?: string
  customer?: string
  subscription?: string
  current_period_end?: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function resolvePlanCodeFromMetadata(metadata: Record<string, unknown> | undefined) {
  const planCode = String(metadata?.plan_code || '').trim().toLowerCase()
  if (planCode === 'professional' || planCode === 'enterprise' || planCode === 'starter') {
    return planCode
  }
  return null
}

async function resolveSubscriptionPlanCodeFromStripe(subscriptionId: string) {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecretKey) return null

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  })

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload) return null

  const metadata = asRecord(payload.metadata)
  const fromMetadata = resolvePlanCodeFromMetadata(metadata || undefined)
  if (fromMetadata) return fromMetadata

  const items = asRecord(payload.items)
  const data = Array.isArray(items?.data) ? items?.data : []
  const firstItem = asRecord(data[0])
  const price = asRecord(firstItem?.price)
  const priceId = String(price?.id || '')

  const planByPriceId: Record<string, string> = {
    [String(Deno.env.get('STRIPE_PRICE_ID_PROFESSIONAL') || '').trim()]: 'professional',
    [String(Deno.env.get('STRIPE_PRICE_ID_ENTERPRISE') || '').trim()]: 'enterprise',
  }

  return planByPriceId[priceId] || null
}

async function upsertBillingAccountFromStripe(adminClient: any, payload: {
  tenantId: string
  providerCustomerId?: string | null
  providerSubscriptionId?: string | null
  subscriptionStatus?: string | null
  activePlanCode?: string | null
  currentPeriodEnd?: string | null
  metadata?: Record<string, unknown>
}) {
  const { error } = await adminClient
    .from('billing_accounts')
    .upsert({
      tenant_id: payload.tenantId,
      provider: 'stripe',
      provider_customer_id: payload.providerCustomerId || null,
      provider_subscription_id: payload.providerSubscriptionId || null,
      subscription_status: payload.subscriptionStatus || null,
      active_plan_code: payload.activePlanCode || null,
      current_period_end: payload.currentPeriodEnd || null,
      metadata: payload.metadata || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })

  if (error) throw error
}

async function syncTenantPlan(adminClient: any, tenantId: string, planCode: string, notes: string) {
  const { error } = await adminClient
    .from('tenant_usage_plans')
    .upsert({
      tenant_id: tenantId,
      plan_code: planCode,
      notes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })

  if (error) throw error
}

async function markCheckoutSessionCompleted(adminClient: any, providerSessionId: string) {
  const { error } = await adminClient
    .from('billing_checkout_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('provider', 'stripe')
    .eq('provider_session_id', providerSessionId)

  if (error) {
    console.warn('Failed to mark checkout session as completed', error)
  }
}

async function applyStripeEvent(adminClient: any, eventType: string, eventPayload: Record<string, unknown>) {
  const data = asRecord(eventPayload.data)
  const object = asRecord(data?.object) as StripeEventDataObject | null
  if (!object) return

  const metadata = object.metadata || {}
  let tenantId = String(metadata.tenant_id || '').trim()

  if (!tenantId && object.subscription) {
    const { data: account } = await adminClient
      .from('billing_accounts')
      .select('tenant_id')
      .eq('provider', 'stripe')
      .eq('provider_subscription_id', object.subscription)
      .maybeSingle()

    tenantId = String(account?.tenant_id || '').trim()
  }

  if (!tenantId) {
    throw new Error('Unable to resolve tenant_id for billing webhook event')
  }

  if (eventType === 'checkout.session.completed') {
    const planCode = resolvePlanCodeFromMetadata(metadata) || 'starter'
    await upsertBillingAccountFromStripe(adminClient, {
      tenantId,
      providerCustomerId: object.customer || null,
      providerSubscriptionId: object.subscription || null,
      subscriptionStatus: 'active',
      activePlanCode: planCode,
      metadata,
    })
    await syncTenantPlan(adminClient, tenantId, planCode, 'Updated by billing webhook checkout.session.completed')
    if (object.id) {
      await markCheckoutSessionCompleted(adminClient, object.id)
    }
    return
  }

  if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
    const subscriptionId = String(object.id || '').trim()
    const subscriptionStatus = String(object.status || '').trim().toLowerCase()
    const planCodeFromMetadata = resolvePlanCodeFromMetadata(metadata)
    const resolvedPlanCode = planCodeFromMetadata || (subscriptionId ? await resolveSubscriptionPlanCodeFromStripe(subscriptionId) : null)
    const activePlanCode = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
      ? (resolvedPlanCode || 'starter')
      : 'starter'

    const currentPeriodEnd = object.current_period_end
      ? new Date(Number(object.current_period_end) * 1000).toISOString()
      : null

    await upsertBillingAccountFromStripe(adminClient, {
      tenantId,
      providerCustomerId: object.customer || null,
      providerSubscriptionId: subscriptionId || object.subscription || null,
      subscriptionStatus,
      activePlanCode,
      currentPeriodEnd,
      metadata,
    })

    await syncTenantPlan(
      adminClient,
      tenantId,
      activePlanCode,
      `Updated by billing webhook ${eventType}`
    )
    return
  }

  if (eventType === 'customer.subscription.deleted') {
    const subscriptionId = String(object.id || object.subscription || '').trim()

    await upsertBillingAccountFromStripe(adminClient, {
      tenantId,
      providerCustomerId: object.customer || null,
      providerSubscriptionId: subscriptionId || null,
      subscriptionStatus: 'canceled',
      activePlanCode: 'starter',
      metadata,
    })

    await syncTenantPlan(adminClient, tenantId, 'starter', 'Updated by billing webhook customer.subscription.deleted')
    return
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', errorKey: ERROR_KEYS.methodNotAllowed }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured', errorKey: ERROR_KEYS.supabaseNotConfigured }, 500)
    }

    const rawBody = await req.text()
    const normalizedEvent = await parseStripeWebhookEvent(req, rawBody)

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { error: eventInsertError } = await adminClient
      .from('billing_webhook_events')
      .insert({
        provider: normalizedEvent.provider,
        provider_event_id: normalizedEvent.eventId,
        event_type: normalizedEvent.eventType,
        payload: normalizedEvent.payload,
      })

    if (eventInsertError) {
      if (eventInsertError.code === '23505') {
        return jsonResponse({ success: true, duplicated: true })
      }
      throw eventInsertError
    }

    try {
      await applyStripeEvent(adminClient, normalizedEvent.eventType, normalizedEvent.payload)

      await adminClient
        .from('billing_webhook_events')
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq('provider', normalizedEvent.provider)
        .eq('provider_event_id', normalizedEvent.eventId)
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : String(processingError)

      await adminClient
        .from('billing_webhook_events')
        .update({ processed_at: new Date().toISOString(), processing_error: message })
        .eq('provider', normalizedEvent.provider)
        .eq('provider_event_id', normalizedEvent.eventId)

      throw processingError
    }

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('billing-webhook error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error', errorKey: ERROR_KEYS.invalidRequest }, 400)
  }
})
