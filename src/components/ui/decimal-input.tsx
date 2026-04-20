import { Input } from '@/components/ui/input'
import { useNumberFormat } from '@/lib/NumberFormatContext'
import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'

type DecimalInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: number | undefined | null
  onValueChange: (value: number) => void
}

export function DecimalInput({ value, onValueChange, onBlur, ...props }: DecimalInputProps) {
  const { decimalSeparator, formatDecimalInput, parseDecimal } = useNumberFormat()
  const [displayValue, setDisplayValue] = useState(formatDecimalInput(value))
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatDecimalInput(value))
    }
  }, [formatDecimalInput, isFocused, value, decimalSeparator])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onFocus={(event) => {
        setIsFocused(true)
        if ((value ?? 0) === 0) {
          requestAnimationFrame(() => event.target.select())
        }
        props.onFocus?.(event)
      }}
      onChange={(event) => {
        const nextValue = event.target.value
        setDisplayValue(nextValue)
        onValueChange(parseDecimal(nextValue))
      }}
      onBlur={(event) => {
        setIsFocused(false)
        setDisplayValue(formatDecimalInput(parseDecimal(event.target.value)))
        onBlur?.(event)
      }}
    />
  )
}
