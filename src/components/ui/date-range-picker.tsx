import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarBlank, X } from '@phosphor-icons/react'
import { ptBR, enUS } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDateFormat } from '@/lib/DateFormatContext'
import { useLanguage } from '@/lib/LanguageContext'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (value: DateRange | undefined) => void
  placeholder: string
  className?: string
  align?: 'center' | 'start' | 'end'
  disabled?: (date: Date) => boolean
}

export function DateRangePicker({
  value,
  onChange,
  placeholder,
  className,
  align = 'end',
  disabled,
}: DateRangePickerProps) {
  const { formatDate } = useDateFormat()
  const { language } = useLanguage()
  const [open, setOpen] = useState(false)
  const calendarLocale = language === 'pt' ? ptBR : enUS

  const triggerLabel = useMemo(() => {
    if (value?.from && value?.to) {
      return `${formatDate(value.from)} - ${formatDate(value.to)}`
    }
    if (value?.from) {
      return `${formatDate(value.from)} - ...`
    }
    return placeholder
  }, [formatDate, placeholder, value])

  const handleClear = () => {
    onChange(undefined)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={className}>
            <CalendarBlank weight="bold" size={16} className="mr-2 shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-3" align={align}>
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            locale={calendarLocale}
            numberOfMonths={1}
            disabled={disabled}
            className="mx-auto w-fit"
          />
        </PopoverContent>
      </Popover>

      {(value?.from || value?.to) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleClear}
          aria-label="Clear date range"
        >
          <X size={16} />
        </Button>
      )}
    </div>
  )
}
