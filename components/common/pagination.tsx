'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 生成分页器页码列表
 *
 * 最多显示 5 个页码，超出范围用 '...' 省略。
 */
export function buildPageNumbers(current: number, total: number): (number | '...')[] {
  const pages: (number | '...')[] = []
  const maxVisible = 5
  let start = Math.max(1, current - Math.floor(maxVisible / 2))
  const end = Math.min(total, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total) {
    pages.push('...')
    pages.push(total)
  }
  return pages
}

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * 分页控件（上一页 / 页码 / 下一页）
 *
 * 统一样式，供所有业务列表页复用。
 */
export function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  return (
    <div className="ml-auto flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
        <ChevronLeft className="size-4" />
      </Button>
      {buildPageNumbers(currentPage, totalPages).map((p, idx) =>
        p === '...' ? (
          <span key={`dots-${idx}`} className="text-muted-foreground/50 px-2">…</span>
        ) : (
          <Button
            key={p}
            variant={currentPage === p ? 'default' : 'ghost'}
            size="icon-sm"
            className="font-bold"
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </Button>
        ),
      )}
      <Button variant="ghost" size="icon-sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
