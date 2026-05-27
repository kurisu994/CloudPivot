'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** 默认可选的每页条数 */
const PAGE_SIZE_OPTIONS = [20, 50, 100]

/**
 * 生成分页器页码列表（同步操作日志页面分页效果，最多可显示端点及省略号）
 */
export function buildPageNumbers(current: number, total: number): (number | '...')[] {
  const pages: (number | '...')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }
  return pages
}

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  /** 当前每页条数（传入后显示条数选择器） */
  pageSize?: number
  /** 条数变更回调（必须与 pageSize 一起使用） */
  onPageSizeChange?: (size: number) => void
  /** 可选的条数列表，默认 [20, 50, 100] */
  pageSizeOptions?: number[]
}

/**
 * 分页控件（上一页 / 页码 / 下一页 / 每页条数）
 *
 * 统一样式，采用操作日志组件一致的精致边框设计。
 */
export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationControlsProps) {
  const t = useTranslations('common')

  const pageSizeItems = pageSizeOptions.map(s => ({
    value: String(s),
    label: t('perPage', { count: s }),
  }))

  return (
    <div className="flex flex-1 items-center justify-between gap-3 ml-4">
      {/* 每页条数选择器 */}
      {pageSize != null && onPageSizeChange && (
        <Select
          value={String(pageSize)}
          onValueChange={v => {
            if (v != null) {
              onPageSizeChange(Number(v))
              onPageChange(1)
            }
          }}
          items={pageSizeItems}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-auto gap-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 text-xs font-bold"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(s => (
              <SelectItem key={s} value={String(s)}>
                {t('perPage', { count: s })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 分页按钮容器 */}
      <div className="ml-auto flex items-center gap-1">
        {/* 上一页 */}
        <button
          className="flex size-8 items-center justify-center rounded border border-slate-200 text-slate-400 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* 页码 */}
        {buildPageNumbers(currentPage, totalPages).map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`} className="px-2 text-xs text-slate-300 dark:text-slate-600">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={cn(
                'flex size-8 items-center justify-center rounded text-xs font-bold transition-colors',
                currentPage === p
                  ? 'bg-primary text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {p}
            </button>
          ),
        )}

        {/* 下一页 */}
        <button
          className="flex size-8 items-center justify-center rounded border border-slate-200 text-slate-400 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
