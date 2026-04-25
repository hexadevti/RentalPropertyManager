import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  options: Array<{ tenantId: string; tenantName: string }>,
  selectedTenantId?: string,
) {
  const rows = options.map((option, index) => {
    const marker = option.tenantId === selectedTenantId ? ' (atual)' : ''
    return `${index + 1}. ${option.tenantName}${marker}`
  })

  return [
    '🏢 Você tem acesso a mais de um tenant.',
    'Responda com o número do tenant para continuar (ex.: 1) ou use /tenant 1.',
    '',
    ...rows,
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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey  = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    return twimlResponse('Serviço temporariamente indisponível.')
  }

  // ── Parse Twilio webhook (application/x-www-form-urlencoded) ─────────────
  const bodyText   = await req.text()
  const params     = new URLSearchParams(bodyText)
  const fromRaw    = params.get('From') ?? ''
  const messageText = params.get('Body')?.trim() ?? ''

  if (!fromRaw || !messageText) return twimlResponse('')

  const phone = normalizePhone(fromRaw)
  if (!phone || phone.length < 7) {
    return twimlResponse('Número inválido.')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
    const reply = '❌ Número não cadastrado no sistema RPM.\n\nSolicite a um administrador que cadastre seu telefone no seu perfil de usuário.'
    await log('not_found', reply)
    return twimlResponse(reply)
  }

  const primaryProfile = profiles.find((profile) => Boolean(profile.auth_user_id)) ?? profiles[0]
  const userLogin = primaryProfile.github_login || primaryProfile.email || phone
  const authUserId = String(primaryProfile.auth_user_id || '')

  if (!authUserId) {
    const reply = '❌ Seu usuário ainda não está vinculado a uma conta autenticada. Solicite ao administrador para concluir o vínculo de acesso.'
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
      const reply = '⏳ Seu acesso está pendente de aprovação pelo administrador.'
      await log('pending', reply, { userLogin })
      return twimlResponse(reply)
    }

    if (scopedProfiles.some((profile) => profile.status === 'blocked')) {
      const reply = '🚫 Seu acesso está bloqueado. Entre em contato com o administrador.'
      await log('blocked', reply, { userLogin })
      return twimlResponse(reply)
    }

    const reply = '❌ Não encontrei um tenant aprovado para este usuário.'
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

    tenantOptions.sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'pt-BR'))
  }

  if (tenantOptions.length === 0) {
    const reply = '❌ Não encontrei tenants disponíveis para este usuário.'
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
      const reply = `✅ Tenant selecionado: ${selectedByCommand.tenantName}.\nAgora envie sua pergunta.`
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
    const reply = buildTenantSelectionReply(tenantOptions)
    await log('command', reply, { userLogin })
    return twimlResponse(reply)
  }

  const tenantProfile = approvedProfiles.find((profile) => profile.tenant_id === tenantId)
  if (!platformAdmin && !tenantProfile) {
    const reply = buildTenantSelectionReply(tenantOptions, tenantId)
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (tenantProfile?.status === 'pending') {
    const reply = '⏳ Seu acesso está pendente de aprovação pelo administrador.'
    await log('pending', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (tenantProfile?.status === 'blocked') {
    const reply = '🚫 Seu acesso está bloqueado. Entre em contato com o administrador.'
    await log('blocked', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  // ── Handle commands ───────────────────────────────────────────────────────
  if (command === '/tenant') {
    const reply = buildTenantSelectionReply(tenantOptions, tenantId)
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (command === '/limpar') {
    await adminClient
      .from('whatsapp_chat_history')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
    const reply = '🗑️ Conversa limpa! Pode começar uma nova consulta.'
    await log('command', reply, { tenantId, userLogin })
    return twimlResponse(reply)
  }

  if (command === '/ajuda') {
    const reply = (
      '🤖 *Assistente RPM — WhatsApp*\n\n' +
      'Faça perguntas sobre seu portfólio em linguagem natural. Exemplos:\n\n' +
      '• Quais propriedades estão disponíveis?\n' +
      '• Qual o saldo financeiro do mês?\n' +
      '• Há contratos vencendo nos próximos 30 dias?\n' +
      '• Liste as tarefas pendentes\n\n' +
      '*Comandos:*\n' +
      '/limpar — apaga o histórico da conversa\n' +
      '/tenant — mostra os tenants disponíveis\n' +
      '/ajuda — exibe esta mensagem'
    )
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
  const systemPrompt = [
    'Você é o assistente de IA do RPM — Rental Property Manager, respondendo via WhatsApp.',
    'Responda em português brasileiro, de forma objetiva e concisa.',
    `Hoje é ${today}.`,
    '',
    '## Escopo obrigatório',
    `Tenant ativo: "${tenantName}" (tenant_id = ${tenantId}).`,
    'TODAS as consultas são restritas a este tenant. Nunca mencione o tenant_id nas respostas.',
    '',
    '## Formatação para WhatsApp',
    '- Use texto simples — evite markdown como #, **, etc.',
    '- Para negrito use *asteriscos simples*',
    '- Para listas use "•" ou "-" no início da linha',
    '- Seja conciso — mensagens curtas são melhores no WhatsApp',
    '- Máximo 3-4 parágrafos por resposta',
    '',
    '## Instruções',
    'Para responder perguntas sobre dados, use a tool query_supabase.',
    'Faça quantas chamadas forem necessárias para uma resposta precisa.',
    'Não invente dados — se não encontrar, diga que não encontrou.',
    '',
    '## Moeda',
    `- Moeda configurada: ${currencyCode} (${currencySymbol}) — use sempre este símbolo nos valores`,
    '',
    '## Regras de negócio',
    '- transactions.type = "income" = Receita | "expense" = Despesa',
    '- Propriedade ocupada = contrato ativo em contract_properties',
    '- Para propriedades de um contrato: query contract_properties filtrando por contract_id',
    '',
    'Informe ao usuário que pode usar /ajuda para ver os comandos disponíveis.',
  ].join('\n')

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
    finalAnswer = 'Não consegui gerar uma resposta. Tente novamente em instantes.'
  }

  // Truncate if response is too long for WhatsApp
  if (finalAnswer.length > MAX_WA_LENGTH) {
    finalAnswer = finalAnswer.slice(0, MAX_WA_LENGTH - 30) + '\n\n_(resposta truncada)_'
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
