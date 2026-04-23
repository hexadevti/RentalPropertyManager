type TableResult = {
  name: string
  rows: unknown[]
  error?: string
}

type AnyRow = Record<string, any>

export function extractOutputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text

  const parts: string[] = []
  for (const output of response?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text)
    }
  }

  return parts.join('\n').trim()
}

export function summarizeTable(table: TableResult) {
  return {
    name: table.name,
    countLoaded: table.rows.length,
    error: table.error,
    sample: table.rows.slice(0, 80),
  }
}

export function getRows(contextTables: TableResult[], tableName: string) {
  return (contextTables.find((table) => table.name === tableName)?.rows || []) as AnyRow[]
}

export function normalizeRelationIds(value: unknown, key: string) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') return (item as AnyRow)[key]
      return null
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export function buildContractSummary(contextTables: TableResult[], today = new Date()) {
  const contracts = getRows(contextTables, 'contracts')
  const guests = getRows(contextTables, 'guests')
  const todayIso = today.toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().slice(0, 10)
  const thirtyDaysFromNowIso = thirtyDaysFromNow.toISOString().slice(0, 10)

  const enrich = (contract: AnyRow) => ({
    id: contract.id,
    status: contract.status,
    rental_type: contract.rental_type,
    start_date: contract.start_date,
    end_date: contract.end_date,
    close_date: contract.close_date,
    monthly_amount: contract.monthly_amount,
    guest_name: guests.find((guest) => guest.id === contract.guest_id)?.name || null,
  })

  return {
    expiring_within_30_days: contracts
      .filter((contract) => contract.status === 'active' && contract.end_date >= todayIso && contract.end_date <= thirtyDaysFromNowIso)
      .map(enrich),
    expired_within_30_days: contracts
      .filter((contract) => contract.end_date >= thirtyDaysAgoIso && contract.end_date < todayIso)
      .map(enrich),
    recently_closed: contracts
      .filter((contract) => contract.status === 'cancelled' && contract.close_date && contract.close_date >= thirtyDaysAgoIso)
      .map(enrich),
    active_total: contracts.filter((contract) => contract.status === 'active').length,
    expired_total: contracts.filter((contract) => contract.status === 'expired').length,
    cancelled_total: contracts.filter((contract) => contract.status === 'cancelled').length,
  }
}

export function buildTransactionSummary(contextTables: TableResult[]) {
  const transactions = getRows(contextTables, 'transactions')

  const incomes = transactions.filter((transaction) => transaction.type === 'income')
  const expenses = transactions.filter((transaction) => transaction.type === 'expense')

  const sumAmounts = (rows: AnyRow[]) => rows.reduce((total, row) => {
    const amount = Number(row.amount)
    return total + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  const byCategory = (rows: AnyRow[]) => {
    const totals = new Map<string, number>()

    for (const row of rows) {
      const category = String(row.category || 'Sem categoria')
      const amount = Number(row.amount)
      if (!Number.isFinite(amount)) continue
      totals.set(category, (totals.get(category) || 0) + amount)
    }

    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
  }

  return {
    transaction_type_rule: {
      income: 'Receita',
      expense: 'Despesa',
    },
    income_total: sumAmounts(incomes),
    expense_total: sumAmounts(expenses),
    net_total: sumAmounts(incomes) - sumAmounts(expenses),
    income_count: incomes.length,
    expense_count: expenses.length,
    top_income_categories: byCategory(incomes),
    top_expense_categories: byCategory(expenses),
  }
}

export const MODEL_PRICING: Record<string, [number, number]> = {
  // Claude models (input $/1M, output $/1M)
  'claude-sonnet-4-6': [3.0, 15.0],
  'claude-opus-4-7': [15.0, 75.0],
  'claude-haiku-4-5-20251001': [0.8, 4.0],
  // Legacy OpenAI (kept for backwards-compat with ai_usage_logs)
  'gpt-4o': [2.5, 10.0],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-5': [15.0, 60.0],
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inputRate, outputRate] = MODEL_PRICING[model] ?? [3.0, 15.0]
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
}
