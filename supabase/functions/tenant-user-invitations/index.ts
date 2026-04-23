import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SendInviteBody = {
  action: 'send'
  tenantId?: string
  email?: string
  login?: string
  role?: 'admin' | 'guest'
  message?: string
  appBaseUrl?: string
}

type SendPasswordResetBody = {
  action: 'send-password-reset'
  tenantId?: string
  email?: string
  login?: string
  message?: string
  appBaseUrl?: string
}

type ResolveInviteBody = {
  action: 'resolve'
  token?: string
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

function getByPath(obj: unknown, path: string): string {
  let cursor: unknown = obj
  for (const segment of path.trim().split('.')) {
    if (!segment || cursor === null || cursor === undefined) return ''
    if (typeof cursor !== 'object') return ''
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  if (cursor === null || cursor === undefined) return ''
  if (typeof cursor === 'object') return JSON.stringify(cursor)
  return String(cursor)
}

function renderTemplate(template: string, context: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const direct = getByPath(context, path)
    if (direct !== '') return direct
    if (path.startsWith('notification.')) {
      return getByPath(context, path.slice('notification.'.length))
    }
    return ''
  })
}

function formatSaoPauloDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    }

    const body = await req.json().catch(() => null) as SendInviteBody | SendPasswordResetBody | ResolveInviteBody | null
    const action = body?.action

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    if (action === 'resolve') {
      const token = String(body?.token || '').trim()
      if (!token) return jsonResponse({ error: 'token is required' }, 400)

      const { data: invitation, error: invitationError } = await adminClient
        .from('tenant_user_invitations')
        .select('id, tenant_id, email, login, role, message, status, expires_at, invited_profile_id')
        .eq('invitation_token', token)
        .maybeSingle()

      if (invitationError || !invitation) {
        return jsonResponse({ error: 'Invitation not found' }, 404)
      }

      const expiresAt = invitation.expires_at ? new Date(invitation.expires_at).toISOString() : null
      const isExpired = !expiresAt || new Date(expiresAt).getTime() < Date.now()

      if (invitation.status !== 'pending' || isExpired) {
        if (invitation.status === 'pending' && isExpired) {
          await adminClient
            .from('tenant_user_invitations')
            .update({ status: 'expired' })
            .eq('id', invitation.id)
        }
        return jsonResponse({ error: 'Invitation is no longer available' }, 410)
      }

      const { data: tenantRow } = await adminClient
        .from('tenants')
        .select('id, name')
        .eq('id', invitation.tenant_id)
        .maybeSingle()

      const { data: claimedProfile } = await adminClient
        .from('user_profiles')
        .select('auth_user_id')
        .eq('tenant_id', invitation.tenant_id)
        .ilike('email', invitation.email)
        .not('auth_user_id', 'is', null)
        .limit(1)
        .maybeSingle()

      return jsonResponse({
        success: true,
        invitation: {
          token,
          tenantId: invitation.tenant_id,
          tenantName: tenantRow?.name || invitation.tenant_id,
          email: invitation.email,
          login: invitation.login,
          role: invitation.role,
          message: invitation.message || '',
          expiresAt,
          alreadyClaimed: !!claimedProfile?.auth_user_id,
        },
      })
    }

    if (action !== 'send' && action !== 'send-password-reset') {
      return jsonResponse({ error: 'Invalid action' }, 400)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${userJwt}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const tenantId = String(body?.tenantId || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const login = String(body?.login || '').trim()
    const requestedRole = (body as SendInviteBody | null)?.role === 'admin' ? 'admin' : 'guest'
    const message = String(body?.message || '').trim()
    const appBaseUrl = String(body?.appBaseUrl || '').trim()

    if (!tenantId) return jsonResponse({ error: 'tenantId is required' }, 400)
    if (!email) return jsonResponse({ error: 'email is required' }, 400)
    if (action === 'send-password-reset' && !login) return jsonResponse({ error: 'login is required' }, 400)
    if (!appBaseUrl) return jsonResponse({ error: 'appBaseUrl is required' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Invalid email' }, 400)
    if (login && login.length > 80) return jsonResponse({ error: 'login is too long' }, 400)
    if (message.length > 5000) return jsonResponse({ error: 'message is too long' }, 400)

    const authUserId = authData.user.id
    const { data: ownProfile } = await adminClient
      .from('user_profiles')
      .select('tenant_id, role, status, github_login, email')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    const isPlatformAdmin = !!platformAdmin
    const canInviteForTenant = isPlatformAdmin || (
      ownProfile?.tenant_id === tenantId
      && ownProfile?.role === 'admin'
      && ownProfile?.status === 'approved'
    )

    if (!canInviteForTenant) {
      return jsonResponse({ error: 'Forbidden for the requested tenant' }, 403)
    }

    const { data: tenantRow, error: tenantError } = await adminClient
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantError || !tenantRow) {
      return jsonResponse({ error: 'Tenant not found' }, 404)
    }

    const { data: existingProfile } = await adminClient
      .from('user_profiles')
      .select('id, auth_user_id, avatar_url, status, role')
      .eq('tenant_id', tenantId)
      .ilike('email', email)
      .maybeSingle()

    const resolvedLogin = login || email.split('@')[0] || 'user'

    const role = action === 'send'
      ? requestedRole
      : (existingProfile?.role === 'admin' ? 'admin' : 'guest')

    if (action === 'send-password-reset' && !existingProfile?.auth_user_id) {
      return jsonResponse({ error: 'This user must already have an active account before password reset can be sent' }, 409)
    }

    if (action === 'send' && existingProfile?.auth_user_id) {
      return jsonResponse({ error: 'This email is already linked to an existing user in this tenant' }, 409)
    }

    const placeholderLogin = `invited-${crypto.randomUUID().slice(0, 8)}`
    const profileLogin = action === 'send' ? placeholderLogin : resolvedLogin
    const avatarUrl = existingProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedLogin)}&background=random`
    const nowIso = new Date().toISOString()

    let invitedProfileId = existingProfile?.id || null
    if (action === 'send' && existingProfile) {
      const { error: updateProfileError } = await adminClient
        .from('user_profiles')
        .update({
          github_login: profileLogin,
          role,
          status: 'approved',
          email,
          avatar_url: avatarUrl,
          updated_at: nowIso,
        })
        .eq('id', existingProfile.id)

      if (updateProfileError) {
        return jsonResponse({ error: updateProfileError.message }, 500)
      }
    } else if (action === 'send') {
      const { data: createdProfile, error: createProfileError } = await adminClient
        .from('user_profiles')
        .insert({
          tenant_id: tenantId,
          github_login: profileLogin,
          role,
          status: 'approved',
          email,
          avatar_url: avatarUrl,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single()

      if (createProfileError || !createdProfile) {
        return jsonResponse({ error: createProfileError?.message || 'Failed to create invited profile' }, 500)
      }
      invitedProfileId = createdProfile.id
    }

    const invitationId = action === 'send' ? crypto.randomUUID() : null
    const invitationToken = action === 'send' ? crypto.randomUUID() : null
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const inviteAcceptUrl = new URL(appBaseUrl)
    inviteAcceptUrl.pathname = '/'
    if (invitationToken) {
      inviteAcceptUrl.searchParams.set('invite', invitationToken)
    }

    if (action === 'send' && invitationId && invitationToken) {
      const { error: insertInvitationError } = await adminClient
        .from('tenant_user_invitations')
        .insert({
          id: invitationId,
          tenant_id: tenantId,
          invited_profile_id: invitedProfileId,
          invited_by_auth_user_id: authUserId,
          email,
          login: null,
          role,
          message: message || null,
          invitation_token: invitationToken,
          status: 'pending',
          expires_at: expiresAt,
        })

      if (insertInvitationError) {
        return jsonResponse({ error: insertInvitationError.message }, 500)
      }
    }

    const inviterLogin = String(ownProfile?.github_login || authData.user.email || authUserId)
    const inviteLink = inviteAcceptUrl.toString()
    const payloadLogin = action === 'send' ? '' : resolvedLogin
    const context = {
      tenant: {
        id: tenantRow.id,
        name: tenantRow.name,
      },
      invite: {
        message,
        acceptUrl: inviteLink,
        expiresAt,
        email,
        login: '',
        role,
      },
      passwordReset: {
        message,
        resetUrl: '',
      },
      user: {
        githubLogin: payloadLogin,
        email,
      },
      inviter: {
        login: inviterLogin,
        email: authData.user.email || '',
      },
      notificationRecipient: {
        login: resolvedLogin,
        name: resolvedLogin,
        email,
        authUserId: existingProfile?.auth_user_id || null,
      },
    }
    let eventTrigger: 'user-access-invite' | 'user-password-reset' = 'user-access-invite'
    let eventKey = ''
    let eventPayload = {
      entity: 'user-access',
      user: context.user,
      tenant: context.tenant,
      invite: context.invite,
      passwordReset: context.passwordReset,
      inviter: context.inviter,
      notificationRecipient: context.notificationRecipient,
      group: {
        role,
        label: role === 'admin' ? 'Admin' : 'Guest',
      },
      access: {
        status: existingProfile?.status || 'approved',
        isApproved: true,
        isPending: false,
        isRejected: false,
      },
      changes: {
        previousRole: null,
        currentRole: role,
        previousStatus: null,
        currentStatus: existingProfile?.status || 'approved',
      },
    } as Record<string, unknown>
    let defaultSubject = renderTemplate('Voce foi convidado para {{tenant.name}}', context)
    let defaultMessage = `Convite de acesso para ${tenantRow.name}`

    if (action === 'send-password-reset') {
      const resetRedirectUrl = new URL(appBaseUrl)
      resetRedirectUrl.pathname = '/auth/callback'
      resetRedirectUrl.searchParams.set('mode', 'reset-password')

      const { data: recoveryLinkData, error: recoveryLinkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: resetRedirectUrl.toString(),
        },
      })

      if (recoveryLinkError || !recoveryLinkData?.properties?.action_link) {
        return jsonResponse({ error: recoveryLinkError?.message || 'Failed to generate password recovery link' }, 500)
      }

      const resetUrl = recoveryLinkData.properties.action_link
      eventTrigger = 'user-password-reset'
      eventKey = `user-password-reset:${tenantId}:${email}:${new Date().toISOString()}`
      eventPayload = {
        ...eventPayload,
        passwordReset: {
          message,
          resetUrl,
        },
      }
      defaultSubject = renderTemplate('Crie uma nova senha para {{tenant.name}}', {
        ...context,
        passwordReset: {
          message,
          resetUrl,
        },
      })
      defaultMessage = `Reset de senha para ${resolvedLogin}`
    } else {
      eventTrigger = 'user-access-invite'
      eventKey = `user-access-invite:${invitationId}:${email}:${expiresAt}`
      eventPayload = {
        ...eventPayload,
        invite: {
          ...context.invite,
          expiresAt: formatSaoPauloDateTime(expiresAt),
        },
      }
      defaultMessage = `Convite de acesso para ${email}`
    }
    const { data: enqueuedCount, error: enqueueError } = await adminClient.rpc('enqueue_notification_deliveries_for_event', {
      p_tenant_id: tenantId,
      p_event_trigger: eventTrigger,
      p_event_key: eventKey,
      p_event_at: new Date().toISOString(),
      p_payload: eventPayload,
      p_default_subject: defaultSubject,
      p_default_message: defaultMessage,
    })

    if (enqueueError) {
      if (invitationId) {
        await adminClient
          .from('tenant_user_invitations')
          .update({
            delivery_error: enqueueError.message || 'Failed to enqueue notification delivery',
          })
          .eq('id', invitationId)
      }

      return jsonResponse({ error: enqueueError.message || 'Failed to enqueue notification delivery' }, 500)
    }

    if (!Number(enqueuedCount)) {
      if (invitationId) {
        await adminClient
          .from('tenant_user_invitations')
          .update({
            delivery_error: 'No active notification rule matched this event',
          })
          .eq('id', invitationId)
      }

      return jsonResponse({ error: 'No active notification rule matched this event' }, 409)
    }

    if (invitationId) {
      await adminClient
        .from('tenant_user_invitations')
        .update({
          sent_at: new Date().toISOString(),
          delivery_error: null,
        })
        .eq('id', invitationId)
    }

    return jsonResponse({
      success: true,
      invitationId,
      invitedProfileId,
      queuedDeliveries: Number(enqueuedCount) || 0,
    })
  } catch (error) {
    console.error('tenant-user-invitations unexpected error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
