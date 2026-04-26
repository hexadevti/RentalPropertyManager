import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ERROR_KEYS = {
  methodNotAllowed: 'edge_method_not_allowed',
  supabaseNotConfigured: 'edge_supabase_not_configured',
  emailProviderNotConfigured: 'edge_email_provider_not_configured',
  missingAuthorization: 'edge_missing_authorization',
  tenantRequired: 'contact_admins_tenant_required',
  subjectRequired: 'contact_admins_subject_required',
  descriptionRequired: 'contact_admins_description_required',
  subjectTooLong: 'contact_admins_subject_too_long',
  descriptionTooLong: 'contact_admins_description_too_long',
  unauthorized: 'edge_unauthorized',
  forbidden: 'edge_forbidden',
  loadAdminsFailed: 'contact_admins_load_admins_failed',
  noAdminEmail: 'contact_admins_no_admin_email',
  sendEmailFailed: 'contact_admins_send_email_failed',
  unexpectedError: 'edge_unexpected_error',
} as const

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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getForcedEmailDestination() {
  const value = Deno.env.get('NOTIFICATION_FORCE_EMAIL_TO')
  const normalized = value ? value.trim().toLowerCase() : ''
  return normalized.length > 0 ? normalized : null
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed', errorKey: ERROR_KEYS.methodNotAllowed }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured', errorKey: ERROR_KEYS.supabaseNotConfigured }, 500)
    }

    if (!resendKey || !resendFrom) {
      return jsonResponse({ error: 'Email provider is not configured', errorKey: ERROR_KEYS.emailProviderNotConfigured }, 500)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonResponse({ error: 'Missing Authorization header', errorKey: ERROR_KEYS.missingAuthorization }, 401)
    }

    const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()
    const body = await req.json().catch(() => null) as {
      tenantId?: string
      subject?: string
      description?: string
      senderLogin?: string
      senderEmail?: string | null
      currentUrl?: string
    } | null

    const tenantId = String(body?.tenantId || '').trim()
    const subject = String(body?.subject || '').trim()
    const description = String(body?.description || '').trim()
    const senderLogin = String(body?.senderLogin || '').trim()
    const senderEmail = typeof body?.senderEmail === 'string' ? body.senderEmail.trim() : ''
    const currentUrl = String(body?.currentUrl || '').trim()

    if (!tenantId) return jsonResponse({ error: 'tenantId is required', errorKey: ERROR_KEYS.tenantRequired }, 400)
    if (!subject) return jsonResponse({ error: 'subject is required', errorKey: ERROR_KEYS.subjectRequired }, 400)
    if (!description) return jsonResponse({ error: 'description is required', errorKey: ERROR_KEYS.descriptionRequired }, 400)
    if (subject.length > 140) return jsonResponse({ error: 'subject is too long', errorKey: ERROR_KEYS.subjectTooLong }, 400)
    if (description.length > 5000) return jsonResponse({ error: 'description is too long', errorKey: ERROR_KEYS.descriptionTooLong }, 400)

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
      return jsonResponse({ error: 'Unauthorized', errorKey: ERROR_KEYS.unauthorized }, 401)
    }

    const authUserId = authData.user.id
    const messageId = crypto.randomUUID()
    let storedMessageId: string | null = null
    const { data: ownProfile } = await adminClient
      .from('user_profiles')
      .select('tenant_id')
      .eq('auth_user_id', authUserId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (!ownProfile && !platformAdmin) {
      return jsonResponse({ error: 'Forbidden for the requested tenant', errorKey: ERROR_KEYS.forbidden }, 403)
    }

    const { data: tenantRow } = await adminClient
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()

    const { data: adminRows, error: adminRowsError } = await adminClient
      .from('user_profiles')
      .select('email, github_login')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .eq('status', 'approved')

    if (adminRowsError) {
      console.error('Failed to load tenant administrators', adminRowsError)
      return jsonResponse({ error: 'Failed to load tenant administrators', errorKey: ERROR_KEYS.loadAdminsFailed }, 500)
    }

    const recipientEmails = Array.from(new Set(
      (adminRows || [])
        .map((row) => String(row.email || '').trim().toLowerCase())
        .filter(Boolean)
    ))

    if (recipientEmails.length === 0) {
      return jsonResponse({ error: 'No approved administrator email was found for this tenant', errorKey: ERROR_KEYS.noAdminEmail }, 400)
    }

    const { error: insertMessageError } = await adminClient
      .from('contact_messages')
      .insert({
        id: messageId,
        tenant_id: tenantId,
        sender_auth_user_id: authUserId,
        sender_login: senderLogin || authData.user.email || authUserId,
        sender_email: senderEmail || authData.user.email || null,
        subject,
        description,
        current_url: currentUrl || null,
        status: 'open',
      })

    if (insertMessageError) {
      console.warn('Failed to store contact message history', insertMessageError)
    } else {
      storedMessageId = messageId
    }

    const safeSubject = escapeHtml(subject)
    const safeDescription = escapeHtml(description).replaceAll('\n', '<br />')
    const safeSenderLogin = escapeHtml(senderLogin || authData.user.email || authUserId)
    const safeSenderEmail = escapeHtml(senderEmail || authData.user.email || '')
    const safeTenantName = escapeHtml(String(tenantRow?.name || tenantId))
    const safeCurrentUrl = escapeHtml(currentUrl)
    const forcedEmail = getForcedEmailDestination()
    const targetEmails = forcedEmail ? [forcedEmail] : recipientEmails
    const forcedDeliveryMetadata = forcedEmail
      ? [
          '<hr />',
          '<p><strong>Forced delivery mode:</strong> NOTIFICATION_FORCE_EMAIL_TO is enabled.</p>',
          `<p><strong>Forced destination:</strong> ${escapeHtml(forcedEmail)}</p>`,
          `<p><strong>Original administrator recipients:</strong> ${escapeHtml(recipientEmails.join(', '))}</p>`,
        ].join('')
      : ''

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: targetEmails,
        reply_to: senderEmail || authData.user.email || undefined,
        subject: `[RPM - Rental Property Manager] ${subject}`,
        html: [
          '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">',
          '<h2>New contact request</h2>',
          `<p><strong>Tenant:</strong> ${safeTenantName}</p>`,
          `<p><strong>Sender:</strong> ${safeSenderLogin}</p>`,
          safeSenderEmail ? `<p><strong>Sender email:</strong> ${safeSenderEmail}</p>` : '',
          `<p><strong>Subject:</strong> ${safeSubject}</p>`,
          `<p><strong>Question:</strong><br />${safeDescription}</p>`,
          safeCurrentUrl ? `<p><strong>Current URL:</strong> ${safeCurrentUrl}</p>` : '',
          forcedDeliveryMetadata,
          '</div>',
        ].join(''),
      }),
    })

    const emailText = await emailResponse.text()
    if (!emailResponse.ok) {
      console.error('Failed to send contact email', emailText)
      let providerError = 'Failed to send the email to administrators'
      try {
        const parsed = emailText ? JSON.parse(emailText) : null
        providerError = parsed?.message || parsed?.error || providerError
      } catch {
        if (emailText.trim()) providerError = emailText.trim()
      }
      if (storedMessageId) {
        await adminClient
          .from('contact_messages')
          .update({ delivery_error: providerError })
          .eq('id', storedMessageId)
      }
      return jsonResponse({ error: providerError, errorKey: ERROR_KEYS.sendEmailFailed }, 500)
    }

    if (storedMessageId) {
      await adminClient
        .from('contact_messages')
        .update({
          email_sent_at: new Date().toISOString(),
          delivery_error: null,
        })
        .eq('id', storedMessageId)
    }

    return jsonResponse({
      success: true,
      sentTo: targetEmails.length,
      originalSentTo: recipientEmails.length,
      forcedEmail: forcedEmail || null,
      messageId: storedMessageId ?? messageId,
    })
  } catch (error) {
    console.error('contact-admins unexpected error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error', errorKey: ERROR_KEYS.unexpectedError }, 500)
  }
})
