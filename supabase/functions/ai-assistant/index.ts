import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type TableResult = {
  name: string
  rows: unknown[]
  error?: string
}

type AnyRow = Record<string, any>

const TABLES = [
  { name: 'properties', select: 'id, name, type, city, address, price_per_night, price_per_month, capacity, owner_ids:property_owners(owner_id)', limit: 120 },
  { name: 'owners', select: 'id, name, email, phone, document, created_at', limit: 120 },
  { name: 'guests', select: 'id, name, email, phone, nationality, created_at', limit: 120 },
  { name: 'contracts', select: 'id, guest_id, rental_type, start_date, end_date, close_date, status, monthly_amount, payment_due_day, property_ids:contract_properties(property_id)', limit: 120 },
  { name: 'transactions', select: 'id, type, amount, category, description, date, property_id, contract_id, service_provider_id', limit: 200, order: 'date' },
  { name: 'tasks', select: 'id, title, description, due_date, priority, status, property_id', limit: 120, order: 'due_date' },
  { name: 'appointments', select: 'id, title, description, date, time, status, service_provider_id, contract_id, guest_id, property_id', limit: 120, order: 'date' },
  { name: 'service_providers', select: 'id, name, service, contact, phone, email, document, created_at', limit: 120 },
  { name: 'documents', select: 'id, title, category, relation_type, relation_id, file_name, created_at', limit: 120, order: 'created_at' },
  { name: 'inspections', select: 'id, property_id, contract_id, title, type, status, scheduled_date, inspector_name, parent_inspection_id', limit: 120, order: 'scheduled_date' },
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text

  const parts: string[] = []
  for (const output of response?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

function summarizeTable(table: TableResult) {
  return {
    name: table.name,
    countLoaded: table.rows.length,
    error: table.error,
    sample: table.rows.slice(0, 80),
  }
}

function getRows(contextTables: TableResult[], tableName: string) {
  return (contextTables.find((table) => table.name === tableName)?.rows || []) as AnyRow[]
}

function normalizeRelationIds(value: unknown, key: string) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') return (item as AnyRow)[key]
      return null
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function buildContractSummary(contextTables: TableResult[]) {
  const contracts = getRows(contextTables, 'contracts')
  const guests = getRows(contextTables, 'guests')
  const today = new Date()
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
  const thirtyDaysFromNow = new Date(today); thirtyDaysFromNow.setDate(today.getDate() + 30)

  const enrich = (c: AnyRow) => ({
    id: c.id,
    status: c.status,
    rental_type: c.rental_type,
    start_date: c.start_date,
    end_date: c.end_date,
    close_date: c.close_date,
    monthly_amount: c.monthly_amount,
    guest_name: guests.find((g) => g.id === c.guest_id)?.name || null,
  })

  return {
    expiring_within_30_days: contracts
      .filter((c) => c.status === 'active' && c.end_date >= today.toISOString().slice(0, 10) && c.end_date <= thirtyDaysFromNow.toISOString().slice(0, 10))
      .map(enrich),
    expired_within_30_days: contracts
      .filter((c) => c.end_date >= thirtyDaysAgo.toISOString().slice(0, 10) && c.end_date < today.toISOString().slice(0, 10))
      .map(enrich),
    recently_closed: contracts
      .filter((c) => c.status === 'cancelled' && c.close_date && c.close_date >= thirtyDaysAgo.toISOString().slice(0, 10))
      .map(enrich),
    active_total: contracts.filter((c) => c.status === 'active').length,
    expired_total: contracts.filter((c) => c.status === 'expired').length,
    cancelled_total: contracts.filter((c) => c.status === 'cancelled').length,
  }
}

// USD cost per 1M tokens for known models (input, output)
const MODEL_PRICING: Record<string, [number, number]> = {
  'gpt-4o':            [2.50,  10.00],
  'gpt-4o-mini':       [0.15,   0.60],
  'gpt-4-turbo':       [10.00, 30.00],
  'gpt-4':             [30.00, 60.00],
  'gpt-3.5-turbo':     [0.50,   1.50],
  'gpt-5':             [15.00, 60.00],
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inputRate, outputRate] = MODEL_PRICING[model] ?? [15.00, 60.00]
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
}

function buildPropertyAvailability(contextTables: TableResult[]) {
  const properties = getRows(contextTables, 'properties')
  const contracts = getRows(contextTables, 'contracts')
  const guests = getRows(contextTables, 'guests')

  return properties.map((property) => {
    const activeContracts = contracts
      .filter((contract) => {
        const propertyIds = normalizeRelationIds(contract.property_ids, 'property_id')
        return contract.status === 'active' && propertyIds.includes(property.id)
      })
      .map((contract) => ({
        id: contract.id,
        guest_id: contract.guest_id,
        guest_name: guests.find((guest) => guest.id === contract.guest_id)?.name || null,
        start_date: contract.start_date,
        end_date: contract.end_date,
        status: contract.status,
      }))

    return {
      id: property.id,
      name: property.name,
      type: property.type,
      computed_availability: activeContracts.length > 0 ? 'occupied' : 'available',
      availability_rule: 'occupied when there is at least one active contract linked to this property; otherwise available',
      active_contracts: activeContracts,
    }
  })
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5'

    if (!openAiApiKey) return jsonResponse({ error: 'OPENAI_API_KEY is not configured' }, 500)
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401)
    const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()

    const body = await req.json().catch(() => null)
    const question = String(body?.question || '').trim()
    const history = Array.isArray(body?.history) ? (body.history as ChatMessage[]).slice(-8) : []

    if (!question) return jsonResponse({ error: 'Question is required' }, 400)
    if (question.length > 1200) return jsonResponse({ error: 'Question is too long' }, 400)

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser(userJwt)
    if (authError || !authData.user) {
      return jsonResponse({ error: authError?.message || 'Invalid user token' }, 401)
    }

    const authUserId = authData.user.id

    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('tenant_id, role, status, github_login, email')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (profileError) return jsonResponse({ error: profileError.message }, 500)

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    const isPlatformAdmin = Boolean(platformAdmin)
    const isApprovedTenantAdmin = profile?.role === 'admin' && profile?.status === 'approved'

    if (!isPlatformAdmin && !isApprovedTenantAdmin) {
      return jsonResponse({ error: 'Only approved administrators can use the AI assistant' }, 403)
    }

    let tenantId = profile?.tenant_id as string | undefined

    if (isPlatformAdmin) {
      const { data: sessionTenant } = await adminClient
        .from('platform_admin_session_tenants')
        .select('tenant_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      tenantId = sessionTenant?.tenant_id || tenantId
    }

    if (!tenantId) {
      return jsonResponse({ error: 'Tenant context was not found for the current user' }, 400)
    }

    const contextTables: TableResult[] = []

    for (const table of TABLES) {
      let query = adminClient
        .from(table.name)
        .select(table.select)
        .eq('tenant_id', tenantId)
        .limit(table.limit)

      if (table.order) {
        query = query.order(table.order, { ascending: false })
      }

      const { data, error } = await query
      contextTables.push({
        name: table.name,
        rows: data || [],
        error: error?.message,
      })
    }

    const today = new Date().toISOString().slice(0, 10)
    const context = {
      generatedAt: new Date().toISOString(),
      today,
      businessRules: {
        propertyAvailability: 'Disponibilidade real de propriedade/quarto deve ser calculada por contratos: se houver contrato ativo vinculado, está ocupado; se não houver contrato ativo vinculado, está disponível. Use sempre computed.propertyAvailability.computed_availability.',
        contractExpiry: 'Use computed.contractSummary para responder perguntas sobre contratos vencendo, vencidos ou encerrados recentemente. Os campos expiring_within_30_days e expired_within_30_days são pré-calculados em relação à data de hoje.',
      },
      computed: {
        propertyAvailability: buildPropertyAvailability(contextTables),
        contractSummary: buildContractSummary(contextTables),
      },
      tables: contextTables.map(summarizeTable),
    }

    const instructions = [
      'Você é um assistente de IA do sistema Rental Property Manager.',
      'Responda em português brasileiro, de forma objetiva e útil.',
      'Use exclusivamente o contexto de dados fornecido. Se uma informação não estiver no contexto, diga que não encontrou nos cadastros carregados.',
      'Para disponibilidade de quartos/propriedades, use SEMPRE computed.propertyAvailability.computed_availability.',
      'Para contratos vencendo ou encerrados, use SEMPRE computed.contractSummary. A data de hoje está em context.today.',
      'Quando fizer contas, explique rapidamente os critérios usados.',
      'Não invente IDs, valores, contratos, hóspedes, propriedades ou documentos.',
      'Se a pergunta pedir uma ação que altere dados, explique o caminho no sistema; você não altera registros diretamente.',
    ].join('\n')

    const input = [
      `Contexto dos cadastros do usuário/tenant em JSON:\n${JSON.stringify(context)}`,
      history.length > 0 ? `Histórico recente do chat:\n${JSON.stringify(history)}` : '',
      `Pergunta do usuário:\n${question}`,
    ].filter(Boolean).join('\n\n')

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        max_output_tokens: 2000,
      }),
    })

    const responseText = await openAiResponse.text()
    let responseData: any = null
    try {
      responseData = responseText ? JSON.parse(responseText) : null
    } catch {
      responseData = { raw: responseText }
    }

    if (!openAiResponse.ok) {
      console.error('OpenAI API error', responseData)
      return jsonResponse({
        error: responseData?.error?.message || 'Failed to generate assistant answer',
        details: responseData,
        model,
      }, 500)
    }

    const inputTokens  = responseData?.usage?.input_tokens  ?? 0
    const outputTokens = responseData?.usage?.output_tokens ?? 0
    const totalTokens  = responseData?.usage?.total_tokens  ?? (inputTokens + outputTokens)
    const costUsd      = estimateCost(model, inputTokens, outputTokens)

    // Log usage asynchronously — don't block the response on it
    adminClient.from('ai_usage_logs').insert({
      id:                 crypto.randomUUID(),
      tenant_id:          tenantId,
      auth_user_id:       authUserId,
      user_login:         profile?.github_login ?? '',
      model,
      question_chars:     question.length,
      input_tokens:       inputTokens,
      output_tokens:      outputTokens,
      total_tokens:       totalTokens,
      estimated_cost_usd: costUsd,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn('ai_usage_logs insert failed:', error.message)
    })

    return jsonResponse({
      answer: extractOutputText(responseData) || 'Não consegui gerar uma resposta para essa pergunta.',
      model,
      usage: { inputTokens, outputTokens, totalTokens, costUsd },
      contextSummary: contextTables.map((table) => ({
        name: table.name,
        countLoaded: table.rows.length,
        error: table.error,
      })),
    })
  } catch (error) {
    console.error('ai-assistant unexpected error', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected Edge Function error',
    }, 500)
  }
})
