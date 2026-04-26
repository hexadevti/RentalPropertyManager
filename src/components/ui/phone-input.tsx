import { Input } from '@/components/ui/input'
import { usePhoneFormat } from '@/lib/PhoneFormatContext'
import { onlyPhoneDigits } from '@/lib/phoneFormat'
import type { ComponentProps } from 'react'

type PhoneInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

const INVALID_PHONE_MESSAGE = 'Telefone nao corresponde a uma das mascaras configuradas.'

export function PhoneInput({ value, onValueChange, ...props }: PhoneInputProps) {
  const { formatPhone, isValidPhone, validPhoneMasks } = usePhoneFormat()
  const hasMasks = validPhoneMasks.length > 0

  return (
    <Input
      {...props}
      value={hasMasks ? formatPhone(value || '') : (value || '')}
      inputMode="tel"
      onChange={(event) => {
        const nextValue = hasMasks ? onlyPhoneDigits(event.target.value) : event.target.value
        event.target.setCustomValidity(
          isValidPhone(nextValue) ? '' : INVALID_PHONE_MESSAGE
        )
        onValueChange(nextValue)
      }}
      onBlur={(event) => {
        const nextValue = hasMasks ? onlyPhoneDigits(event.target.value) : event.target.value
        event.target.setCustomValidity(
          isValidPhone(nextValue) ? '' : INVALID_PHONE_MESSAGE
        )
        props.onBlur?.(event)
      }}
    />
  )
}
