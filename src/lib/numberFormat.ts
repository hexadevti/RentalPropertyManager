export type DecimalSeparator = ',' | '.'

export function parseDecimalValue(value: string, decimalSeparator: DecimalSeparator): number {
  const normalizedInput = value.trim()
  if (!normalizedInput) return 0

  const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
  const normalized = normalizedInput
    .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
    .replace(decimalSeparator, '.')
    .replace(/[^\d.-]/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatDecimalInputValue(value: number | undefined | null, decimalSeparator: DecimalSeparator): string {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  return String(value).replace('.', decimalSeparator)
}

export function resolveDecimalSeparator(language: 'pt' | 'en', savedSeparator: DecimalSeparator | null | undefined): DecimalSeparator {
  return savedSeparator || (language === 'pt' ? ',' : '.')
}
