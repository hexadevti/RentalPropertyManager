import { createContext, useContext, ReactNode } from 'react'
import { useKV } from '@/lib/useSupabaseKV'

export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP'

export interface CurrencyConfig {
  code: Currency
  symbol: string
  locale: string
  name: string
}

export const currencies: Record<Currency, CurrencyConfig> = {
  BRL: { code: 'BRL', symbol: 'R$', locale: 'pt-BR', name: 'Real Brasileiro (BRL)' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar (USD)' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro (EUR)' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound (GBP)' },
}

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => void
  config: CurrencyConfig
  formatCurrency: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useKV<Currency>('app-currency', 'BRL')

  const currentCurrency = currency || 'BRL'
  const config = currencies[currentCurrency]

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
    }).format(amount)
  }

  const value: CurrencyContextType = {
    currency: currentCurrency,
    setCurrency,
    config,
    formatCurrency,
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
