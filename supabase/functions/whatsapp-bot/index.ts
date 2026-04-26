import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STARTER_PLAN_CODE = 'starter'
type SupportedLanguage = 'pt' | 'en'

// Hardcoded EN fallback used when the DB is unreachable and for pre-adminClient responses.
const DEFAULT_EN_TRANSLATIONS: Record<string, string> = {
  'system.methodNotAllowed':       'Method not allowed',
  'system.serviceUnavailable':     'Service temporarily unavailable.',
  'system.invalidNumber':          'Invalid number.',

  'aiPlan.tokenLimitReached':      'Monthly AI token limit reached for the current plan. Upgrade to continue using AI features.',
  'aiPlan.blockedByPlan':          'AI features are blocked for the current plan. Change the plan to enable access.',
  'aiPlan.unavailable':            'AI access is unavailable for the current plan.',

  'tenantSelection.title':         '🏢 You have access to more than one account.',
  'tenantSelection.instruction':   'Reply with the account number to continue (for example: 1) or use /tenant 1.',
  'tenantSelection.currentMarker': ' (current)',
  'tenantSelection.selected':      '✅ Account selected: {tenantName}.\nNow send your question.',

  'replies.phoneNotRegistered':    '❌ This number is not registered in the RPM system.\n\nAsk an administrator to add your phone number to your user profile.',
  'replies.authNotLinked':         '❌ Your user is not linked to an authenticated account yet. Ask an administrator to finish the access setup.',
  'replies.accessPendingApproval': '⏳ Your access is pending administrator approval.',
  'replies.accessBlocked':         '🚫 Your access is blocked. Contact the administrator.',
  'replies.noApprovedTenant':      '❌ I could not find an approved account for this user.',
  'replies.noAvailableTenants':    '❌ I could not find available accounts for this user.',
  'replies.clearConversation':     '🗑️ Conversation cleared. You can start a new request now.',
  'replies.fallbackError':         'I could not generate a response. Please try again shortly.',
  'replies.truncatedSuffix':       '\n\n_(response truncated)_',

  'help.title':                    '🤖 *RPM Assistant - WhatsApp*',
  'help.intro':                    'Ask questions about your portfolio in natural language. Examples:',
  'help.examples':                 '• Which properties are available?\n• What is the financial balance for this month?\n• Are there contracts ending in the next 30 days?\n• List the pending tasks',
  'help.commandsTitle':            '*Commands:*',
  'help.commands':                 '/limpar - clears the conversation history\n/tenant - shows the available accounts\n/ajuda - shows this message',

  'prompt.assistantRole':          'You are the RPM AI assistant - Rental Property Manager, replying through WhatsApp.',
  'prompt.responseStyle':          'Reply in English, clearly and concisely.',
  'prompt.todayLine':              'Today is {today}.',
  'prompt.scopeTitle':             '## Required scope',
  'prompt.activeAccountLine':      'Active account: "{tenantName}" (tenant_id = {tenantId}).',
  'prompt.tenantRestricted':       'ALL queries are restricted to this account. Never mention the tenant_id in your answers.',
  'prompt.formattingTitle':        '## WhatsApp formatting',
  'prompt.formattingRules':        '- Use plain text; avoid markdown such as #, **, etc.\n- Use *single asterisks* for bold\n- For lists, use "•" or "-" at the start of the line\n- Be concise; shorter messages work better on WhatsApp\n- Maximum of 3-4 paragraphs per answer',
  'prompt.instructionsTitle':      '## Instructions',
  'prompt.instructionLines':       'Use the query_supabase tool to answer data questions.\nMake as many calls as needed for an accurate answer.\nDo not invent data; if you cannot find it, say so.',
  'prompt.currencyTitle':          '## Currency',
  'prompt.currencyLine':           '- Configured currency: {currencyCode} ({currencySymbol}) - always use this symbol for values',
  'prompt.businessRulesTitle':     '## Business rules',
  'prompt.businessRules':          '- transactions.type = "income" = Income | "expense" = Expense\n- Property occupied = active contract exists in contract_properties\n- For contract properties: query contract_properties filtered by contract_id',
  'prompt.helpHint':               'Tell the user they can use /ajuda to see the available commands.',
}

// Loads translations for the requested language from the DB, with EN fallback.
// If the DB query fails the in-process DEFAULT_EN_TRANSLATIONS are used as-is.
async function loadBotTranslations(adminClient: any, language: string): Promise<Record<string, string>> {
  const langs = language === 'en' ? ['en'] : ['en', language]
  const { data } = await adminClient
    .from('whatsapp_bot_translations')
    .select('language, key, value')
    .in('language', langs)

  const result: Record<string, string> = { ...DEFAULT_EN_TRANSLATIONS }
  if (data?.length) {
    // Apply EN from DB (may have updated copy text)
    for (const row of (data as Array<{ language: string; key: string; value: string }>)) {
      if (row.language === 'en') result[row.key] = row.value
    }
    // Then overlay the requested language
    if (language !== 'en') {
      for (const row of (data as Array<{ language: string; key: string; value: string }>)) {
        if (row.language === language) result[row.key] = row.value
      }
    }
  }
  return result
}

function t(translations: Record<string, string>, key: string): string {
  return translations[key] ?? DEFAULT_EN_TRANSLATIONS[key] ?? ''
}

function tLines(translations: Record<string, string>, key: string): string[] {
  const val = t(translations, key)
  return val ? val.split('\n') : []
}

function formatMessage(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  )
}

function resolveRequestLanguage(req: Request): SupportedLanguage {
  const acceptLanguage = String(req.headers.get('Accept-Language') || '').toLowerCase()
  if (acceptLanguage.includes('pt')) return 'pt'
  if (acceptLanguage.includes('en')) return 'en'
  return 'en'
}

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

async function ensureAiPlanAccess(adminClient: any, tenantId: string, translations: Record<string, string>) {
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
      message: t(translations, 'aiPlan.blockedByPlan'),
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
      message: t(translations, 'aiPlan.tokenLimitReached'),
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

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_WA_LENGTH    = 1500   // truncate AI response to avoid TwiML issues
const MAX_HISTORY      = 8      // messages to include as context
const MAX_ITERATIONS   = 6      // Claude tool-use iterations (keep low for speed)
const HISTORY_TTL_DAYS = 1      // auto-clean messages older than this

const CLAUDE_MODEL     = 'claude-haiku-4-5-20251001'   // fast + cheap for WhatsApp

// ── Allowed tables (same allowlist as ai-assistant) ───────────────────────────

const ALLOWED_TABLES = new Set([
  'properties', 'owners', 'guests', 'contracts', 'transactions',
  'tasks', 'appointments', 'service_providers', 'documents', 'inspections',
])
const JUNCTION_TABLES = new Set(['contract_properties', 'property_owners'])
const RESTRICTED_TABLES = new Set([
  'user_profiles', 'tenants', 'platform_admins', 'access_profiles',
  'app_audit_logs', 'ai_usage_logs', 'bug_reports', 'contact_messages',
  'notification_rules', 'notification_templates', 'notification_deliveries',
])

// ── Tool definition ───────────────────────────────────────────────────────────

const QUERY_TOOL = {
  name: 'query_supabase',
  description: [
    'Read-only query for the tenant database. tenant_id is applied automatically.',
    'Main tables: properties, owners, guests, contracts, transactions, tasks,',
    '  appointments, service_providers, documents, inspections.',
    'Junction tables (no tenant filter): contract_properties, property_owners.',
    'Business rules:',
    '- transactions.type = "income" = Receita; "expense" = Despesa',
    '- Property occupied when active contract exists in contract_properties',
  ].join('\n'),
  input_schema: {
    type: 'object' as const,
    properties: {
      table:     { type: 'string', description: 'Table to query' },
      select:    { type: 'string', description: 'Columns (default: *)' },
      filters:   { type: 'object', description: 'Equality filters {col: val}', additionalProperties: true },
      order_by:  { type: 'string', description: 'Column to order by' },
      order_asc: { type: 'boolean', description: 'true=asc, false=desc' },
      limit:     { type: 'number', description: 'Max rows (default 100, max 300)' },
    },
    required: ['table'],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function twimlResponse(message: string): Response {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
  )
}

function extractClaudeText(response: any): string {
  if (!Array.isArray(response?.content)) return ''
  return response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text as string)
    .join('\n')
    .trim()
}

function normalizePhone(raw: string): string {
  // "whatsapp:+5511999990000" → "5511999990000"
  return raw.replace(/^whatsapp:\+?/i, '').replace(/\D/g, '')
}

function parseTenantSelection(message: string, optionCount: number): number | null {
  const normalized = message.trim().toLowerCase()
  const commandMatch = normalized.match(/^\/tenant\s+(\d{1,2})$/)
  const directMatch = normalized.match(/^(\d{1,2})$/)
  const raw = commandMatch?.[1] ?? directMatch?.[1]
  if (!raw) return null

  const selected = Number(raw)
  if (!Number.isInteger(selected)) return null
  if (selected < 1 || selected > optionCount) return null
  return selected - 1
}

function buildTenantSelectionReply(
  translations: Record<string, string>,
  options: Array<{ tenantId: string; tenantName: string }>,
  selectedTenantId?: string,
) {
  const rows = options.map((option, index) => {
    const marker = option.tenantId === selectedTenantId ? t(translations, 'tenantSelection.currentMarker') : ''
    return `${index + 1}. ${option.tenantName}${marker}`
  })

  return [
    t(translations, 'tenantSelection.title'),
    t(translations, 'tenantSelection.instruction'),
    '',
    ...rows,
  ].join('\n')
}

function buildHelpReply(translations: Record<string, string>) {
  return [
    t(translations, 'help.title'),
    '',
    t(translations, 'help.intro'),
    '',
    ...tLines(translations, 'help.examples'),
    '',
    t(translations, 'help.commandsTitle'),
    ...tLines(translations, 'help.commands'),
  ].join('\n')
}

function buildSystemPrompt(
  translations: Record<string, string>,
  tenantName: string,
  tenantId: string,
  today: string,
  currencyCode: string,
  currencySymbol: string,
) {
  return [
    t(translations, 'prompt.assistantRole'),
    t(translations, 'prompt.responseStyle'),
    formatMessage(t(translations, 'prompt.todayLine'), { today }),
    '',
    t(translations, 'prompt.scopeTitle'),
    formatMessage(t(translations, 'prompt.activeAccountLine'), { tenantName, tenantId }),
    t(translations, 'prompt.tenantRestricted'),
    '',
    t(translations, 'prompt.formattingTitle'),
    ...tLines(translations, 'prompt.formattingRules'),
    '',
    t(translations, 'prompt.instructionsTitle'),
    ...tLines(translations, 'prompt.instructionLines'),
    '',
    t(translations, 'prompt.currencyTitle'),
    formatMessage(t(translations, 'prompt.currencyLine'), { currencyCode, currencySymbol }),
    '',
    t(translations, 'prompt.businessRulesTitle'),
    ...tLines(translations, 'prompt.businessRules'),
    '',
    t(translations, 'prompt.helpHint'),
  ].join('\n')
}

async function executeQueryTool(
  input: Record<string, any>,
  adminClient: any,
  tenantId: string,
): Promise<unknown> {
  const table = String(input.table ?? '')
  const isJunction = JUNCTION_TABLES.has(table)

  if (RESTRICTED_TABLES.has(table)) {
    return { error: `Table "${table}" is restricted` }
  }
  if (!isJunction && !ALLOWED_TABLES.has(table)) {
    return { error: `Table "${table}" is not accessible` }
  }

  const select = String(input.select ?? '*')
  const limit  = Math.min(Number(input.limit) || 100, 300)
  const filters = (input.filters && typeof input.filters === 'object')
    ? input.filters as Record<string, unknown>
    : {}

  try {
    let query = adminClient.from(table).select(select)
    if (!isJunction) query = query.eq('tenant_id', tenantId)
    for (const [col, val] of Object.entries(filters)) query = query.eq(col, val)
    if (input.order_by) {
      query = query.order(String(input.order_by), { ascending: Boolean(input.order_asc ?? false) })
    }
    query = query.limit(limit)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { rows: data ?? [], count: (data ?? []).length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Query failed' }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const requestLanguage = resolveRequestLanguage(req)

  if (req.method !== 'POST') {
    return new Response(DEFAULT_EN_TRANSLATIONS['system.methodNotAllowed'], { status: 405 })
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey  = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    return twimlResponse(DEFAULT_EN_TRANSLATIONS['system.serviceUnavailable'])
  }

  // ── Parse Twilio webhook (application/x-www-form-urlencoded) ─────────────
  const bodyText    = await req.text()
  const params      = new URLSearchParams(bodyText)
  const fromRaw     = params.get('From') ?? ''
  const messageText = params.get('Body')?.trim() ?? ''

  if (!fromRaw || !messageText) return twimlResponse('')

  const phone = normalizePhone(fromRaw)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Load bot message translations from DB (EN fallback built in) ──────────
  const translations = await loadBotTranslations(adminClient, requestLanguage)

  if (!phone || phone.length < 7) {
    return twimlResponse(t(translations, 'system.invalidNumber'))
  }

  // ── Helper: log every bot interaction (awaited — fire-and-forget breaks on Edge Functions) ──
  const log = async (
    status: 'success' | 'not_found' | 'blocked' | 'pending' | 'command' | 'error',
    response: string,
    opts?: { tenantId?: string; userLogin?: string }
  ) => {
    const { error } = await adminClient.from('whatsapp_bot_logs').insert({
      phone,
      tenant_id:  opts?.tenantId  ?? null,
      user_login: opts?.userLogin ?? null,
      incoming:   messageText,
      response,
      status,
    })
    if (error) console.warn('whatsapp_bot_logs insert failed:', error.message)
  }

  // ── Identify user by phone ────────────────────────────────────────────────
  // Phone may be stored as "5511999990000" or "+5511999990000" — try both
  const phoneE164 = `+${phone}`
  const { data: userProfiles } = await adminClient
    .from('user_profiles')
    .select('auth_user_id, tenant_id, role, status, github_login, email')
    .or(`phone.eq.${phone},phone.eq.${phoneE164}`)
    .limit(20)

  const profiles = (userProfiles ?? []) as Array<{
    auth_user_id: string | null
    tenant_id: string | null
    role: string
    status: string
    github_login: string | null
    email: string | null
  }>

  if (profiles.length === 0) {
    const reply = t(translations, 'replies.phoneNotRegistered')
    await log('not_found', reply)
    return twimlResponse(reply)
  }

  const primaryProfile = profiles.find((profile) => Boolean(profile.auth_user_id)) ?? profiles[0]
  const userLogin = primaryProfile.github_login || primaryProfile.email || phone
  const authUserId = String(primaryProfile.auth_user_id || '')

  if (!authUserId) {
    const reply = t(translations, 'replies.authNotLinked')
    await log('blocked', reply, { userLogin })
    return twimlResponse(reply)
  }

  const { data: platformAdmin } = await adminClient
    .from('platform_admins')
    .select('auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const scopedProfiles = profiles.filter((profile) => profile.auth_user_id === authUserId)
  const approvedProfiles = scopedProfiles.filter((profile) => profile.status === 'approved' && profile.tenant_id)

  if (!platformAdmin && approvedProfiles.length === 0) {
    if (scopedProfiles.some((profile) => profile.status === 'pending')) {
      const reply = t(translations, 'replies.accessPendingApproval')
      await log('pending', reply, { userLogin })
      return twimlResponse(reply)
    }

    if (scopedProfiles.some((profile) => profile.status === 'blocked')) {
      const reply = t(translations, 'replies.accessBlocked')
      await log('blocked', reply, { userLogin })
      return twimlResponse(reply)
    }

    const reply = t(translations, 'replies.noApprovedTenant')
    await log('blocked', reply, { userLogin })
    return twimlResponse(reply)
  }

  const tenantOptions: Array<{ tenantId: string; tenantName: string }> = []
  if (platformAdmin) {
    const { data: tenantRows } = await adminClient
      .from('tenants')
      .select('id, name')
      .order('name', { ascending: true })

    for (const row of (tenantRows ?? []) as Array<{ id: string; name: string | null }>) {
      tenantOptions.push({ tenantId: row.id, tenantName: row.name || row.id })
    }
  } else {
    const tenantIds = Array.from(new Set(approvedProfiles.map((profile) => String(profile.tenant_id))))
    const { data: tenantRows } = await adminClient
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds)

    const nameById = new Map<string, string>()
    for (const row of (tenantRows ?? []) as Array<{ id: string; name: string | null }>) {
      nameById.set(row.id, row.name || row.id)
    }

    for (const tenantId of tenantIds) {
      tenantOptions.push({ tenantId, tenantName: nameById.get(tenantId) || tenantId })
    }

    tenantOptions.sort((a, b) => a.tenantName.localeCompare(b.tenantName, requestLanguage === 'pt' ? 'pt-BR' : 'en'))
  }

  if (tenantOptions.length === 0) {
    const reply = t(translations, 'replies.noAvailableTenants')
    await log('blocked', reply, { userLogin })
    return twimlResponse(reply)
  }

  const { data: selectedTenantSession } = await adminClient
    .from('whatsapp_bot_tenant_sessions')
    .select('tenant_id')
    .eq('auth_user_id', authUserId)
    .eq('phone', phone)
    .maybeSingle()

  let tenantId = tenantOptions.length === 1 ? tenantOptions[0].tenantId : null
  const command = messageText.toLowerCase().trim()
  const selectedIndex = parseTenantSelection(messageText, tenantOptions.length)
  const selectedByCommand = selectedIndex !== null ? tenantOptions[selectedIndex] : null

  if (selectedByCommand) {
    tenantId = selectedByCommand.tenantId
    await adminClient
      .from('whatsapp_bot_tenant_sessions')
      .upsert({
        auth_user_id: authUserId,
        phone,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'auth_user_id,phone' })

    if (platformAdmin) {
      await adminClient
        .from('platform_admin_session_tenants')
        .upsert({
          auth_user_id: authUserId,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'auth_user_id' })
    }

    // If the user only sent a tenant selection command/number, confirm and stop here.
    if (/^\d{1,2}$/.test(command) || /^\/tenant\s+\d{1,2}$/.test(command)) {
      const reply = formatMessage(t(translations, 'tenantSelection.selected'), { tenantName: selectedByCommand.tenantName })
      await log('command', reply, { tenantId, userLogin })
      return twimlResponse(reply)
    }
  }

  if (!tenantId && selectedTenantSession?.tenant_id) {
    const selectedTenantId = String(selectedTenantSession.tenant_id)
    if (tenantOptions.some((option) => option.tenantId === selectedTenantId)) {
      tenantId = selectedTenantId
    }
  }

  if (!tenantId) {
    const reply = buildTenantSelectionReply(translations, tenantOptions)
    await log('command', reply, { userLogin })
    return twimlResponse(reply)
  }

  const aiPlanAccess = await ensureAiPlanAccess(adminClient, tenantId, translations)
  if (!aiPlanAccess.allowed) {
    const reply = `🚫 ${aiPlanAccess.message || t(translations, 'aiPlan.unavailable')}`
    await log('blocked', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  const tenantProfile = approvedProfiles.find((profile) => profile.tenant_id === tenantId)
  if (!platformAdmin && !tenantProfile) {
    const reply = buildTenantSelectionReply(translations, tenantOptions, tenantId)
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (tenantProfile?.status === 'pending') {
    const reply = t(translations, 'replies.accessPendingApproval')
    await log('pending', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (tenantProfile?.status === 'blocked') {
    const reply = t(translations, 'replies.accessBlocked')
    await log('blocked', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  // ── Handle commands ───────────────────────────────────────────────────────
  if (command === '/tenant') {
    const reply = buildTenantSelectionReply(translations, tenantOptions, tenantId)
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (command === '/limpar') {
    await adminClient
      .from('whatsapp_chat_history')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
    const reply = t(translations, 'replies.clearConversation')
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (command === '/ajuda') {
    const reply = buildHelpReply(translations)
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  // ── Clean up old history (> HISTORY_TTL_DAYS) ────────────────────────────
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - HISTORY_TTL_DAYS)
  await adminClient
    .from('whatsapp_chat_history')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .lt('created_at', cutoff.toISOString())

  // ── Fetch conversation history ────────────────────────────────────────────
  const { data: historyRows } = await adminClient
    .from('whatsapp_chat_history')
    .select('role, content')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY)

  const history = (historyRows ?? []).reverse()

  // ── Fetch tenant name ─────────────────────────────────────────────────────
  const { data: tenantData } = await adminClient
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()
  const tenantName = (tenantData as any)?.name ?? tenantId

  // ── Fetch currency preference ─────────────────────────────────────────────
  const { data: currencySetting } = await adminClient
    .from('user_settings')
    .select('value')
    .eq('auth_user_id', authUserId)
    .eq('key', 'app-currency')
    .maybeSingle()

  const currencyCode: string = (currencySetting as any)?.value ?? 'BRL'
  const CURRENCY_SYMBOLS: Record<string, string> = {
    BRL: 'R$', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
    CAD: 'CA$', AUD: 'A$', CHF: 'Fr', CNY: '¥', MXN: 'MX$',
  }
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode

  const today = new Date().toISOString().slice(0, 10)

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(
    translations,
    tenantName,
    tenantId,
    today,
    currencyCode,
    currencySymbol,
  )

  // ── Save user message ─────────────────────────────────────────────────────
  await adminClient.from('whatsapp_chat_history').insert({
    tenant_id: tenantId,
    phone,
    role: 'user',
    content: messageText,
  })

  // ── Build message thread ──────────────────────────────────────────────────
  const messages: any[] = []
  for (const h of history) {
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: messageText })

  // ── Agentic tool-use loop ─────────────────────────────────────────────────
  let totalInputTokens  = 0
  let totalOutputTokens = 0
  let iterations        = 0
  let finalAnswer       = ''

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':            anthropicApiKey,
        'anthropic-version':    '2023-06-01',
        'content-type':         'application/json',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 1000,
        system:     systemPrompt,
        tools:      [QUERY_TOOL],
        messages,
      }),
    })

    const responseData = await response.json()
    if (!response.ok) {
      console.error('Claude API error', responseData)
      break
    }

    totalInputTokens  += responseData?.usage?.input_tokens  ?? 0
    totalOutputTokens += responseData?.usage?.output_tokens ?? 0

    messages.push({ role: 'assistant', content: responseData.content })

    if (responseData.stop_reason === 'end_turn') {
      finalAnswer = extractClaudeText(responseData)
      break
    }

    if (responseData.stop_reason === 'tool_use') {
      const toolResults: any[] = []
      for (const block of (responseData.content as any[])) {
        if (block.type !== 'tool_use') continue
        const result = await executeQueryTool(block.input ?? {}, adminClient, tenantId)
        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        })
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    finalAnswer = extractClaudeText(responseData)
    break
  }

  const hasError = !finalAnswer
  if (hasError) {
    finalAnswer = t(translations, 'replies.fallbackError')
  }

  // Truncate if response is too long for WhatsApp
  if (finalAnswer.length > MAX_WA_LENGTH) {
    finalAnswer = finalAnswer.slice(0, MAX_WA_LENGTH - 30) + t(translations, 'replies.truncatedSuffix')
  }

  // ── Save assistant response ───────────────────────────────────────────────
  await adminClient.from('whatsapp_chat_history').insert({
    tenant_id: tenantId,
    phone,
    role: 'assistant',
    content: finalAnswer,
  })

  // ── Log AI usage ──────────────────────────────────────────────────────────
  const costUsd = (totalInputTokens / 1_000_000) * 0.8 + (totalOutputTokens / 1_000_000) * 4.0
  adminClient.from('ai_usage_logs').insert({
    id:                 crypto.randomUUID(),
    tenant_id:          tenantId,
    auth_user_id:       authUserId,
    user_login:         userLogin,
    model:              CLAUDE_MODEL,
    question_chars:     messageText.length,
    input_tokens:       totalInputTokens,
    output_tokens:      totalOutputTokens,
    total_tokens:       totalInputTokens + totalOutputTokens,
    estimated_cost_usd: costUsd,
  }).then(({ error }: any) => {
    if (error) console.warn('ai_usage_logs insert failed:', error.message)
  })

  // Log the interaction (success or error)
  await log(hasError ? 'error' : 'success', finalAnswer, { tenantId, userLogin })

  return twimlResponse(finalAnswer)
})
