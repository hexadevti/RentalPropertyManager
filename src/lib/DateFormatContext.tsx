import { createContext, useContext, ReactNode } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { format, isValid, parse, parseISO } from 'date-fns'

export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd'

export interface DateFormatConfig {
  pattern: DateFormat
  name: string
}

export const dateFormats: Record<DateFormat, DateFormatConfig> = {
  'dd/MM/yyyy': { pattern: 'dd/MM/yyyy', name: 'DD/MM/YYYY' },
  'MM/dd/yyyy': { pattern: 'MM/dd/yyyy', name: 'MM/DD/YYYY' },
  'yyyy-MM-dd': { pattern: 'yyyy-MM-dd', name: 'YYYY-MM-DD' },
}

interface DateFormatContextType {
  dateFormat: DateFormat
  setDateFormat: (dateFormat: DateFormat) => void
  config: DateFormatConfig
  formatDate: (date: Date | string) => string
  parseDateInput: (input: string) => Date | null
  normalizeDateInput: (input: string) => string | null
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined)

export function DateFormatProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormat] = useKV<DateFormat>('app-date-format', 'dd/MM/yyyy')

  const currentDateFormat = dateFormat || 'dd/MM/yyyy'
  const config = dateFormats[currentDateFormat]

  const parseDateInput = (input: string): Date | null => {
    const text = input.trim()
    if (!text) return null

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const parsedIso = parseISO(text)
      return isValid(parsedIso) ? parsedIso : null
    }

    const parsed = parse(text, config.pattern, new Date())
    if (!isValid(parsed)) return null

    // Enforce strict parsing so values like 32/01/2026 are rejected.
    return format(parsed, config.pattern) === text ? parsed : null
  }

  const normalizeDateInput = (input: string): string | null => {
    const parsed = parseDateInput(input)
    if (!parsed) return null
    return format(parsed, 'yyyy-MM-dd')
  }

  const formatDate = (date: Date | string): string => {
    const parsedDate = typeof date === 'string' ? parseDateInput(date) : date
    if (!parsedDate || !isValid(parsedDate)) {
      return ''
    }
    return format(parsedDate, config.pattern)
  }

  const value: DateFormatContextType = {
    dateFormat: currentDateFormat,
    setDateFormat,
    config,
    formatDate,
    parseDateInput,
    normalizeDateInput,
  }

  return (
    <DateFormatContext.Provider value={value}>
      {children}
    </DateFormatContext.Provider>
  )
}

export function useDateFormat() {
  const context = useContext(DateFormatContext)
  if (!context) {
    throw new Error('useDateFormat must be used within a DateFormatProvider')
  }
  return context
}
