import { format, isValid, parse, parseISO } from 'date-fns'

export type DateFormatPattern = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd'

export function parseDateInputValue(input: string, pattern: DateFormatPattern): Date | null {
  const text = input.trim()
  if (!text) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsedIso = parseISO(text)
    return isValid(parsedIso) ? parsedIso : null
  }

  const parsed = parse(text, pattern, new Date())
  if (!isValid(parsed)) return null

  return format(parsed, pattern) === text ? parsed : null
}

export function normalizeDateInputValue(input: string, pattern: DateFormatPattern): string | null {
  const parsed = parseDateInputValue(input, pattern)
  if (!parsed) return null
  return format(parsed, 'yyyy-MM-dd')
}

export function formatDateValue(date: Date | string, pattern: DateFormatPattern): string {
  const parsedDate = typeof date === 'string' ? parseDateInputValue(date, pattern) : date
  if (!parsedDate || !isValid(parsedDate)) {
    return ''
  }

  return format(parsedDate, pattern)
}
