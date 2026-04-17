import { useEffect, useMemo, useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { ptBR, enUS } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDateFormat } from '@/lib/DateFormatContext'
import { useLanguage } from '@/lib/LanguageContext'

interface DateInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
  disabled?: boolean
}

export function DateInput({ id, value, onChange, required, className, disabled }: DateInputProps) {
  const { config, formatDate, normalizeDateInput, parseDateInput } = useDateFormat()
  const { language } = useLanguage()
  const [displayValue, setDisplayValue] = useState(value ? formatDate(value) : '')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date())
  const calendarLocale = language === 'pt' ? ptBR : enUS

  const inputPattern =
    config.pattern === 'dd/MM/yyyy'
      ? '\\d{2}/\\d{2}/\\d{4}'
      : config.pattern === 'MM/dd/yyyy'
        ? '\\d{2}/\\d{2}/\\d{4}'
        : '\\d{4}-\\d{2}-\\d{2}'

  useEffect(() => {
    setDisplayValue(value ? formatDate(value) : '')
  }, [value, config.pattern])

  const selectedDate = useMemo(() => {
    if (!value) return undefined
    const parsed = parseDateInput(value)
    return parsed || undefined
  }, [value, parseDateInput])

  useEffect(() => {
    if (calendarOpen) {
      setVisibleMonth(selectedDate || new Date())
    }
  }, [calendarOpen, selectedDate])

  const commitValue = () => {
    const text = displayValue.trim()

    if (!text) {
      onChange('')
      setDisplayValue('')
      return
    }

    const normalized = normalizeDateInput(text)
    if (!normalized) {
      setDisplayValue(value ? formatDate(value) : '')
      return
    }

    onChange(normalized)
    setDisplayValue(formatDate(normalized))
  }

  const handleCalendarSelect = (date?: Date) => {
    if (!date) {
      onChange('')
      setDisplayValue('')
      return
    }

    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
    onChange(isoDate)
    setDisplayValue(formatDate(isoDate))
    setVisibleMonth(date)
    setCalendarOpen(false)
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={commitValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitValue()
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
        placeholder={config.name}
        pattern={inputPattern}
        title={config.name}
        required={required}
        disabled={disabled}
      />

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label="Open calendar"
          >
            <CalendarBlank size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            locale={calendarLocale}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
