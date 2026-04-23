import type { Language } from '@/lib/i18n'
import type { DecimalSeparator } from '@/lib/numberFormat'
import type { DateFormat } from '@/lib/DateFormatContext'

const EUROPEAN_REGIONS = new Set([
  'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO',
  'FR', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD',
  'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA', 'XK',
])

const REGION_CURRENCY_MAP: Record<string, string> = {
  AR: 'ARS',
  AU: 'AUD',
  BO: 'BOB',
  BR: 'BRL',
  CA: 'CAD',
  CH: 'CHF',
  CL: 'CLP',
  CN: 'CNY',
  CO: 'COP',
  CZ: 'CZK',
  DK: 'DKK',
  GB: 'GBP',
  HK: 'HKD',
  HU: 'HUF',
  IN: 'INR',
  JP: 'JPY',
  MX: 'MXN',
  NO: 'NOK',
  NZ: 'NZD',
  PE: 'PEN',
  PL: 'PLN',
  PY: 'PYG',
  RO: 'RON',
  SE: 'SEK',
  TR: 'TRY',
  US: 'USD',
  UY: 'UYU',
  ZA: 'ZAR',
}

export type RegionalPreferenceDefaults = {
  locale: string
  region: string | null
  language: Language
  currency: string
  dateFormat: DateFormat
  decimalSeparator: DecimalSeparator
}

function getBrowserLocale() {
  if (typeof navigator !== 'undefined') {
    const locale = navigator.languages?.find(Boolean) || navigator.language
    if (locale) return locale
  }

  return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
}

function getRegionFromLocale(locale: string) {
  try {
    const intlLocale = new Intl.Locale(locale)
    return intlLocale.region || null
  } catch {
    const parts = locale.split(/[-_]/)
    return parts[1]?.toUpperCase() || null
  }
}

function inferDateFormat(locale: string): DateFormat {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(Date.UTC(2026, 3, 23)))

    const order = parts
      .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
      .map((part) => part.type)
      .join('-')

    if (order === 'year-month-day') return 'yyyy-MM-dd'
    if (order === 'month-day-year') return 'MM/dd/yyyy'
  } catch {}

  return 'dd/MM/yyyy'
}

function inferDecimalSeparator(locale: string): DecimalSeparator {
  try {
    const decimalPart = new Intl.NumberFormat(locale).formatToParts(1234.5).find((part) => part.type === 'decimal')
    return decimalPart?.value === ',' ? ',' : '.'
  } catch {
    return '.'
  }
}

function inferCurrency(region: string | null) {
  if (!region) return 'USD'
  if (REGION_CURRENCY_MAP[region]) return REGION_CURRENCY_MAP[region]
  if (EUROPEAN_REGIONS.has(region)) return 'EUR'
  return 'USD'
}

export function detectRegionalPreferenceDefaults(): RegionalPreferenceDefaults {
  const locale = getBrowserLocale()
  const region = getRegionFromLocale(locale)

  return {
    locale,
    region,
    language: region === 'BR' || region === 'PT' ? 'pt' : 'en',
    currency: inferCurrency(region),
    dateFormat: inferDateFormat(locale),
    decimalSeparator: inferDecimalSeparator(locale),
  }
}
