import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── iCal parser ───────────────────────────────────────────────────────────────

interface RawEvent {
  uid: string
  summary: string
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD inclusive (already adjusted from exclusive DTEND)
  cancelled: boolean
}

function parseICalDate(raw: string): string {
  const digits = raw.replace(/T.*$/, '').replace(/[^0-9]/g, '')
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function dtendToInclusive(raw: string): string {
  const iso = parseICalDate(raw)
  // DTEND for all-day events is exclusive → subtract 1 day
  if (!raw.includes('T')) {
    const d = new Date(iso + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return iso
}

function parseICalEvents(ics: string): RawEvent[] {
  const raw = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Unfold continuation lines
  const lines = raw.split('\n').reduce<string[]>((acc, line) => {
    if ((line.startsWith(' ') || line.startsWith('\t')) && acc.length > 0) {
      acc[acc.length - 1] += line.slice(1)
    } else {
      acc.push(line)
    }
    return acc
  }, [])

  const events: RawEvent[] = []
  let cur: Partial<RawEvent> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') { cur = {}; continue }
    if (trimmed === 'END:VEVENT') {
      if (cur?.uid && cur.startDate && cur.endDate) events.push(cur as RawEvent)
      cur = null; continue
    }
    if (!cur) continue

    const sep = trimmed.indexOf(':')
    if (sep === -1) continue
    const key = trimmed.slice(0, sep).toUpperCase()
    const val = trimmed.slice(sep + 1)

    if (key === 'UID') cur.uid = val
    else if (key === 'SUMMARY') cur.summary = val
    else if (key.startsWith('DTSTART')) cur.startDate = parseICalDate(val)
    else if (key.startsWith('DTEND')) cur.endDate = dtendToInclusive(val)
    else if (key === 'STATUS') cur.cancelled = val.toUpperCase() === 'CANCELLED'
  }

  return events
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /^blocked$/i,
  /^owner block(ed)?$/i,
  /^maintenance$/i,
]

function isBlockedEvent(summary: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(summary))
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildSyncUid(propertyId: string, provider: string, rawUid: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return `${propertyId}::${provider}::${rawUid}::${startDate}::${endDate}`
  }
  return `${propertyId}::${provider}::${rawUid}`
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const authorization = req.headers.get('Authorization')
  if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401)
  const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Auth + tenant resolution
  const { data: authData, error: authError } = await authClient.auth.getUser(userJwt)
  if (authError || !authData.user) {
    return jsonResponse({ error: authError?.message ?? 'Invalid user token' }, 401)
  }
  const authUserId = authData.user.id

  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('tenant_id, role, status')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const { data: platformAdmin } = await adminClient
    .from('platform_admins')
    .select('auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const isPlatformAdmin = Boolean(platformAdmin)
  const isApprovedAdmin = profile?.role === 'admin' && profile?.status === 'approved'
  if (!isPlatformAdmin && !isApprovedAdmin) {
    return jsonResponse({ error: 'Access denied' }, 403)
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
  if (!tenantId) return jsonResponse({ error: 'Tenant context not found' }, 400)

  // Load properties
  const { data: properties, error: propsError } = await adminClient
    .from('properties')
    .select('id, name')
    .eq('tenant_id', tenantId)

  if (propsError) return jsonResponse({ error: propsError.message }, 500)

  // Load iCal feeds from dedicated table
  const { data: icalFeeds, error: feedsError } = await adminClient
    .from('property_ical_feeds')
    .select('id, property_id, provider, label, url')
    .eq('tenant_id', tenantId)

  if (feedsError) return jsonResponse({ error: feedsError.message }, 500)

  // Load existing contract ical_uids for dedup check
  const { data: existingContracts } = await adminClient
    .from('contracts')
    .select('id, ical_uid, start_date, end_date')
    .eq('tenant_id', tenantId)
    .not('ical_uid', 'is', null)

  const existingContractIds = (existingContracts ?? []).map((c: any) => c.id)
  const { data: existingContractProperties } = existingContractIds.length > 0
    ? await adminClient
        .from('contract_properties')
        .select('contract_id, property_id')
        .eq('tenant_id', tenantId)
        .in('contract_id', existingContractIds)
    : { data: [] as Array<{ contract_id: string; property_id: string }> }

  const importedUids = new Set<string>(
    (existingContracts ?? []).map((c: any) => c.ical_uid).filter(Boolean)
  )

  const contractPropertyMap = new Map<string, string[]>()
  for (const row of existingContractProperties ?? []) {
    const current = contractPropertyMap.get(row.contract_id) ?? []
    current.push(row.property_id)
    contractPropertyMap.set(row.contract_id, current)
  }

  const importedLegacyOccurrenceKeys = new Set<string>()
  for (const contract of existingContracts ?? []) {
    const icalUid = String(contract.ical_uid || '').trim()
    if (!icalUid || icalUid.includes('::')) continue
    const propertyIds = contractPropertyMap.get(contract.id) ?? []
    const startDate = String(contract.start_date || '').trim()
    const endDate = String(contract.end_date || '').trim()
    for (const propertyId of propertyIds) {
      importedLegacyOccurrenceKeys.add(`${propertyId}::${icalUid}::${startDate}::${endDate}`)
    }
  }

  // Build a map of property feeds
  const propMap = new Map<string, string>((properties ?? []).map((p: any) => [p.id, p.name]))
  const feedsByProperty = new Map<string, any[]>()
  for (const feed of icalFeeds ?? []) {
    const list = feedsByProperty.get(feed.property_id) ?? []
    list.push(feed)
    feedsByProperty.set(feed.property_id, list)
  }

  // Fetch and parse all iCal feeds
  type SyncEvent = {
    uid: string
    propertyId: string
    propertyName: string
    provider: string
    feedLabel: string
    summary: string
    startDate: string
    endDate: string
    status: 'new' | 'duplicate'
  }

  type FetchError = {
    propertyName: string
    feedLabel: string
    error: string
  }

  const events: SyncEvent[] = []
  const fetchErrors: FetchError[] = []
  const configuredFeedsCount = (icalFeeds ?? []).length
  const hasConfiguredFeeds = configuredFeedsCount > 0
  const today = new Date().toISOString().slice(0, 10)
  const diagnostics = {
    totalRawEvents: 0,
    skippedCancelled: 0,
    skippedBlocked: 0,
    skippedMissingDates: 0,
    skippedPast: 0,
    duplicateCount: 0,
    newCount: 0,
  }

  for (const [propertyId, feeds] of feedsByProperty) {
    const propertyName = propMap.get(propertyId) ?? propertyId
    const property = { id: propertyId, name: propertyName }

    for (const feed of feeds) {
      try {
        const response = await fetch(feed.url, {
          headers: { 'User-Agent': 'RPM-iCal-Sync/1.0' },
          signal: AbortSignal.timeout(10_000),
        })

        if (!response.ok) {
          fetchErrors.push({
            propertyName: property.name,
            feedLabel: feed.label || feed.provider,
            error: `HTTP ${response.status}`,
          })
          continue
        }

        const icsContent = await response.text()
        const rawEvents = parseICalEvents(icsContent)
        diagnostics.totalRawEvents += rawEvents.length

        for (const ev of rawEvents) {
          if (ev.cancelled) {
            diagnostics.skippedCancelled += 1
            continue
          }
          if (isBlockedEvent(ev.summary || '')) {
            diagnostics.skippedBlocked += 1
            continue
          }
          if (!ev.startDate || !ev.endDate) {
            diagnostics.skippedMissingDates += 1
            continue
          }

          // Skip past events (ended before today)
          if (ev.endDate < today) {
            diagnostics.skippedPast += 1
            continue
          }

          const syncUid = buildSyncUid(property.id, feed.provider, ev.uid, ev.startDate, ev.endDate)
          const legacyOccurrenceKey = `${property.id}::${ev.uid}::${ev.startDate}::${ev.endDate}`
          const status = importedUids.has(syncUid)
            || importedLegacyOccurrenceKeys.has(legacyOccurrenceKey)
            ? 'duplicate'
            : 'new'

          if (status === 'duplicate') diagnostics.duplicateCount += 1
          else diagnostics.newCount += 1

          events.push({
            uid: syncUid,
            propertyId: property.id,
            propertyName: property.name,
            provider: feed.provider,
            feedLabel: feed.label || feed.provider,
            summary: ev.summary || `${feed.provider} - Reserva`,
            startDate: ev.startDate,
            endDate: ev.endDate,
            status,
          })
        }
      } catch (err: unknown) {
        fetchErrors.push({
          propertyName: property.name,
          feedLabel: feed.label || feed.provider,
          error: err instanceof Error ? err.message : 'Fetch failed',
        })
      }
    }
  }

  // Sort: new first, then by startDate
  events.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'new' ? -1 : 1
    return a.startDate.localeCompare(b.startDate)
  })

  return jsonResponse({ events, fetchErrors, hasConfiguredFeeds, configuredFeedsCount, diagnostics })
})
