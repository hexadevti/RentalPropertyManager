import { Input } from '@/components/ui/input'
import { onlyPhoneDigits, usePhoneFormat } from '@/lib/PhoneFormatContext'
import type { ComponentProps } from 'react'

type PhoneInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

export function PhoneInput({ value, onValueChange, ...props }: PhoneInputProps) {
  const { formatPhone, isValidPhone } = usePhoneFormat()

  return (
    <Input
      {...props}
      value={formatPhone(value || '')}
      inputMode="tel"
      onChange={(event) => {
        const digits = onlyPhoneDigits(event.target.value)
        event.target.setCustomValidity(
          isValidPhone(digits) ? '' : 'Telefone não corresponde a uma das máscaras configuradas.'
        )
        onValueChange(digits)
      }}
      onBlur={(event) => {
        const digits = onlyPhoneDigits(event.target.value)
        event.target.setCustomValidity(
          isValidPhone(digits) ? '' : 'Telefone não corresponde a uma das máscaras configuradas.'
        )
        props.onBlur?.(event)
      }}
    />
  )
}
