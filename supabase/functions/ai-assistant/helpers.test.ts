import { describe, expect, it } from 'vitest'

import {
  buildContractSummary,
  buildTransactionSummary,
  estimateCost,
  extractOutputText,
  normalizeRelationIds,
  summarizeTable,
} from './helpers'

describe('ai-assistant helpers', () => {
  it('extracts output_text directly when available', () => {
    expect(extractOutputText({ output_text: 'Resposta pronta' })).toBe('Resposta pronta')
  })

  it('extracts text from nested output content blocks', () => {
    expect(extractOutputText({
      output: [
        { content: [{ text: 'Linha 1' }, { text: 'Linha 2' }] },
        { content: [{ text: 'Linha 3' }] },
      ],
    })).toBe('Linha 1\nLinha 2\nLinha 3')
  })

  it('summarizes tables keeping only a limited sample', () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
    const summary = summarizeTable({ name: 'properties', rows })

    expect(summary.countLoaded).toBe(100)
    expect(summary.sample).toHaveLength(80)
    expect(summary.sample[0]).toEqual({ id: 1 })
    expect(summary.sample[79]).toEqual({ id: 80 })
  })

  it('normalizes relation ids for string and object relations', () => {
    expect(normalizeRelationIds(['p1', { property_id: 'p2' }, { other: 'x' }], 'property_id')).toEqual(['p1', 'p2'])
  })

  it('builds contract summary for expiring, expired and recently closed contracts', () => {
    const contextTables = [
      {
        name: 'contracts',
        rows: [
          { id: 'c1', guest_id: 'g1', status: 'active', rental_type: 'monthly', start_date: '2026-04-01', end_date: '2026-05-10', monthly_amount: 2000 },
          { id: 'c2', guest_id: 'g2', status: 'expired', rental_type: 'monthly', start_date: '2026-02-01', end_date: '2026-04-10', monthly_amount: 1800 },
          { id: 'c3', guest_id: 'g3', status: 'cancelled', rental_type: 'short-term', start_date: '2026-03-15', end_date: '2026-04-25', close_date: '2026-04-18', monthly_amount: 1500 },
          { id: 'c4', guest_id: 'g4', status: 'active', rental_type: 'monthly', start_date: '2026-01-01', end_date: '2026-05-18', monthly_amount: 2200 },
        ],
      },
      {
        name: 'guests',
        rows: [
          { id: 'g1', name: 'Maria' },
          { id: 'g2', name: 'Joao' },
          { id: 'g3', name: 'Ana' },
          { id: 'g4', name: 'Carlos' },
        ],
      },
    ]

    const summary = buildContractSummary(contextTables, new Date('2026-04-20T12:00:00.000Z'))

    expect(summary.expiring_within_30_days).toEqual([
      {
        id: 'c1',
        status: 'active',
        rental_type: 'monthly',
        start_date: '2026-04-01',
        end_date: '2026-05-10',
        close_date: undefined,
        monthly_amount: 2000,
        guest_name: 'Maria',
      },
      {
        id: 'c4',
        status: 'active',
        rental_type: 'monthly',
        start_date: '2026-01-01',
        end_date: '2026-05-18',
        close_date: undefined,
        monthly_amount: 2200,
        guest_name: 'Carlos',
      },
    ])
    expect(summary.expired_within_30_days).toEqual([
      {
        id: 'c2',
        status: 'expired',
        rental_type: 'monthly',
        start_date: '2026-02-01',
        end_date: '2026-04-10',
        close_date: undefined,
        monthly_amount: 1800,
        guest_name: 'Joao',
      },
    ])
    expect(summary.recently_closed).toEqual([
      {
        id: 'c3',
        status: 'cancelled',
        rental_type: 'short-term',
        start_date: '2026-03-15',
        end_date: '2026-04-25',
        close_date: '2026-04-18',
        monthly_amount: 1500,
        guest_name: 'Ana',
      },
    ])
    expect(summary.active_total).toBe(2)
    expect(summary.expired_total).toBe(1)
    expect(summary.cancelled_total).toBe(1)
  })

  it('builds transaction summary treating expense as despesa and income as receita', () => {
    const contextTables = [
      {
        name: 'transactions',
        rows: [
          { id: 't1', type: 'income', amount: 1000, category: 'Aluguel' },
          { id: 't2', type: 'income', amount: 500, category: 'Aluguel' },
          { id: 't3', type: 'expense', amount: 300, category: 'Limpeza' },
          { id: 't4', type: 'expense', amount: 200, category: 'Manutenção' },
          { id: 't5', type: 'expense', amount: 50, category: 'Limpeza' },
        ],
      },
    ]

    const summary = buildTransactionSummary(contextTables)

    expect(summary.transaction_type_rule).toEqual({
      income: 'Receita',
      expense: 'Despesa',
    })
    expect(summary.income_total).toBe(1500)
    expect(summary.expense_total).toBe(550)
    expect(summary.net_total).toBe(950)
    expect(summary.income_count).toBe(2)
    expect(summary.expense_count).toBe(3)
    expect(summary.top_income_categories).toEqual([
      { category: 'Aluguel', total: 1500 },
    ])
    expect(summary.top_expense_categories).toEqual([
      { category: 'Limpeza', total: 350 },
      { category: 'Manutenção', total: 200 },
    ])
  })

  it('estimates token cost using known model pricing', () => {
    expect(estimateCost('gpt-4o-mini', 1000, 500)).toBeCloseTo(0.00045, 8)
  })

  it('falls back to default pricing for unknown models', () => {
    expect(estimateCost('custom-model', 1_000_000, 1_000_000)).toBe(75)
  })
})
