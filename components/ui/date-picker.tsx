'use client'

import { format, isValid, parse } from 'date-fns'
import { enUS, vi, zhCN } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** 内部统一存储的日期格式 — 与原 <input type="date"> 保持一致，便于直接对接现有 string state */
const DATE_FORMAT = 'yyyy-MM-dd'

function parseISODate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, DATE_FORMAT, new Date())
  return isValid(parsed) ? parsed : undefined
}

function formatISODate(date: Date | undefined): string {
  return date ? format(date, DATE_FORMAT) : ''
}

/** 按当前 next-intl locale 返回 date-fns locale，用于日历表头与月份名 */
function useDateFnsLocale() {
  const locale = useLocale()
  return useMemo(() => {
    if (locale === 'zh') return zhCN
    if (locale === 'vi') return vi
    return enUS
  }, [locale])
}

export interface DatePickerProps {
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  align?: 'start' | 'center' | 'end'
}

/** 单日期选择器 — 受控字符串接口（"YYYY-MM-DD"），清空时回传 "" */
export function DatePicker({ value, onChange, placeholder, disabled, className, id, align = 'start' }: DatePickerProps) {
  const t = useTranslations('common')
  const dateFnsLocale = useDateFnsLocale()
  const selected = parseISODate(value)
  const text = selected ? format(selected, DATE_FORMAT) : (placeholder ?? t('selectDate'))

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            disabled={disabled}
            className={cn('h-8 w-full justify-start px-2.5 font-normal', !selected && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarIcon className="size-3.5" />
        <span className="flex-1 truncate text-left">{text}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={date => onChange(formatISODate(date))}
          defaultMonth={selected}
          locale={dateFnsLocale}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export interface DateRangePickerProps {
  fromValue: string | null | undefined
  toValue: string | null | undefined
  onChange: (from: string, to: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  align?: 'start' | 'center' | 'end'
  numberOfMonths?: number
}

/** 日期范围选择器 — 同时管理起止日期，回传两个字符串（清空对应 ""） */
export function DateRangePicker({
  fromValue,
  toValue,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  align = 'start',
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const t = useTranslations('common')
  const dateFnsLocale = useDateFnsLocale()
  const from = parseISODate(fromValue)
  const to = parseISODate(toValue)
  const empty = !from && !to

  let text: string
  if (from && to) {
    text = `${format(from, DATE_FORMAT)} ~ ${format(to, DATE_FORMAT)}`
  } else if (from) {
    text = `${format(from, DATE_FORMAT)} ~`
  } else if (to) {
    text = `~ ${format(to, DATE_FORMAT)}`
  } else {
    text = placeholder ?? t('selectDateRange')
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            disabled={disabled}
            className={cn('h-8 w-full justify-start px-2.5 font-normal', empty && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarIcon className="size-3.5" />
        <span className="flex-1 truncate text-left">{text}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={(range: DateRange | undefined) => {
            onChange(formatISODate(range?.from), formatISODate(range?.to))
          }}
          defaultMonth={from ?? to}
          numberOfMonths={numberOfMonths}
          locale={dateFnsLocale}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
