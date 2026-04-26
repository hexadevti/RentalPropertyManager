import { createContext, ReactNode, useContext } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { formatDecimalInputValue, parseDecimalValue, type DecimalSeparator } from '@/lib/numberFormat'
import { detectRegionalPreferenceDefaults } from '@/lib/regionalPreferences'

interface NumberFormatContextType {
  decimalSeparator: DecimalSeparator
  setDecimalSeparator: (separator: DecimalSeparator) => void
  parseDecimal: (value: string) => number
  formatDecimalInput: (value: number | undefined | null) => string
}

const NumberFormatContext = createContext<NumberFormatContextType | undefined>(undefined)

export function NumberFormatProvider({ children }: { children: ReactNode }) {
  const regionalDefaults = detectRegionalPreferenceDefaults()
  const [savedDecimalSeparator, setSavedDecimalSeparator] = useKV<DecimalSeparator | null>('app-decimal-separator', null)

  const decimalSeparator = savedDecimalSeparator || regionalDefaults.decimalSeparator
  const parseDecimal = (value: string) => parseDecimalValue(value, decimalSeparator)
  const formatDecimalInput = (value: number | undefined | null) => formatDecimalInputValue(value, decimalSeparator)

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
