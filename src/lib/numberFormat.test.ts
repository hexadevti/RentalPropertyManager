import { describe, expect, it } from 'vitest'

import { formatDecimalInputValue, parseDecimalValue, resolveDecimalSeparator } from '@/lib/numberFormat'

describe('numberFormat', () => {
  it('parses decimal values using comma as decimal separator', () => {
    expect(parseDecimalValue('1.234,56', ',')).toBe(1234.56)
  })

  it('parses decimal values using dot as decimal separator', () => {
    expect(parseDecimalValue('1,234.56', '.')).toBe(1234.56)
  })

  it('parses negative values and ignores currency symbols', () => {
    expect(parseDecimalValue('R$ -1.234,56', ',')).toBe(-1234.56)
  })

  it('returns zero for empty values', () => {
    expect(parseDecimalValue('   ', ',')).toBe(0)
  })

  it('returns zero for invalid values', () => {
    expect(parseDecimalValue('abc', '.')).toBe(0)
  })

  it('formats decimal input with the selected separator', () => {
    expect(formatDecimalInputValue(1234.56, ',')).toBe('1234,56')
    expect(formatDecimalInputValue(1234.56, '.')).toBe('1234.56')
  })

  it('returns empty string for nullish or NaN values', () => {
    expect(formatDecimalInputValue(undefined, ',')).toBe('')
    expect(formatDecimalInputValue(null, '.')).toBe('')
    expect(formatDecimalInputValue(Number.NaN, '.')).toBe('')
  })

  it('resolves default separator by language when there is no saved value', () => {
    expect(resolveDecimalSeparator('pt', null)).toBe(',')
    expect(resolveDecimalSeparator('en', undefined)).toBe('.')
  })

  it('prefers the saved separator over language default', () => {
    expect(resolveDecimalSeparator('pt', '.')).toBe('.')
  })
})
