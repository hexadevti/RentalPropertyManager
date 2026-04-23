import { createContext, useContext, ReactNode } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { formatDateValue, formatDateTimeValue, normalizeDateInputValue, parseDateInputValue, type DateFormatPattern } from '@/lib/dateFormat'
import { detectRegionalPreferenceDefaults } from '@/lib/regionalPreferences'

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
  formatDateTime: (date: Date | string) => string
  parseDateInput: (input: string) => Date | null
  normalizeDateInput: (input: string) => string | null
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined)

export function DateFormatProvider({ children }: { children: ReactNode }) {
  const regionalDefaults = detectRegionalPreferenceDefaults()
  const [dateFormat, setDateFormat] = useKV<DateFormat>('app-date-format', regionalDefaults.dateFormat)

  const currentDateFormat = dateFormat || regionalDefaults.dateFormat
  const config = dateFormats[currentDateFormat]
  const parseDateInput = (input: string) => parseDateInputValue(input, config.pattern)
  const normalizeDateInput = (input: string) => normalizeDateInputValue(input, config.pattern)
  const formatDate = (date: Date | string) => formatDateValue(date, config.pattern)
  const formatDateTime = (date: Date | string) => formatDateTimeValue(date, config.pattern)

  const value: DateFormatContextType = {
    dateFormat: currentDateFormat,
    setDateFormat,
    config,
    formatDate,
    formatDateTime,
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
