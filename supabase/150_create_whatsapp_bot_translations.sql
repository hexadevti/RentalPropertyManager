-- Stores user-facing bot messages for the WhatsApp bot in multiple languages.
-- The edge function loads these at request time and falls back to hardcoded EN defaults.
-- Adding a new language requires only INSERT statements — no function redeployment needed.

create table if not exists whatsapp_bot_translations (
  language text not null,
  key      text not null,
  value    text not null,
  constraint whatsapp_bot_translations_pkey primary key (language, key)
);

-- Service role bypasses RLS; no user-facing access needed.
alter table whatsapp_bot_translations enable row level security;

-- ── English (EN) seed ────────────────────────────────────────────────────────

insert into whatsapp_bot_translations (language, key, value) values
  ('en', 'system.methodNotAllowed',     'Method not allowed'),
  ('en', 'system.serviceUnavailable',   'Service temporarily unavailable.'),
  ('en', 'system.invalidNumber',        'Invalid number.'),

  ('en', 'aiPlan.tokenLimitReached',    'Monthly AI token limit reached for the current plan. Upgrade to continue using AI features.'),
  ('en', 'aiPlan.blockedByPlan',        'AI features are blocked for the current plan. Change the plan to enable access.'),
  ('en', 'aiPlan.unavailable',          'AI access is unavailable for the current plan.'),

  ('en', 'tenantSelection.title',       '🏢 You have access to more than one account.'),
  ('en', 'tenantSelection.instruction', 'Reply with the account number to continue (for example: 1) or use /tenant 1.'),
  ('en', 'tenantSelection.currentMarker', ' (current)'),
  ('en', 'tenantSelection.selected',    E'✅ Account selected: {tenantName}.\nNow send your question.'),

  ('en', 'replies.phoneNotRegistered',  E'❌ This number is not registered in the RPM system.\n\nAsk an administrator to add your phone number to your user profile.'),
  ('en', 'replies.authNotLinked',       '❌ Your user is not linked to an authenticated account yet. Ask an administrator to finish the access setup.'),
  ('en', 'replies.accessPendingApproval', '⏳ Your access is pending administrator approval.'),
  ('en', 'replies.accessBlocked',       '🚫 Your access is blocked. Contact the administrator.'),
  ('en', 'replies.noApprovedTenant',    '❌ I could not find an approved account for this user.'),
  ('en', 'replies.noAvailableTenants',  '❌ I could not find available accounts for this user.'),
  ('en', 'replies.clearConversation',   '🗑️ Conversation cleared. You can start a new request now.'),
  ('en', 'replies.fallbackError',       'I could not generate a response. Please try again shortly.'),
  ('en', 'replies.truncatedSuffix',     E'\n\n_(response truncated)_'),

  ('en', 'help.title',                  '🤖 *RPM Assistant - WhatsApp*'),
  ('en', 'help.intro',                  'Ask questions about your portfolio in natural language. Examples:'),
  ('en', 'help.examples',               E'• Which properties are available?\n• What is the financial balance for this month?\n• Are there contracts ending in the next 30 days?\n• List the pending tasks'),
  ('en', 'help.commandsTitle',          '*Commands:*'),
  ('en', 'help.commands',               E'/limpar - clears the conversation history\n/tenant - shows the available accounts\n/ajuda - shows this message'),

  ('en', 'prompt.assistantRole',        'You are the RPM AI assistant - Rental Property Manager, replying through WhatsApp.'),
  ('en', 'prompt.responseStyle',        'Reply in English, clearly and concisely.'),
  ('en', 'prompt.todayLine',            'Today is {today}.'),
  ('en', 'prompt.scopeTitle',           '## Required scope'),
  ('en', 'prompt.activeAccountLine',    'Active account: "{tenantName}" (tenant_id = {tenantId}).'),
  ('en', 'prompt.tenantRestricted',     'ALL queries are restricted to this account. Never mention the tenant_id in your answers.'),
  ('en', 'prompt.formattingTitle',      '## WhatsApp formatting'),
  ('en', 'prompt.formattingRules',      E'- Use plain text; avoid markdown such as #, **, etc.\n- Use *single asterisks* for bold\n- For lists, use "•" or "-" at the start of the line\n- Be concise; shorter messages work better on WhatsApp\n- Maximum of 3-4 paragraphs per answer'),
  ('en', 'prompt.instructionsTitle',    '## Instructions'),
  ('en', 'prompt.instructionLines',     E'Use the query_supabase tool to answer data questions.\nMake as many calls as needed for an accurate answer.\nDo not invent data; if you cannot find it, say so.'),
  ('en', 'prompt.currencyTitle',        '## Currency'),
  ('en', 'prompt.currencyLine',         '- Configured currency: {currencyCode} ({currencySymbol}) - always use this symbol for values'),
  ('en', 'prompt.businessRulesTitle',   '## Business rules'),
  ('en', 'prompt.businessRules',        E'- transactions.type = "income" = Income | "expense" = Expense\n- Property occupied = active contract exists in contract_properties\n- For contract properties: query contract_properties filtered by contract_id'),
  ('en', 'prompt.helpHint',             'Tell the user they can use /ajuda to see the available commands.');

-- ── Portuguese (PT) seed ─────────────────────────────────────────────────────

insert into whatsapp_bot_translations (language, key, value) values
  ('pt', 'system.methodNotAllowed',     'Método não permitido'),
  ('pt', 'system.serviceUnavailable',   'Serviço temporariamente indisponível.'),
  ('pt', 'system.invalidNumber',        'Número inválido.'),

  ('pt', 'aiPlan.tokenLimitReached',    'Limite mensal de tokens de IA atingido para o plano atual. Faça upgrade para continuar usando funcionalidades de IA.'),
  ('pt', 'aiPlan.blockedByPlan',        'Funcionalidades de IA estão bloqueadas para o plano atual. Ajuste o plano para habilitar o acesso.'),
  ('pt', 'aiPlan.unavailable',          'Acesso de IA indisponível para o plano atual.'),

  ('pt', 'tenantSelection.title',       '🏢 Você tem acesso a mais de uma conta.'),
  ('pt', 'tenantSelection.instruction', 'Responda com o número da conta para continuar (ex.: 1) ou use /tenant 1.'),
  ('pt', 'tenantSelection.currentMarker', ' (atual)'),
  ('pt', 'tenantSelection.selected',    E'✅ Conta selecionada: {tenantName}.\nAgora envie sua pergunta.'),

  ('pt', 'replies.phoneNotRegistered',  E'❌ Número não cadastrado no sistema RPM.\n\nSolicite a um administrador que cadastre seu telefone no seu perfil de usuário.'),
  ('pt', 'replies.authNotLinked',       '❌ Seu usuário ainda não está vinculado a uma conta autenticada. Solicite ao administrador para concluir o vínculo de acesso.'),
  ('pt', 'replies.accessPendingApproval', '⏳ Seu acesso está pendente de aprovação pelo administrador.'),
  ('pt', 'replies.accessBlocked',       '🚫 Seu acesso está bloqueado. Entre em contato com o administrador.'),
  ('pt', 'replies.noApprovedTenant',    '❌ Não encontrei uma conta aprovada para este usuário.'),
  ('pt', 'replies.noAvailableTenants',  '❌ Não encontrei contas disponíveis para este usuário.'),
  ('pt', 'replies.clearConversation',   '🗑️ Conversa limpa. Pode começar uma nova consulta.'),
  ('pt', 'replies.fallbackError',       'Não consegui gerar uma resposta. Tente novamente em instantes.'),
  ('pt', 'replies.truncatedSuffix',     E'\n\n_(resposta truncada)_'),

  ('pt', 'help.title',                  '🤖 *Assistente RPM - WhatsApp*'),
  ('pt', 'help.intro',                  'Faça perguntas sobre seu portfólio em linguagem natural. Exemplos:'),
  ('pt', 'help.examples',               E'• Quais propriedades estão disponíveis?\n• Qual o saldo financeiro do mês?\n• Há contratos vencendo nos próximos 30 dias?\n• Liste as tarefas pendentes'),
  ('pt', 'help.commandsTitle',          '*Comandos:*'),
  ('pt', 'help.commands',               E'/limpar - apaga o histórico da conversa\n/tenant - mostra as contas disponíveis\n/ajuda - exibe esta mensagem'),

  ('pt', 'prompt.assistantRole',        'Você é o assistente de IA do RPM - Rental Property Manager, respondendo via WhatsApp.'),
  ('pt', 'prompt.responseStyle',        'Responda em português brasileiro, de forma objetiva e concisa.'),
  ('pt', 'prompt.todayLine',            'Hoje é {today}.'),
  ('pt', 'prompt.scopeTitle',           '## Escopo obrigatório'),
  ('pt', 'prompt.activeAccountLine',    'Conta ativa: "{tenantName}" (tenant_id = {tenantId}).'),
  ('pt', 'prompt.tenantRestricted',     'TODAS as consultas são restritas a esta conta. Nunca mencione o tenant_id nas respostas.'),
  ('pt', 'prompt.formattingTitle',      '## Formatação para WhatsApp'),
  ('pt', 'prompt.formattingRules',      E'- Use texto simples; evite markdown como #, **, etc.\n- Para negrito use *asteriscos simples*\n- Para listas use "•" ou "-" no início da linha\n- Seja conciso; mensagens curtas funcionam melhor no WhatsApp\n- Máximo de 3-4 parágrafos por resposta'),
  ('pt', 'prompt.instructionsTitle',    '## Instruções'),
  ('pt', 'prompt.instructionLines',     E'Para responder perguntas sobre dados, use a tool query_supabase.\nFaça quantas chamadas forem necessárias para uma resposta precisa.\nNão invente dados; se não encontrar, diga que não encontrou.'),
  ('pt', 'prompt.currencyTitle',        '## Moeda'),
  ('pt', 'prompt.currencyLine',         '- Moeda configurada: {currencyCode} ({currencySymbol}) - use sempre este símbolo nos valores'),
  ('pt', 'prompt.businessRulesTitle',   '## Regras de negócio'),
  ('pt', 'prompt.businessRules',        E'- transactions.type = "income" = Receita | "expense" = Despesa\n- Propriedade ocupada = contrato ativo em contract_properties\n- Para propriedades de um contrato: query contract_properties filtrando por contract_id'),
  ('pt', 'prompt.helpHint',             'Informe ao usuário que pode usar /ajuda para ver os comandos disponíveis.');
