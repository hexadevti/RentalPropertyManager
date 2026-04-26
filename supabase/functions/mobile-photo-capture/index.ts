import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ERROR_KEYS = {
  methodNotAllowed: 'edge_method_not_allowed',
  supabaseNotConfigured: 'edge_supabase_not_configured',
  actionRequired: 'mobile_capture_action_required',
  missingAuthorization: 'edge_missing_authorization',
  invalidAuthToken: 'edge_invalid_auth_token',
  tenantContextNotFound: 'mobile_capture_tenant_context_not_found',
  sessionIdRequired: 'mobile_capture_session_id_required',
  sessionTokenImageRequired: 'mobile_capture_session_token_and_image_required',
  sessionAndTokenRequired: 'mobile_capture_session_and_token_required',
  unsupportedAction: 'mobile_capture_unsupported_action',
  unexpectedError: 'edge_unexpected_error',
} as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MOBILE_CAPTURE_BUCKET = 'mobile-temp-captures'
const SESSION_TTL_MINUTES = 20
const MAX_PHOTOS_PER_SESSION = 6
const MAX_BASE64_CHARS = 16_000_000
const CLEANUP_RETENTION_MINUTES = 24 * 60
const CLEANUP_BATCH_SIZE = 100

type ParsedImageInput = {
  mediaType: string
  base64: string
}

type SessionStatus = 'pending' | 'completed' | 'cancelled' | 'consumed' | 'expired'

type SessionRow = {
  id: string
  tenant_id: string
  created_by_auth_user_id: string
  token_hash: string
  status: SessionStatus
  expires_at: string
  created_at: string
}

type CaptureItemRow = {
  id: string
  file_path: string
  mime_type: string
  file_size: number
  capture_index: number
  created_at: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeText(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max)
}

function parseDataUrl(input: string): ParsedImageInput | null {
  const trimmed = safeText(input, MAX_BASE64_CHARS + 64)
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/)
  if (!match) return null

  const mediaType = match[1].toLowerCase()
  const base64 = match[2].replace(/\s+/g, '')
  if (!base64) return null
  if (base64.length > MAX_BASE64_CHARS) return null

  return { mediaType, base64 }
}

function parseBearerToken(authorizationHeader: string | null) {
  const value = safeText(authorizationHeader, 5000)
  if (!value) return ''
  return value.replace(/^Bearer\s+/i, '').trim()
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function bytesFromBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

async function resolveTenantContext(adminClient: any, authUserId: string) {
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('tenant_id')
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

  return tenantId ?? null
}

async function getSessionByToken(adminClient: any, sessionId: string, token: string) {
  const tokenHash = await sha256Hex(token)
  const { data: session, error } = await adminClient
    .from('mobile_capture_sessions')
    .select('id, tenant_id, created_by_auth_user_id, token_hash, status, expires_at, created_at')
    .eq('id', sessionId)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return session as SessionRow | null
}

async function listSessionItems(adminClient: any, sessionId: string) {
  const { data: items, error } = await adminClient
    .from('mobile_capture_items')
    .select('id, file_path, mime_type, file_size, capture_index, created_at')
    .eq('session_id', sessionId)
    .order('capture_index', { ascending: true })

  if (error) throw new Error(error.message)
  return (items || []) as CaptureItemRow[]
}

async function cleanupStaleSessions(adminClient: any) {
  const cutoffIso = new Date(Date.now() - CLEANUP_RETENTION_MINUTES * 60_000).toISOString()

  const { data: sessions, error: sessionsError } = await adminClient
    .from('mobile_capture_sessions')
    .select('id')
    .lt('expires_at', cutoffIso)
    .limit(CLEANUP_BATCH_SIZE)

  if (sessionsError) throw new Error(sessionsError.message)
  if (!sessions || sessions.length === 0) return

  const sessionIds = sessions.map((session: { id: string }) => session.id)

  const { data: items, error: itemsError } = await adminClient
    .from('mobile_capture_items')
    .select('file_path, session_id')
    .in('session_id', sessionIds)

  if (itemsError) throw new Error(itemsError.message)

  const filePaths = (items || [])
    .map((item: { file_path?: string }) => safeText(item.file_path, 400))
    .filter(Boolean)

  if (filePaths.length > 0) {
    const { error: removeError } = await adminClient.storage
      .from(MOBILE_CAPTURE_BUCKET)
      .remove(filePaths)
    if (removeError) throw new Error(removeError.message)
  }

  const { error: deleteItemsError } = await adminClient
    .from('mobile_capture_items')
    .delete()
    .in('session_id', sessionIds)
  if (deleteItemsError) throw new Error(deleteItemsError.message)

  const { error: deleteSessionsError } = await adminClient
    .from('mobile_capture_sessions')
    .delete()
    .in('id', sessionIds)
  if (deleteSessionsError) throw new Error(deleteSessionsError.message)
}

async function createSession(params: {
  adminClient: any
  authUserId: string
  tenantId: string
  origin: string
}) {
  const { adminClient, authUserId, tenantId, origin } = params
  const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`
  const tokenHash = await sha256Hex(sessionToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString()

  const { data: session, error } = await adminClient
    .from('mobile_capture_sessions')
    .insert({
      tenant_id: tenantId,
      created_by_auth_user_id: authUserId,
      token_hash: tokenHash,
      status: 'pending',
      origin: origin || null,
      expires_at: expiresAt,
    })
    .select('id, expires_at, status')
    .single()

  if (error || !session) {
    throw new Error(error?.message || 'Failed to create mobile capture session.')
  }

  const baseOrigin = origin && /^https?:\/\//i.test(origin)
    ? origin.replace(/\/$/, '')
    : ''
  const mobileUrl = `${baseOrigin}/mobile/capture?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(sessionToken)}`

  return {
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expires_at,
    mobileUrl,
  }
}

async function getSessionStatus(params: {
  adminClient: any
  sessionId: string
  authUserId: string
}) {
  const { adminClient, sessionId, authUserId } = params
  const { data: session, error } = await adminClient
    .from('mobile_capture_sessions')
    .select('id, status, expires_at, created_by_auth_user_id')
    .eq('id', sessionId)
    .eq('created_by_auth_user_id', authUserId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!session) {
    return { status: 'not-found', photos: [] }
  }

  const now = Date.now()
  const expiresAtMs = new Date(session.expires_at).getTime()
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= now

  if (isExpired && session.status === 'pending') {
    await adminClient
      .from('mobile_capture_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
  }

  const items = await listSessionItems(adminClient, session.id)
  const photos = await Promise.all(items.map(async (item) => {
    const { data: signed, error: signError } = await adminClient.storage
      .from(MOBILE_CAPTURE_BUCKET)
      .createSignedUrl(item.file_path, 60 * 30)

    if (signError || !signed?.signedUrl) {
      return {
        id: item.id,
        mimeType: item.mime_type,
        fileSize: item.file_size,
        createdAt: item.created_at,
      }
    }

    return {
      id: item.id,
      mimeType: item.mime_type,
      fileSize: item.file_size,
      createdAt: item.created_at,
      signedUrl: signed.signedUrl,
    }
  }))

  return {
    status: isExpired && session.status === 'pending' ? 'expired' : session.status,
    expiresAt: session.expires_at,
    photos,
  }
}

async function uploadPhoto(params: {
  adminClient: any
  sessionId: string
  token: string
  imageDataUrl: string
}) {
  const { adminClient, sessionId, token, imageDataUrl } = params
  const parsedImage = parseDataUrl(imageDataUrl)
  if (!parsedImage) {
    throw new Error('Invalid image payload. Send a base64 image data URL.')
  }

  const session = await getSessionByToken(adminClient, sessionId, token)
  if (!session) throw new Error('Invalid capture session.')

  const expiresAtMs = new Date(session.expires_at).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await adminClient
      .from('mobile_capture_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
    throw new Error('Capture session expired.')
  }

  if (session.status !== 'pending') {
    throw new Error('Capture session is not accepting new photos.')
  }

  const existingItems = await listSessionItems(adminClient, session.id)
  if (existingItems.length >= MAX_PHOTOS_PER_SESSION) {
    throw new Error(`Maximum number of photos reached (${MAX_PHOTOS_PER_SESSION}).`)
  }

  const bytes = bytesFromBase64(parsedImage.base64)
  const extension = extensionFromMimeType(parsedImage.mediaType)
  const captureIndex = existingItems.length + 1
  const filePath = `${session.tenant_id}/${session.id}/${captureIndex}-${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await adminClient.storage
    .from(MOBILE_CAPTURE_BUCKET)
    .upload(filePath, bytes, {
      contentType: parsedImage.mediaType,
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: item, error: insertError } = await adminClient
    .from('mobile_capture_items')
    .insert({
      session_id: session.id,
      tenant_id: session.tenant_id,
      file_path: filePath,
      mime_type: parsedImage.mediaType,
      file_size: bytes.byteLength,
      capture_index: captureIndex,
    })
    .select('id, capture_index')
    .single()

  if (insertError || !item) {
    throw new Error(insertError?.message || 'Failed to register uploaded photo.')
  }

  await adminClient
    .from('mobile_capture_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id)

  return {
    itemId: item.id,
    captureIndex: item.capture_index,
  }
}

async function completeSession(params: {
  adminClient: any
  sessionId: string
  token: string
}) {
  const { adminClient, sessionId, token } = params
  const session = await getSessionByToken(adminClient, sessionId, token)
  if (!session) throw new Error('Invalid capture session.')

  const expiresAtMs = new Date(session.expires_at).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await adminClient
      .from('mobile_capture_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
    throw new Error('Capture session expired.')
  }

  const items = await listSessionItems(adminClient, session.id)
  if (!items.length) {
    throw new Error('Capture at least one photo before finishing.')
  }

  const { error } = await adminClient
    .from('mobile_capture_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', session.id)

  if (error) throw new Error(error.message)

  return {
    status: 'completed',
    photoCount: items.length,
  }
}

async function consumeSession(params: {
  adminClient: any
  sessionId: string
  authUserId: string
}) {
  const { adminClient, sessionId, authUserId } = params

  const { data: session, error } = await adminClient
    .from('mobile_capture_sessions')
    .select('id, status, created_by_auth_user_id')
    .eq('id', sessionId)
    .eq('created_by_auth_user_id', authUserId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!session) throw new Error('Capture session not found for this user.')

  if (session.status === 'consumed') {
    return { status: 'consumed' }
  }

  const { error: updateError } = await adminClient
    .from('mobile_capture_sessions')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .eq('id', session.id)

  if (updateError) throw new Error(updateError.message)
  return { status: 'consumed' }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured.', errorKey: ERROR_KEYS.supabaseNotConfigured }, 500)
    }

    const body = await req.json().catch(() => ({})) as {
      action?: string
      origin?: string
      sessionId?: string
      token?: string
      imageDataUrl?: string
    }

    const action = safeText(body.action, 100)
    if (!action) return jsonResponse({ error: 'Action is required.', errorKey: ERROR_KEYS.actionRequired }, 400)

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    cleanupStaleSessions(adminClient).catch((cleanupError) => {
      console.warn('mobile capture cleanup failed:', cleanupError instanceof Error ? cleanupError.message : cleanupError)
    })

    if (action === 'createSession' || action === 'getSessionStatus' || action === 'consumeSession') {
      const token = parseBearerToken(req.headers.get('Authorization'))
      if (!token) return jsonResponse({ error: 'Missing Authorization header.', errorKey: ERROR_KEYS.missingAuthorization }, 401)

      const { data: userData, error: userError } = await authClient.auth.getUser(token)
      if (userError || !userData?.user) return jsonResponse({ error: 'Invalid authentication token.', errorKey: ERROR_KEYS.invalidAuthToken }, 401)

      const authUserId = userData.user.id
      const tenantId = await resolveTenantContext(adminClient, authUserId)
      if (!tenantId) return jsonResponse({ error: 'Tenant context not found for authenticated user.', errorKey: ERROR_KEYS.tenantContextNotFound }, 400)

      if (action === 'createSession') {
        const origin = safeText(body.origin, 400)
        const session = await createSession({
          adminClient,
          authUserId,
          tenantId,
          origin,
        })
        return jsonResponse(session)
      }

      if (action === 'consumeSession') {
        const sessionId = safeText(body.sessionId, 120)
        if (!sessionId) return jsonResponse({ error: 'sessionId is required.', errorKey: ERROR_KEYS.sessionIdRequired }, 400)

        const consumed = await consumeSession({ adminClient, sessionId, authUserId })
        return jsonResponse(consumed)
      }

      const sessionId = safeText(body.sessionId, 120)
      if (!sessionId) return jsonResponse({ error: 'sessionId is required.', errorKey: ERROR_KEYS.sessionIdRequired }, 400)
      const status = await getSessionStatus({
        adminClient,
        sessionId,
        authUserId,
      })
      return jsonResponse(status)
    }

    if (action === 'uploadPhoto') {
      const sessionId = safeText(body.sessionId, 120)
      const sessionToken = safeText(body.token, 200)
      const imageDataUrl = safeText(body.imageDataUrl, MAX_BASE64_CHARS + 64)

      if (!sessionId || !sessionToken || !imageDataUrl) {
        return jsonResponse({ error: 'sessionId, token and imageDataUrl are required.', errorKey: ERROR_KEYS.sessionTokenImageRequired }, 400)
      }

      const result = await uploadPhoto({
        adminClient,
        sessionId,
        token: sessionToken,
        imageDataUrl,
      })
      return jsonResponse(result)
    }

    if (action === 'completeSession') {
      const sessionId = safeText(body.sessionId, 120)
      const sessionToken = safeText(body.token, 200)
      if (!sessionId || !sessionToken) {
        return jsonResponse({ error: 'sessionId and token are required.', errorKey: ERROR_KEYS.sessionAndTokenRequired }, 400)
      }

      const result = await completeSession({
        adminClient,
        sessionId,
        token: sessionToken,
      })
      return jsonResponse(result)
    }

    return jsonResponse({ error: 'Unsupported action.', errorKey: ERROR_KEYS.unsupportedAction }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected mobile capture error.'
    return jsonResponse({ error: message, errorKey: ERROR_KEYS.unexpectedError }, 500)
  }
})
