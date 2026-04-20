import { createContext, ReactNode, useContext } from 'react'
import { useKV } from '@/lib/useSupabaseKV'

export const phoneMasks = [
  { value: '(xx) xxxxx-xxxx', label: '(xx) xxxxx-xxxx' },
  { value: '(xx) xxxx-xxxx', label: '(xx) xxxx-xxxx' },
  { value: 'xxxxx-xxxx', label: 'xxxxx-xxxx' },
  { value: 'xxxx-xxxx', label: 'xxxx-xxxx' },
] as const

export type PhoneMask = typeof phoneMasks[number]['value']

interface PhoneFormatContextType {
  validPhoneMasks: string[]
  setValidPhoneMasks: (masks: string[]) => void
  formatPhone: (value: string) => string
  isValidPhone: (value: string) => boolean
}

const PhoneFormatContext = createContext<PhoneFormatContextType | undefined>(undefined)

export function onlyPhoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function applyPhoneMask(value: string, mask: PhoneMask) {
  const digits = onlyPhoneDigits(value)
  let index = 0
  let formatted = ''

  for (const char of mask) {
    if (char.toLowerCase() === 'x') {
      if (index >= digits.length) break
      formatted += digits[index]
      index += 1
      continue
    }

    if (index < digits.length) formatted += char
  }

  return formatted
}

function countMaskDigits(mask: string) {
  return (mask.match(/x/gi) || []).length
}

function sanitizeMasks(masks: string[]) {
  return Array.from(new Set(
    masks
      .map((mask) => mask.trim())
      .filter((mask) => countMaskDigits(mask) > 0)
  ))
}

function chooseMaskForValue(value: string, masks: string[]) {
  const digitsLength = onlyPhoneDigits(value).length
  const ordered = sanitizeMasks(masks).sort((a, b) => countMaskDigits(a) - countMaskDigits(b))
  return ordered.find((mask) => countMaskDigits(mask) >= digitsLength)
    || ordered[ordered.length - 1]
    || '(xx) xxxxx-xxxx'
}

export function PhoneFormatProvider({ children }: { children: ReactNode }) {
  const [savedPhoneMasks, setSavedPhoneMasks] = useKV<string[]>('app-phone-masks', phoneMasks.map((mask) => mask.value))

  const validPhoneMasks = sanitizeMasks(savedPhoneMasks?.length ? savedPhoneMasks : phoneMasks.map((mask) => mask.value))

  return (
    <PhoneFormatContext.Provider
      value={{
        validPhoneMasks,
        setValidPhoneMasks: (masks) => setSavedPhoneMasks(sanitizeMasks(masks)),
        formatPhone: (value) => applyPhoneMask(value, chooseMaskForValue(value, validPhoneMasks) as PhoneMask),
        isValidPhone: (value) => {
          const digitsLength = onlyPhoneDigits(value).length
          if (digitsLength === 0) return true
          return validPhoneMasks.some((mask) => countMaskDigits(mask) === digitsLength)
        },
      }}
    >
      {children}
    </PhoneFormatContext.Provider>
  )
}

export function usePhoneFormat() {
  const context = useContext(PhoneFormatContext)
  if (!context) {
    throw new Error('usePhoneFormat must be used within a PhoneFormatProvider')
  }
  return context
}
