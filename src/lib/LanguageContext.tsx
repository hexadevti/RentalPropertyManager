import { createContext, useContext, ReactNode } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { translations, Language } from './i18n'
import { detectRegionalPreferenceDefaults } from '@/lib/regionalPreferences'

type Translations = typeof translations.pt | typeof translations.en

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const regionalDefaults = detectRegionalPreferenceDefaults()
  const [language, setLanguage] = useKV<Language>('app-language', regionalDefaults.language)

  const currentLang = language || regionalDefaults.language

  const value: LanguageContextType = {
    language: currentLang,
    setLanguage,
    t: translations[currentLang] as Translations,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export function useLanguageOptional(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (context) return context

  return {
    language: 'pt',
    setLanguage: () => {},
    t: translations.pt,
  }
}
