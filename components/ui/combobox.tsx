'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  items: ComboboxOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  popupClassName?: string
  itemLabelClassName?: string
}

/**
 * 可搜索单选下拉框（基于 base-ui Combobox）。
 *
 * `items` 为 `{ value, label }[]`，输入文本时按 `label` 自动过滤，无需额外搜索框。
 * 选中项以 value 字符串对外暴露，清空时回传 null。
 */
export function Combobox({
  items,
  value,
  onValueChange,
  placeholder,
  emptyText = '无匹配项',
  disabled,
  className,
  popupClassName,
  itemLabelClassName,
}: ComboboxProps) {
  const selected = items.find(i => i.value === value) ?? null

  return (
    <ComboboxPrimitive.Root
      items={items}
      value={selected}
      onValueChange={(next: ComboboxOption | null) => onValueChange(next ? next.value : null)}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a?.value === b?.value}
      disabled={disabled}
    >
      <div className={cn('relative', className)}>
        <ComboboxPrimitive.Input
          placeholder={placeholder}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex h-8 w-full items-center rounded-lg border bg-transparent py-2 pr-8 pl-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <ComboboxPrimitive.Trigger
          disabled={disabled}
          className="text-muted-foreground absolute inset-y-0 right-2 flex items-center outline-none disabled:opacity-50"
        >
          <ComboboxPrimitive.Icon render={<ChevronDownIcon className="size-4" />} />
        </ComboboxPrimitive.Trigger>
      </div>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <ComboboxPrimitive.Popup
            className={cn(
              'bg-popover text-popover-foreground ring-foreground/10 max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-y-auto rounded-lg p-1 shadow-md ring-1 outline-none',
              popupClassName,
            )}
          >
            <ComboboxPrimitive.Empty className="text-muted-foreground px-2 py-4 text-center text-sm">{emptyText}</ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className={cn('flex-1 truncate', itemLabelClassName)}>{item.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
