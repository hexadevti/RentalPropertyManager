import { describe, expect, it } from 'vitest'

import { formatDateValue, normalizeDateInputValue, parseDateInputValue } from '@/lib/dateFormat'

describe('dateFormat', () => {
  it('parses a valid date in dd/MM/yyyy format', () => {
    expect(parseDateInputValue('20/04/2026', 'dd/MM/yyyy')?.toISOString().slice(0, 10)).toBe('2026-04-20')
  })

  it('parses a valid date in MM/dd/yyyy format', () => {
    expect(parseDateInputValue('04/20/2026', 'MM/dd/yyyy')?.toISOString().slice(0, 10)).toBe('2026-04-20')
  })

  it('accepts ISO dates independently of the configured format', () => {
    expect(parseDateInputValue('2026-04-20', 'dd/MM/yyyy')?.toISOString().slice(0, 10)).toBe('2026-04-20')
  })

  it('rejects impossible dates with strict parsing', () => {
    expect(parseDateInputValue('32/01/2026', 'dd/MM/yyyy')).toBeNull()
    expect(parseDateInputValue('02/30/2026', 'MM/dd/yyyy')).toBeNull()
  })

  it('rejects values that do not match the configured pattern', () => {
    expect(parseDateInputValue('04/20/2026', 'dd/MM/yyyy')).toBeNull()
  })

  it('normalizes a valid date input to ISO format', () => {
    expect(normalizeDateInputValue('20/04/2026', 'dd/MM/yyyy')).toBe('2026-04-20')
  })

  it('returns null when normalization receives invalid input', () => {
    expect(normalizeDateInputValue('20-04-2026', 'dd/MM/yyyy')).toBeNull()
  })

  it('formats ISO strings using the configured pattern', () => {
    expect(formatDateValue('2026-04-20', 'dd/MM/yyyy')).toBe('20/04/2026')
    expect(formatDateValue('2026-04-20', 'MM/dd/yyyy')).toBe('04/20/2026')
  })

  it('returns empty string for invalid date strings', () => {
    expect(formatDateValue('invalid-date', 'dd/MM/yyyy')).toBe('')
  })
})
