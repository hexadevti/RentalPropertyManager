import { createContext, ReactNode, useContext, useMemo } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { formatPhoneByMasks, isValidPhoneByMasks, sanitizeMasks } from '@/lib/phoneFormat'

export const phoneMasks = [
  { value: '(xx) xxxxx-xxxx', label: '(xx) xxxxx-xxxx' },
  { value: '(xx) xxxx-xxxx', label: '(xx) xxxx-xxxx' },
  { value: '+1 (xxx) xxx-xxxx', label: '+1 (xxx) xxx-xxxx' },
  { value: '+xx xx xxxx xxxx', label: '+xx xx xxxx xxxx' },
] as const

export type PhoneMask = typeof phoneMasks[number]['value']

interface PhoneFormatContextType {
  validPhoneMasks: string[]
  setValidPhoneMasks: (masks: string[]) => void
  formatPhone: (value: string) => string
  isValidPhone: (value: string) => boolean
}

const PhoneFormatContext = createContext<PhoneFormatContextType | undefined>(undefined)

export function PhoneFormatProvider({ children }: { children: ReactNode }) {
  const [savedPhoneMasks, setSavedPhoneMasks] = useKV<string[]>('app-phone-masks', [])

  const normalizedSavedPhoneMasks = useMemo(
    () => sanitizeMasks(savedPhoneMasks?.length ? savedPhoneMasks : []),
    [savedPhoneMasks]
  )

  const validPhoneMasks = normalizedSavedPhoneMasks

  return (
    <PhoneFormatContext.Provider
      value={{
        validPhoneMasks,
        setValidPhoneMasks: (masks) => setSavedPhoneMasks(sanitizeMasks(masks)),
        formatPhone: (value) => formatPhoneByMasks(value, validPhoneMasks),
        isValidPhone: (value) => isValidPhoneByMasks(value, validPhoneMasks),
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
