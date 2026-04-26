import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { estimateCost } from './helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
])

const DEFAULT_MODEL = 'claude-sonnet-4-6'

const ALLOWED_TABLES = new Set([
  'properties', 'owners', 'guests', 'contracts', 'transactions',
  'tasks', 'appointments', 'service_providers', 'documents', 'inspections',
])

const RESTRICTED_TABLES = new Set([
  'user_profiles',
  'tenants',
  'platform_admins',
  'platform_admin_session_tenants',
  'access_profiles',
  'access_profile_permissions',
  'access_roles',
  'app_audit_logs',
  'ai_usage_logs',
  'bug_reports',
  'bug_report_attachments',
  'contact_messages',
  'notification_rules',
  'notification_templates',
  'notification_deliveries',
  'notification_master_templates',
])

const RESTRICTED_TOPIC_PATTERNS = [
  /\buser_profiles?\b/i,
  /\btenants?\b/i,
  /\bplatform_admins?\b/i,
  /\bplatform_admin_session_tenants?\b/i,
  /\baccess_profiles?\b/i,
  /\baccess_profile_permissions?\b/i,
  /\baccess_roles?\b/i,
  /\bapp_audit_logs?\b/i,
  /\bai_usage_logs?\b/i,
  /\bbug_reports?\b/i,
  /\bbug_report_attachments?\b/i,
  /\bcontact_messages?\b/i,
  /\bnotification_rules?\b/i,
  /\bnotification_templates?\b/i,
  /\bnotification_deliveries?\b/i,
  /\bnotification_master_templates?\b/i,
  /\busu[aá]rio(s)?\b/i,
  /\bpermiss[aõ]es?\b/i,
  /\btenant(s)?\b/i,
  /\bauditoria\b/i,
  /\baudit\b/i,
  /\bbugs?\b/i,
  /\bfale conosco\b/i,
  /\bnotifica(?:ç|c)[aã]o(?:es)?\b/i,
]

const RESTRICTED_ACCESS_MESSAGE = [
  'Não posso consultar nem expor dados de usuários, tenants, permissões, logs de auditoria, bugs, fale conosco ou notificações.',
  'Posso ajudar apenas com dados operacionais do negócio, como propriedades, contratos, hóspedes, transações, tarefas, agenda, documentos e vistorias.',
].join(' ')

const WRITE_REQUEST_PATTERNS = [
  /\balter(ar|e|acao|acoes)?\b/i,
  /\batualiz(ar|e|acao|acoes)?\b/i,
  /\bedit(ar|e|acao|acoes)?\b/i,
  /\bmodific(ar|e|acao|acoes)?\b/i,
  /\bmud(ar|e|anca|ancas)?\b/i,
  /\bcria(r|cao|coes)?\b/i,
  /\bcadastra(r|mento)?\b/i,
  /\binseri(r|cao|coes)?\b/i,
  /\badiciona(r|e)?\b/i,
  /\bexclu(i|ir|a|ao|oes)\b/i,
  /\bapag(ar|ue)\b/i,
  /\bremov(er|a|acao|acoes)?\b/i,
  /\baprova(r|cao|coes)?\b/i,
  /\brecusa(r|do)?\b/i,
  /\bcancela(r|mento)?\b/i,
  /\bencerr(ar|e)\b/i,
  /\bativ(ar|e)\b/i,
  /\bdesativ(ar|e)\b/i,
  /\btransfer(ir|encia|encias)?\b/i,
  /\bmover\b/i,
  /\bupdat(e|ar)\b/i,
  /\bdelete\b/i,
  /\binsert\b/i,
  /\bcreate\b/i,
]

const WRITE_ACCESS_MESSAGE = [
  'Nao posso alterar informacoes no Supabase pelo chat.',
  'Este assistente e somente leitura: posso consultar dados e orientar o passo a passo para voce fazer a alteracao na tela correta do sistema.',
].join(' ')

// Junction tables — queried without tenant_id (linked via FK)
const JUNCTION_TABLES = new Set(['contract_properties', 'property_owners'])

const QUERY_TOOL = {
  name: 'query_supabase',
  description: [
    'Read-only query tool for the tenant database. The tenant_id filter is applied automatically to all main tables.',
    'This tool never creates, updates, deletes, or mutates records.',
    '',
    'Main tables: properties, owners, guests, contracts, transactions, tasks, appointments, service_providers, documents, inspections.',
    'Junction tables (no tenant_id filter): contract_properties (contract_id, property_id), property_owners (property_id, owner_id).',
    '',
    'Business rules:',
    '- transactions.type = "income" means Receita; "expense" means Despesa',
    '- A property is occupied when there is at least one active contract linked via contract_properties; otherwise available',
    '- Use multiple tool calls to cross-reference data between tables',
    '- For contract properties: query contract_properties filtering by contract_id',
    '- For property owners: query property_owners filtering by property_id',
  ].join('\n'),
  input_schema: {
    type: 'object' as const,
    properties: {
      table: {
        type: 'string',
        description: 'Table name to query',
      },
      select: {
        type: 'string',
        description: 'Columns to select in PostgREST format (default: *)',
      },
      filters: {
        type: 'object',
        description: 'Equality filters as {column: value} pairs',
        additionalProperties: true,
      },
      order_by: {
        type: 'string',
        description: 'Column name to order results by',
      },
      order_asc: {
        type: 'boolean',
        description: 'true = ascending, false = descending (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Maximum rows to return (default: 100, max: 500)',
      },
    },
    required: ['table'],
  },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractClaudeText(response: any): string {
  if (!Array.isArray(response?.content)) return ''
  return response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text as string)
    .join('\n')
    .trim()
}

function isRestrictedQuestion(question: string): boolean {
  const normalized = question.trim()
  if (!normalized) return false
  return RESTRICTED_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isWriteRequest(question: string): boolean {
  const normalized = question.trim()
  if (!normalized) return false
  return WRITE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized))
}

async function executeQueryTool(
  input: Record<string, any>,
  adminClient: any,
  tenantId: string,
): Promise<unknown> {
  const table = String(input.table ?? '')
  const isJunction = JUNCTION_TABLES.has(table)

  if (RESTRICTED_TABLES.has(table)) {
    return { error: 'This table is restricted and cannot be queried by the AI assistant' }
  }

  if (!isJunction && !ALLOWED_TABLES.has(table)) {
    return { error: `Table "${table}" is not accessible` }
  }

  const select = String(input.select ?? '*')
  const limit = Math.min(Number(input.limit) || 100, 500)
  const filters = input.filters && typeof input.filters === 'object' ? input.filters as Record<string, unknown> : {}

  try {
    let query = adminClient.from(table).select(select)

    if (!isJunction) {
      query = query.eq('tenant_id', tenantId)
    }

    for (const [col, val] of Object.entries(filters)) {
      query = query.eq(col, val)
    }

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

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!anthropicApiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured' }, 500)
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401)
    const userJwt = authorization.replace(/^Bearer\s+/i, '').trim()

    const body = await req.json().catch(() => null)
    const requestedModel = String(body?.model ?? '').trim()
    const configuredDefaultModel = Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL
    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : configuredDefaultModel

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Auth + tenant resolution ──────────────────────────────────────────────
    const { data: authData, error: authError } = await authClient.auth.getUser(userJwt)
    if (authError || !authData.user) {
      return jsonResponse({ error: authError?.message ?? 'Invalid user token' }, 401)
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
      tenantId = sessionTenant?.tenant_id ?? tenantId
    }
    if (!tenantId) return jsonResponse({ error: 'Tenant context was not found for the current user' }, 400)

    const { data: tenantData } = await adminClient
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()
    const tenantName = tenantData?.name ?? tenantId

    // ── Fetch user currency preference ────────────────────────────────────────
    const { data: currencySetting } = await adminClient
      .from('user_settings')
      .select('value')
      .eq('auth_user_id', authUserId)
      .eq('key', 'app-currency')
      .maybeSingle()

    const currencyCode: string = (currencySetting as any)?.value ?? 'BRL'

    const CURRENCY_SYMBOLS: Record<string, string> = {
      BRL: 'R$', USD: '$',  EUR: '€',  GBP: '£',
      JPY: '¥',  CAD: 'CA$', AUD: 'A$', CHF: 'Fr',
      CNY: '¥',  MXN: 'MX$', ARS: '$',  CLP: 'CLP$',
      COP: 'COP$', PEN: 'S/', UYU: '$U', HKD: 'HK$',
      SGD: 'S$', KRW: '₩',  INR: '₹',  NOK: 'kr',
      SEK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč',
      HUF: 'Ft', RON: 'lei', BGN: 'лв',
    }
    const currencySymbol = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode

    const action = String(body?.action ?? '').trim()

    // ── translate-template ────────────────────────────────────────────────────
    if (action === 'translate-template') {
      const contentToTranslate = String(body?.content ?? '').trim()
      const fromLang = String(body?.fromLanguage ?? '').trim()
      const toLang = String(body?.toLanguage ?? '').trim()

      if (!contentToTranslate) return jsonResponse({ error: 'content is required' }, 400)
      if (!fromLang || !toLang) return jsonResponse({ error: 'fromLanguage and toLanguage are required' }, 400)
      if (fromLang === toLang) return jsonResponse({ error: 'Source and target languages must differ' }, 400)

      const translationResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          system: [
            `You are a professional translator. Translate the template content from language "${fromLang}" to language "${toLang}".`,
            'Rules:',
            '1. If the content contains HTML tags or attributes, preserve them exactly as-is.',
            '2. Preserve ALL {{...}} template tokens exactly as-is — do not translate or modify their content.',
            '3. Return ONLY the translated content. No explanations, no markdown code blocks, no extra text.',
            '4. Maintain the same structure, formatting, and layout of the original content.',
            '5. Translate all visible human-readable text to the target language.',
          ].join('\n'),
          messages: [
            { role: 'user', content: `Translate this template content:\n\n${contentToTranslate}` },
          ],
        }),
      })

      const translationData = await translationResponse.json()
      if (!translationResponse.ok) {
        console.error('Anthropic translation error', translationData)
        return jsonResponse({ error: translationData?.error?.message ?? 'Failed to translate template', model }, 500)
      }

      const inputTokens = translationData?.usage?.input_tokens ?? 0
      const outputTokens = translationData?.usage?.output_tokens ?? 0
      const costUsd = estimateCost(model, inputTokens, outputTokens)

      adminClient.from('ai_usage_logs').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        auth_user_id: authUserId,
        user_login: profile?.github_login ?? '',
        model,
        question_chars: contentToTranslate.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        estimated_cost_usd: costUsd,
      }).then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn('ai_usage_logs insert failed:', error.message)
      })

      return jsonResponse({
        translatedContent: extractClaudeText(translationData),
        model,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costUsd },
      })
    }

    // ── chat (default) ────────────────────────────────────────────────────────
    const question = String(body?.question ?? '').trim()
    const history = Array.isArray(body?.history) ? (body.history as ChatMessage[]).slice(-8) : []

    if (!question) return jsonResponse({ error: 'Question is required' }, 400)
    if (question.length > 1200) return jsonResponse({ error: 'Question is too long' }, 400)
    if (isRestrictedQuestion(question)) {
      return jsonResponse({
        answer: RESTRICTED_ACCESS_MESSAGE,
        model,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          iterations: 0,
        },
      })
    }
    if (isWriteRequest(question)) {
      return jsonResponse({
        answer: WRITE_ACCESS_MESSAGE,
        model,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          iterations: 0,
        },
      })
    }

    const today = new Date().toISOString().slice(0, 10)

    const systemPrompt = [
      '## Limite de acesso',
      'Este assistente e somente leitura.',
      'Nunca crie, edite, atualize, aprove, remova ou exclua dados no Supabase.',
      'Se o usuario pedir qualquer alteracao de dados, recuse brevemente e explique apenas o caminho para fazer isso manualmente no sistema.',
      'Você é um assistente de IA do sistema RPM — Rental Property Manager.',
      'Responda sempre em português brasileiro, de forma objetiva e útil.',
      `Hoje é ${today}.`,
      '',
      '## Escopo obrigatório',
      `Tenant ativo: "${tenantName}" (tenant_id = ${tenantId}).`,
      'TODAS as suas consultas são restritas a este tenant.',
      'A tool query_supabase aplica o filtro tenant_id automaticamente — nunca retorna dados de outros tenants.',
      'Nunca mencione ou exponha o tenant_id em suas respostas ao usuário.',
      'Nunca consulte, resuma, liste nem exponha dados de tabelas sensíveis de usuários, tenant, permissões, logs de auditoria, bugs, fale conosco ou notificações.',
      'Se o usuário pedir qualquer informação dessas áreas, recuse brevemente e informe que o assistente só atende dados operacionais do negócio.',
      '',
      '## Instruções gerais',
      'Para responder perguntas sobre dados, use a tool query_supabase.',
      'Faça quantas chamadas forem necessárias — você pode consultar múltiplas tabelas e cruzar os resultados.',
      'Não invente IDs, valores, contratos, hóspedes, propriedades ou documentos.',
      'Se uma informação não for encontrada nas queries, diga que não encontrou nos cadastros.',
      'Se a pergunta pedir uma ação que altere dados, explique o caminho no sistema; você não altera registros diretamente.',
      '',
      '## Moeda configurada',
      `- Moeda do tenant: ${currencyCode} (símbolo: ${currencySymbol})`,
      `- Sempre exiba valores monetários com o símbolo correto: ${currencySymbol}`,
      '- Use formatação local adequada (ex: R$ 1.500,00 para BRL, $ 1,500.00 para USD)',
      '',
      '## Regras de negócio',
      '- transactions.type = "income" = Receita | "expense" = Despesa',
      '- Disponibilidade de propriedade: ocupada se houver contrato com status="active" em contract_properties; disponível caso contrário',
      '- Para listar propriedades de um contrato: query contract_properties filtrando por contract_id',
      '- Para listar proprietários de uma propriedade: query property_owners filtrando por property_id',
    ].join('\n')

    // Build messages with history
    const messages: any[] = []
    for (const h of history) {
      messages.push({ role: h.role, content: h.content })
    }
    messages.push({ role: 'user', content: question })

    // ── Agentic tool-use loop ─────────────────────────────────────────────────
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let iterations = 0
    const MAX_ITERATIONS = 10
    let finalAnswer = ''

    while (iterations < MAX_ITERATIONS) {
      iterations++

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          system: systemPrompt,
          tools: [QUERY_TOOL],
          messages,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error('Anthropic API error', responseData)
        return jsonResponse({
          error: responseData?.error?.message ?? 'Claude API error',
          model,
        }, 500)
      }

      totalInputTokens += responseData?.usage?.input_tokens ?? 0
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
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }

        messages.push({ role: 'user', content: toolResults })
        continue
      }

      // Unexpected stop reason — extract whatever text exists
      finalAnswer = extractClaudeText(responseData)
      break
    }

    if (!finalAnswer) {
      finalAnswer = 'Não consegui gerar uma resposta para essa pergunta.'
    }

    const costUsd = estimateCost(model, totalInputTokens, totalOutputTokens)

    adminClient.from('ai_usage_logs').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      auth_user_id: authUserId,
      user_login: profile?.github_login ?? '',
      model,
      question_chars: question.length,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalInputTokens + totalOutputTokens,
      estimated_cost_usd: costUsd,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn('ai_usage_logs insert failed:', error.message)
    })

    return jsonResponse({
      answer: finalAnswer,
      model,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        costUsd,
        iterations,
      },
    })
  } catch (error) {
    console.error('ai-assistant unexpected error', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected Edge Function error',
    }, 500)
  }
})
