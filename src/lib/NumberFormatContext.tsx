import { createContext, ReactNode, useContext } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { useLanguage } from '@/lib/LanguageContext'

export type DecimalSeparator = ',' | '.'

interface NumberFormatContextType {
  decimalSeparator: DecimalSeparator
  setDecimalSeparator: (separator: DecimalSeparator) => void
  parseDecimal: (value: string) => number
  formatDecimalInput: (value: number | undefined | null) => string
}

const NumberFormatContext = createContext<NumberFormatContextType | undefined>(undefined)

export function NumberFormatProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage()
  const [savedDecimalSeparator, setSavedDecimalSeparator] = useKV<DecimalSeparator | null>('app-decimal-separator', null)

  const decimalSeparator: DecimalSeparator = savedDecimalSeparator || (language === 'pt' ? ',' : '.')

  const parseDecimal = (value: string): number => {
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

  const formatDecimalInput = (value: number | undefined | null): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return ''
    return String(value).replace('.', decimalSeparator)
  }

  return (
    <NumberFormatContext.Provider
      value={{
        decimalSeparator,
        setDecimalSeparator: setSavedDecimalSeparator,
        parseDecimal,
        formatDecimalInput,
      }}
    >
      {children}
    </NumberFormatContext.Provider>
  )
}

export function useNumberFormat() {
  const context = useContext(NumberFormatContext)
  if (!context) {
    throw new Error('useNumberFormat must be used within a NumberFormatProvider')
  }
  return context
}
