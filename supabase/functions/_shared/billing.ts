export type BillingProviderCode = 'stripe'

export type BillingCheckoutRequest = {
  tenantId: string
  planCode: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string | null
  customerName?: string | null
  initiatedByAuthUserId?: string | null
}

export type BillingCheckoutResult = {
  provider: BillingProviderCode
  providerSessionId: string
  checkoutUrl: string
  metadata?: Record<string, unknown>
}

export type NormalizedWebhookEvent = {
  provider: BillingProviderCode
  eventId: string
  eventType: string
  payload: Record<string, unknown>
}

export interface BillingProviderAdapter {
  provider: BillingProviderCode
  createCheckoutSession: (input: BillingCheckoutRequest) => Promise<BillingCheckoutResult>
  parseWebhookEvent: (req: Request, rawBody: string) => Promise<NormalizedWebhookEvent>
}

const STRIPE_PROVIDER: BillingProviderCode = 'stripe'

function getStripePlanPriceMap() {
  return {
    professional: Deno.env.get('STRIPE_PRICE_ID_PROFESSIONAL') || '',
    enterprise: Deno.env.get('STRIPE_PRICE_ID_ENTERPRISE') || '',
  }
}

function resolveStripePriceId(planCode: string) {
  const normalized = String(planCode || '').trim().toLowerCase()
  const map = getStripePlanPriceMap() as Record<string, string>
  const priceId = map[normalized] || ''

  if (!priceId) {
    throw new Error(`No Stripe price is configured for plan code: ${normalized}`)
  }

  return priceId
}

function assertStripeSecretKey() {
  const value = Deno.env.get('STRIPE_SECRET_KEY')
  if (!value) throw new Error('STRIPE_SECRET_KEY is not configured')
  return value
}

function toUrlEncodedBody(record: Record<string, string>) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(record)) {
    searchParams.append(key, value)
  }
  return searchParams.toString()
}

function constantTimeEqualsHex(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index++) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parseStripeSignatureHeader(headerValue: string) {
  const entries = headerValue.split(',').map((segment) => segment.trim())
  const pairs = entries
    .map((entry) => {
      const separatorIndex = entry.indexOf('=')
      if (separatorIndex < 0) return null
      return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)] as const
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry))

  const timestamp = pairs.find(([key]) => key === 't')?.[1]
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value)

  return { timestamp, signatures }
}

async function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string, webhookSecret: string) {
  const parsed = parseStripeSignatureHeader(signatureHeader)
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error('Invalid Stripe signature header')
  }

  const timestamp = Number(parsed.timestamp)
  if (!Number.isFinite(timestamp)) {
    throw new Error('Invalid Stripe signature timestamp')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestamp) > 5 * 60) {
    throw new Error('Stripe signature timestamp is outside the tolerance window')
  }

  const expected = await hmacSha256Hex(webhookSecret, `${parsed.timestamp}.${rawBody}`)
  const isValid = parsed.signatures.some((signature) => constantTimeEqualsHex(signature, expected))
  if (!isValid) {
    throw new Error('Stripe signature verification failed')
  }
}

const stripeAdapter: BillingProviderAdapter = {
  provider: STRIPE_PROVIDER,

  async createCheckoutSession(input) {
    const stripeSecretKey = assertStripeSecretKey()
    const priceId = resolveStripePriceId(input.planCode)

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
      provider: STRIPE_PROVIDER,
      providerSessionId: String(payload.id),
      checkoutUrl: String(payload.url),
      metadata: {
        stripeMode: payload.mode,
      },
    }
  },

  async parseWebhookEvent(req, rawBody) {
    const signature = req.headers.get('stripe-signature') || ''
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    if (!signature) {
      throw new Error('Missing Stripe signature header')
    }

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    }

    await verifyStripeWebhookSignature(rawBody, signature, webhookSecret)

    const event = JSON.parse(rawBody) as Record<string, unknown>
    const eventId = String(event.id || '')
    const eventType = String(event.type || '')

    if (!eventId || !eventType) {
      throw new Error('Invalid Stripe webhook payload')
    }

    return {
      provider: STRIPE_PROVIDER,
      eventId,
      eventType,
      payload: event,
    }
  },
}

const providers: Record<BillingProviderCode, BillingProviderAdapter> = {
  stripe: stripeAdapter,
}

export function resolveBillingProvider(code?: string | null) {
  const normalized = String(code || STRIPE_PROVIDER).trim().toLowerCase() as BillingProviderCode
  const provider = providers[normalized]
  if (!provider) {
    throw new Error(`Unsupported billing provider: ${normalized}`)
  }
  return provider
}

export function resolveDefaultBillingProvider() {
  const configured = Deno.env.get('BILLING_PROVIDER')
  return resolveBillingProvider(configured)
}

export function isKnownPaidPlanCode(planCode?: string | null) {
  const normalized = String(planCode || '').trim().toLowerCase()
  return normalized === 'professional' || normalized === 'enterprise'
}
