import { Input } from '@/components/ui/input'
import { onlyPhoneDigits } from '@/lib/phoneFormat'
import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguageOptional } from '@/lib/LanguageContext'

type PhoneInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

const INVALID_PHONE_MESSAGE = 'Informe um telefone internacional valido.'

type CountryOption = {
  iso2: CountryCode
  name: string
  dialCode: string
  flag: string
}

const DEFAULT_DIAL_CODE = '+55'
const E164_REGEX = /^\+[1-9]\d{6,14}$/

function toFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}

const BASE_COUNTRY_OPTIONS = getCountries().map((iso2) => ({
  iso2,
  dialCode: `+${getCountryCallingCode(iso2)}`,
  flag: toFlagEmoji(iso2),
}))

const DIAL_CODES_DESC = Array.from(new Set(BASE_COUNTRY_OPTIONS.map((option) => option.dialCode)))
  .sort((a, b) => b.length - a.length)

function resolveIntlLocales(language: string) {
  return language === 'en' ? ['en', 'pt-BR'] : ['pt-BR', 'en']
}

function buildCountryOptions(language: string): CountryOption[] {
  const intl = typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(resolveIntlLocales(language), { type: 'region' })
    : null

  return BASE_COUNTRY_OPTIONS
    .map((country) => ({
      ...country,
      name: intl?.of(country.iso2) || country.iso2,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, language === 'en' ? 'en' : 'pt-BR'))
}

function parseInternationalPhone(value: string) {
  const raw = (value || '').trim()
  if (!raw.startsWith('+')) {
    return { dialCode: DEFAULT_DIAL_CODE, localNumber: onlyPhoneDigits(raw) }
  }

  const matchedDialCode = DIAL_CODES_DESC.find((dialCode) => raw.startsWith(dialCode))
  if (!matchedDialCode) {
    return { dialCode: DEFAULT_DIAL_CODE, localNumber: onlyPhoneDigits(raw) }
  }

  return {
    dialCode: matchedDialCode,
    localNumber: onlyPhoneDigits(raw.slice(matchedDialCode.length)),
  }
}

function composeInternationalPhone(dialCode: string, localNumber: string) {
  const digits = onlyPhoneDigits(localNumber)
  if (!digits) return ''
  return `${dialCode}${digits}`
}

function resolveCountryByDialCode(dialCode: string, countryOptions: CountryOption[]): CountryOption {
  return countryOptions.find((country) => country.dialCode === dialCode)
    || countryOptions.find((country) => country.dialCode === DEFAULT_DIAL_CODE)
    || countryOptions[0]
}

export function PhoneInput({ value, onValueChange, ...props }: PhoneInputProps) {
  const { language, t } = useLanguageOptional()
  const parsedValue = useMemo(() => parseInternationalPhone(value), [value])
  const countryOptions = useMemo(() => buildCountryOptions(language), [language])
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(() => resolveCountryByDialCode(parsedValue.dialCode, countryOptions))
  const [localNumber, setLocalNumber] = useState(parsedValue.localNumber)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)

  useEffect(() => {
    setSelectedCountry(resolveCountryByDialCode(parsedValue.dialCode, countryOptions))
    setLocalNumber(parsedValue.localNumber)
  }, [parsedValue.dialCode, parsedValue.localNumber, countryOptions])

  const countrySearchPlaceholder = t.common.phone_country_search_placeholder
  const countryEmptyLabel = t.common.phone_country_empty

  const fullValue = composeInternationalPhone(selectedCountry.dialCode, localNumber)
  const isValid = !fullValue || E164_REGEX.test(fullValue)

  return (
    <div className="flex gap-2">
      <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={countryPickerOpen}
            className="w-[110px] justify-between px-2"
          >
            <span className="truncate text-left">
              {selectedCountry.flag} {selectedCountry.dialCode}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start" portal={false}>
          <Command>
            <CommandInput placeholder={countrySearchPlaceholder} />
            <CommandList>
              <CommandEmpty>{countryEmptyLabel}</CommandEmpty>
              {countryOptions.map((option) => (
                <CommandItem
                  key={option.iso2}
                  value={`${option.name} ${option.iso2} ${option.dialCode}`}
                  onSelect={() => {
                    setSelectedCountry(option)
                    onValueChange(composeInternationalPhone(option.dialCode, localNumber))
                    setCountryPickerOpen(false)
                  }}
                >
                  <span className="w-6">{option.flag}</span>
                  <span className="flex-1 truncate">{option.name}</span>
                  <span className="text-muted-foreground">{option.dialCode}</span>
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4',
                      selectedCountry.iso2 === option.iso2 ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        {...props}
        value={localNumber}
        inputMode="tel"
        onChange={(event) => {
          const nextLocalNumber = onlyPhoneDigits(event.target.value)
          const nextValue = composeInternationalPhone(selectedCountry.dialCode, nextLocalNumber)
          event.target.setCustomValidity(nextValue && !E164_REGEX.test(nextValue) ? INVALID_PHONE_MESSAGE : '')
          setLocalNumber(nextLocalNumber)
          onValueChange(nextValue)
        }}
        onBlur={(event) => {
          event.target.setCustomValidity(isValid ? '' : INVALID_PHONE_MESSAGE)
          props.onBlur?.(event)
        }}
      />
    </div>
  )
}
