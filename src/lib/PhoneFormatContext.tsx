import { createContext, ReactNode, useContext } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { formatPhoneByMasks, isValidPhoneByMasks, sanitizeMasks } from '@/lib/phoneFormat'

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

export function PhoneFormatProvider({ children }: { children: ReactNode }) {
  const [savedPhoneMasks, setSavedPhoneMasks] = useKV<string[]>('app-phone-masks', phoneMasks.map((mask) => mask.value))

  const validPhoneMasks = sanitizeMasks(savedPhoneMasks?.length ? savedPhoneMasks : phoneMasks.map((mask) => mask.value))

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
