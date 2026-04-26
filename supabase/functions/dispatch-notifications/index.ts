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
  content_type: 'html' | 'text'
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
  let cursor: unknown = obj
  for (const segment of path.trim().split('.')) {
    if (!segment || cursor === null || cursor === undefined) return ''

    const arrayMatch = segment.match(/^(.*)\{(\d+)\}$/)
    if (arrayMatch) {
      const [, key, position] = arrayMatch
      const keyedValue = key ? (cursor as Record<string, unknown>)[key] : cursor
      if (!Array.isArray(keyedValue)) return ''
      cursor = keyedValue[Number(position) - 1]
      continue
    }

    if (typeof cursor !== 'object') return ''
    cursor = (cursor as Record<string, unknown>)[segment]
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function textToHtml(value: string): string {
  const escaped = escapeHtml(value)
  return `<div style="white-space:pre-wrap;">${escaped.replaceAll('\n', '<br />')}</div>`
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
    content_type: 'html',
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
    message_body: delivery.content_type === 'html'
      ? `${header}${delivery.message_body}${footer}`
      : `${stripHtml(header)}\n${delivery.message_body}\n${stripHtml(footer)}`.trim(),
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
    html: 'rendered_message_html' in delivery ? delivery.rendered_message_html : delivery.message_body,
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
      message: 'rendered_message_text' in delivery ? delivery.rendered_message_text : stripHtml(delivery.message_body),
      html: 'rendered_message_html' in delivery ? delivery.rendered_message_html : textToHtml(stripHtml(delivery.message_body)),
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

type PreparedDelivery = DeliveryRow & {
  rendered_subject: string | null
  rendered_message_html: string
  rendered_message_text: string
}

function prepareDeliveryForDispatch(delivery: DeliveryRow, masterTemplate: MasterTemplateRow | null): PreparedDelivery {
  const withMaster = applyMasterTemplate(delivery, masterTemplate)
  const rendered = applyTemplateVars(withMaster)
  const renderedText = rendered.content_type === 'html'
    ? stripHtml(rendered.message_body)
    : rendered.message_body
  const renderedHtml = rendered.content_type === 'html'
    ? rendered.message_body
    : textToHtml(rendered.message_body)

  return {
    ...rendered,
    rendered_subject: rendered.subject || null,
    rendered_message_html: renderedHtml,
    rendered_message_text: renderedText,
  }
}

// ── WhatsApp — provider priority: Evolution API → Twilio → Webhook ────────────
//
// Evolution API (recommended for WhatsApp Business on your phone):
//   WHATSAPP_EVOLUTION_URL       — e.g. https://your-server.railway.app
//   WHATSAPP_EVOLUTION_API_KEY   — API key defined in your Evolution API instance
//   WHATSAPP_EVOLUTION_INSTANCE  — instance name created in Evolution API
//
// Twilio (alternative):
//   TWILIO_ACCOUNT_SID      — Account SID from twilio.com/console
//   TWILIO_AUTH_TOKEN       — Auth Token from twilio.com/console
//   TWILIO_WHATSAPP_FROM    — Sender number, e.g. "whatsapp:+14155238886"
//
// Generic webhook fallback:
//   WHATSAPP_WEBHOOK_URL / WHATSAPP_WEBHOOK_TOKEN

const WHATSAPP_MAX_TEXT_LENGTH = 4096

function normalizeWhatsAppNumber(raw: string): string {
  // Strip everything except digits — Evolution API and Twilio both accept bare digits
  return raw.replace(/[^\d]/g, '')
}

// ── Evolution API ─────────────────────────────────────────────────────────────

async function sendViaEvolution(delivery: PreparedDelivery): Promise<DispatchResult> {
  const baseUrl = Deno.env.get('WHATSAPP_EVOLUTION_URL')?.replace(/\/$/, '')
  const apiKey = Deno.env.get('WHATSAPP_EVOLUTION_API_KEY')
  const instance = Deno.env.get('WHATSAPP_EVOLUTION_INSTANCE')

  if (!baseUrl || !apiKey || !instance) {
    return { success: false, provider: 'evolution', error: 'Evolution API not configured' }
  }

  const number = normalizeWhatsAppNumber(delivery.recipient_destination)
  if (!number || number.length < 7) {
    return { success: false, provider: 'evolution', error: `Invalid WhatsApp number: ${delivery.recipient_destination}` }
  }

  const text = delivery.rendered_message_text.slice(0, WHATSAPP_MAX_TEXT_LENGTH)

  const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({ number, text }),
  })

  const responseText = await response.text()
  let responseData: any = null
  try { responseData = responseText ? JSON.parse(responseText) : null } catch { responseData = { raw: responseText } }

  if (!response.ok) {
    const error = responseData?.message || responseData?.error || `Evolution API error ${response.status}`
    return { success: false, provider: 'evolution', error }
  }

  return {
    success: true,
    provider: 'evolution',
    providerMessageId: responseData?.key?.id ?? responseData?.messageId ?? undefined,
  }
}

// ── Twilio ────────────────────────────────────────────────────────────────────

async function sendViaTwilio(delivery: PreparedDelivery): Promise<DispatchResult> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM')

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, provider: 'twilio-whatsapp', error: 'Twilio not configured' }
  }

  const toDigits = normalizeWhatsAppNumber(delivery.recipient_destination)
  if (!toDigits || toDigits.length < 7) {
    return { success: false, provider: 'twilio-whatsapp', error: `Invalid WhatsApp number: ${delivery.recipient_destination}` }
  }

  const to = `whatsapp:+${toDigits}`
  const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`
  const body = delivery.rendered_message_text.slice(0, 1600)

  const credentials = btoa(`${accountSid}:${authToken}`)
  const formBody = new URLSearchParams({ From: from, To: to, Body: body })

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    }
  )

  const responseText = await response.text()
  let responseData: any = null
  try { responseData = responseText ? JSON.parse(responseText) : null } catch { responseData = { raw: responseText } }

  if (!response.ok) {
    const error = responseData?.message || responseData?.error_message || `Twilio error ${response.status}`
    return { success: false, provider: 'twilio-whatsapp', error }
  }

  return { success: true, provider: 'twilio-whatsapp', providerMessageId: responseData?.sid }
}

// ── WhatsApp dispatcher — tries providers in priority order ───────────────────

async function sendWhatsApp(delivery: PreparedDelivery): Promise<DispatchResult> {
  const hasEvolution = Deno.env.get('WHATSAPP_EVOLUTION_URL') &&
                       Deno.env.get('WHATSAPP_EVOLUTION_API_KEY') &&
                       Deno.env.get('WHATSAPP_EVOLUTION_INSTANCE')

  const hasTwilio = Deno.env.get('TWILIO_ACCOUNT_SID') &&
                    Deno.env.get('TWILIO_AUTH_TOKEN') &&
                    Deno.env.get('TWILIO_WHATSAPP_FROM')

  if (hasEvolution) return sendViaEvolution(delivery)
  if (hasTwilio)    return sendViaTwilio(delivery)
  return sendViaWebhook(delivery, 'WHATSAPP_WEBHOOK_URL', 'WHATSAPP_WEBHOOK_TOKEN', 'whatsapp-webhook')
}

// ── Channel dispatcher ────────────────────────────────────────────────────────

async function dispatchByChannel(delivery: PreparedDelivery): Promise<DispatchResult> {
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

  return sendWhatsApp(delivery)
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
      .select('id, tenant_id, channel, content_type, recipient_destination, recipient_login, subject, message_body, payload, attempts, max_attempts')
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
            subject: preparedDelivery.rendered_subject,
            message_body: preparedDelivery.channel === 'email'
              ? preparedDelivery.rendered_message_html
              : preparedDelivery.rendered_message_text,
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
            subject: preparedDelivery.rendered_subject,
            message_body: preparedDelivery.channel === 'email'
              ? preparedDelivery.rendered_message_html
              : preparedDelivery.rendered_message_text,
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
          subject: preparedDelivery.rendered_subject,
          message_body: preparedDelivery.channel === 'email'
            ? preparedDelivery.rendered_message_html
            : preparedDelivery.rendered_message_text,
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
