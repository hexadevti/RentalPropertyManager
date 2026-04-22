import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type DeliveryRow = {
  id: string
  tenant_id: string
  channel: 'email' | 'sms' | 'whatsapp'
  recipient_destination: string
  recipient_login: string | null
  subject: string | null
  message_body: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}

type MasterTemplateRow = {
  tenant_id: string
  channel: 'email' | 'sms' | 'whatsapp'
  header_content: string
  footer_content: string
}

type DispatchResult = {
  success: boolean
  provider: string
  providerMessageId?: string
  error?: string
}

function getByPath(obj: unknown, path: string): string {
  const parts = path.trim().split('.')
  let cursor: unknown = obj
  for (const part of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return ''
    cursor = (cursor as Record<string, unknown>)[part]
  }
  if (cursor === null || cursor === undefined) return ''
  if (typeof cursor === 'object') return JSON.stringify(cursor)
  return String(cursor)
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    // accept both prefixed (notification.task.title) and unprefixed (task.title)
    const direct = getByPath(context, path)
    if (direct !== '') return direct
    // try stripping a leading "notification." prefix for backward compat
    if (path.startsWith('notification.')) {
      return getByPath(context, path.slice('notification.'.length))
    }
    return ''
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + (minutes * 60 * 1000))
}

function retryBackoffMinutes(attemptNumber: number) {
  const step = Math.max(1, attemptNumber)
  return Math.min(60, 2 ** step)
}

function getForcedEmailDestination() {
  const value = Deno.env.get('NOTIFICATION_FORCE_EMAIL_TO')
  const normalized = value ? value.trim() : ''
  return normalized.length > 0 ? normalized : null
}

function toForcedEmailDelivery(delivery: DeliveryRow, forcedEmail: string): DeliveryRow {
  const metadata = [
    '<hr />',
    '<p><strong>Forced delivery mode:</strong> NOTIFICATION_FORCE_EMAIL_TO is enabled.</p>',
    `<p><strong>Original channel:</strong> ${delivery.channel}</p>`,
    `<p><strong>Original destination:</strong> ${delivery.recipient_destination}</p>`,
    delivery.recipient_login ? `<p><strong>Original recipient login:</strong> ${delivery.recipient_login}</p>` : '',
  ].filter(Boolean).join('')

  return {
    ...delivery,
    channel: 'email',
    recipient_destination: forcedEmail,
    subject: delivery.subject || `Notification (${delivery.channel})`,
    message_body: `${delivery.message_body}${metadata}`,
  }
}

function applyMasterTemplate(delivery: DeliveryRow, masterTemplate: MasterTemplateRow | null): DeliveryRow {
  if (!masterTemplate) return delivery

  const header = masterTemplate.header_content || ''
  const footer = masterTemplate.footer_content || ''

  if (!header && !footer) return delivery

  return {
    ...delivery,
    message_body: `${header}${delivery.message_body}${footer}`,
  }
}

async function sendEmail(delivery: DeliveryRow): Promise<DispatchResult> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')

  if (!resendKey || !resendFrom) {
    return {
      success: false,
      provider: 'resend',
      error: 'Email provider not configured (RESEND_API_KEY/RESEND_FROM_EMAIL)',
    }
  }

  const payload = {
    from: resendFrom,
    to: [delivery.recipient_destination],
    subject: delivery.subject || 'Notification',
    html: delivery.message_body,
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const bodyText = await response.text()
  let bodyData: any = null
  try {
    bodyData = bodyText ? JSON.parse(bodyText) : null
  } catch {
    bodyData = { raw: bodyText }
  }

  if (!response.ok) {
    return {
      success: false,
      provider: 'resend',
      error: bodyData?.message || bodyData?.error || 'Email provider request failed',
    }
  }

  return {
    success: true,
    provider: 'resend',
    providerMessageId: bodyData?.id,
  }
}

async function sendViaWebhook(delivery: DeliveryRow, webhookUrlEnv: string, tokenEnv: string, providerName: string): Promise<DispatchResult> {
  const webhookUrl = Deno.env.get(webhookUrlEnv)
  const token = Deno.env.get(tokenEnv)

  if (!webhookUrl) {
    return {
      success: false,
      provider: providerName,
      error: `${providerName} webhook not configured (${webhookUrlEnv})`,
    }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      deliveryId: delivery.id,
      tenantId: delivery.tenant_id,
      channel: delivery.channel,
      to: delivery.recipient_destination,
      subject: delivery.subject,
      message: delivery.message_body,
      payload: delivery.payload,
    }),
  })

  const bodyText = await response.text()
  let bodyData: any = null
  try {
    bodyData = bodyText ? JSON.parse(bodyText) : null
  } catch {
    bodyData = { raw: bodyText }
  }

  if (!response.ok) {
    return {
      success: false,
      provider: providerName,
      error: bodyData?.message || bodyData?.error || `${providerName} webhook request failed`,
    }
  }

  return {
    success: true,
    provider: providerName,
    providerMessageId: bodyData?.id || bodyData?.messageId || undefined,
  }
}

function applyTemplateVars(delivery: DeliveryRow): DeliveryRow {
  const ctx = (delivery.payload || {}) as Record<string, unknown>
  return {
    ...delivery,
    subject: delivery.subject ? renderTemplate(delivery.subject, ctx) : delivery.subject,
    message_body: renderTemplate(delivery.message_body, ctx),
  }
}

function prepareDeliveryForDispatch(delivery: DeliveryRow, masterTemplate: MasterTemplateRow | null): DeliveryRow {
  const withMaster = applyMasterTemplate(delivery, masterTemplate)
  return applyTemplateVars(withMaster)
}

async function dispatchByChannel(delivery: DeliveryRow): Promise<DispatchResult> {
  const forcedEmail = getForcedEmailDestination()
  if (forcedEmail) {
    return sendEmail(toForcedEmailDelivery(delivery, forcedEmail))
  }

  if (delivery.channel === 'email') {
    return sendEmail(delivery)
  }

  if (delivery.channel === 'sms') {
    return sendViaWebhook(delivery, 'SMS_WEBHOOK_URL', 'SMS_WEBHOOK_TOKEN', 'sms-webhook')
  }

  return sendViaWebhook(delivery, 'WHATSAPP_WEBHOOK_URL', 'WHATSAPP_WEBHOOK_TOKEN', 'whatsapp-webhook')
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    }

    const expectedSecret = Deno.env.get('NOTIFICATION_DISPATCH_SECRET')
    if (expectedSecret) {
      const providedSecret = req.headers.get('x-dispatch-secret') || ''
      if (providedSecret !== expectedSecret) {
        return jsonResponse({ error: 'Invalid dispatch secret' }, 401)
      }
    }

    const body = await req.json().catch(() => ({})) as { limit?: number; tenantId?: string; dryRun?: boolean }
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 200)
    const tenantId = typeof body.tenantId === 'string' && body.tenantId.length > 0 ? body.tenantId : null
    const dryRun = body.dryRun === true

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    let query = adminClient
      .from('notification_deliveries')
      .select('id, tenant_id, channel, recipient_destination, recipient_login, subject, message_body, payload, attempts, max_attempts')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(limit)

    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    const { data: pendingRows, error: pendingError } = await query
    if (pendingError) {
      return jsonResponse({ error: pendingError.message }, 500)
    }

    const deliveries = (pendingRows || []) as DeliveryRow[]
    if (deliveries.length === 0) {
      return jsonResponse({ processed: 0, sent: 0, failed: 0, retried: 0, skipped: 0 })
    }

    let sent = 0
    let failed = 0
    let retried = 0
    let skipped = 0

    const masterTemplateCache = new Map<string, MasterTemplateRow | null>()

    for (const delivery of deliveries) {
      const attemptNumber = delivery.attempts + 1

      const { data: lockRow, error: lockError } = await adminClient
        .from('notification_deliveries')
        .update({ status: 'processing', attempts: attemptNumber })
        .eq('id', delivery.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (lockError) {
        failed += 1
        continue
      }

      if (!lockRow) {
        skipped += 1
        continue
      }

      if (dryRun) {
        await adminClient
          .from('notification_deliveries')
          .update({
            status: 'pending',
            next_attempt_at: addMinutes(new Date(), 1).toISOString(),
            last_error: null,
          })
          .eq('id', delivery.id)
        skipped += 1
        continue
      }

      const masterKey = `${delivery.tenant_id}:${delivery.channel}`
      if (!masterTemplateCache.has(masterKey)) {
        const { data: masterRow, error: masterError } = await adminClient
          .from('notification_master_templates')
          .select('tenant_id, channel, header_content, footer_content')
          .eq('tenant_id', delivery.tenant_id)
          .eq('channel', delivery.channel)
          .maybeSingle()

        if (masterError) {
          console.warn('Failed to load notification master template', {
            tenantId: delivery.tenant_id,
            channel: delivery.channel,
            error: masterError.message,
          })
        }

        masterTemplateCache.set(masterKey, (masterRow || null) as MasterTemplateRow | null)
      }

      const preparedDelivery = prepareDeliveryForDispatch(delivery, masterTemplateCache.get(masterKey) || null)
      const result = await dispatchByChannel(preparedDelivery)

      if (result.success) {
        const { error: updateSentError } = await adminClient
          .from('notification_deliveries')
          .update({
            status: 'sent',
            subject: preparedDelivery.subject,
            message_body: preparedDelivery.message_body,
            provider: result.provider,
            provider_message_id: result.providerMessageId || null,
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', delivery.id)

        if (updateSentError) {
          failed += 1
        } else {
          sent += 1
        }
        continue
      }

      if (attemptNumber >= delivery.max_attempts) {
        await adminClient
          .from('notification_deliveries')
          .update({
            status: 'failed',
            subject: preparedDelivery.subject,
            message_body: preparedDelivery.message_body,
            provider: result.provider,
            last_error: result.error || 'Delivery failed',
          })
          .eq('id', delivery.id)
        failed += 1
        continue
      }

      const nextAttemptAt = addMinutes(new Date(), retryBackoffMinutes(attemptNumber)).toISOString()
      await adminClient
        .from('notification_deliveries')
        .update({
          status: 'pending',
          subject: preparedDelivery.subject,
          message_body: preparedDelivery.message_body,
          provider: result.provider,
          last_error: result.error || 'Delivery failed',
          next_attempt_at: nextAttemptAt,
        })
        .eq('id', delivery.id)
      retried += 1
    }

    return jsonResponse({
      processed: deliveries.length,
      sent,
      failed,
      retried,
      skipped,
      dryRun,
    })
  } catch (error) {
    console.error('dispatch-notifications unexpected error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected Edge Function error' }, 500)
  }
})
