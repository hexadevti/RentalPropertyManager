import { createContext, useContext, ReactNode } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { formatDateValue, normalizeDateInputValue, parseDateInputValue, type DateFormatPattern } from '@/lib/dateFormat'

export type DateFormat = DateFormatPattern

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
  const parseDateInput = (input: string) => parseDateInputValue(input, config.pattern)
  const normalizeDateInput = (input: string) => normalizeDateInputValue(input, config.pattern)
  const formatDate = (date: Date | string) => formatDateValue(date, config.pattern)

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
