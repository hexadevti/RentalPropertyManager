import { createContext, useContext, ReactNode, useMemo } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { detectRegionalPreferenceDefaults } from '@/lib/regionalPreferences'

export type Currency = string

export interface CurrencyConfig {
  code: Currency
  symbol: string
  locale: string
  name: string
}

const baseCurrencies: Record<string, CurrencyConfig> = {
  BRL: { code: 'BRL', symbol: 'R$', locale: 'pt-BR', name: 'Real Brasileiro (BRL)' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar (USD)' },
  EUR: { code: 'EUR', symbol: 'EUR', locale: 'de-DE', name: 'Euro (EUR)' },
  GBP: { code: 'GBP', symbol: 'GBP', locale: 'en-GB', name: 'British Pound (GBP)' },
}

function buildCurrencyConfig(code: string, locale: string): CurrencyConfig {
  let symbol = code
  try {
    symbol = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value || code
  } catch {}

  return {
    code,
    symbol,
    locale,
    name: code,
  }
}

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => void
  config: CurrencyConfig
  availableCurrencies: Record<string, CurrencyConfig>
  formatCurrency: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const regionalDefaults = detectRegionalPreferenceDefaults()
  const availableCurrencies = useMemo(() => {
    if (baseCurrencies[regionalDefaults.currency]) return baseCurrencies
    return {
      ...baseCurrencies,
      [regionalDefaults.currency]: buildCurrencyConfig(regionalDefaults.currency, regionalDefaults.locale),
    }
  }, [regionalDefaults.currency, regionalDefaults.locale])

  const [currency, setCurrency] = useKV<Currency>('app-currency', regionalDefaults.currency)

  const currentCurrency = currency || regionalDefaults.currency
  const config = availableCurrencies[currentCurrency] || buildCurrencyConfig(currentCurrency, regionalDefaults.locale)

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
    availableCurrencies,
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
