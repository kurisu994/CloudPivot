'use client'

import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export const BUSINESS_LIST_STICKY_HEAD_CLASS =
  'sticky left-0 z-20 bg-muted after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border'
export const BUSINESS_LIST_STICKY_CELL_CLASS =
  'sticky left-0 z-10 bg-card group-hover:bg-muted after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/50'

interface BusinessListTableShellProps {
  children: ReactNode
  className?: string
  tableClassName?: string
  footer?: ReactNode
}

interface BusinessListTableFooterProps {
  children: ReactNode
  className?: string
}

interface BusinessListTableLoadingRowsProps {
  colSpan: number
  rows?: number
  className?: string
}

interface BusinessListTableEmptyRowProps {
  colSpan: number
  message: ReactNode
  className?: string
}

/**
 * 业务列表表格骨架：
 * 统一卡片容器、横向滚动表格和可选分页栏容器。
 */
export function BusinessListTableShell({ children, className, tableClassName, footer }: BusinessListTableShellProps) {
  return (
    <div className={className}>
      <Table className={cn('table-fixed', tableClassName)}>{children}</Table>
      {footer}
    </div>
  )
}

/**
 * 业务列表分页栏骨架：
 * 统一小屏换行和边框间距，避免每个页面重复写响应式分页容器。
 */
export function BusinessListTableFooter({ children, className }: BusinessListTableFooterProps) {
  return (
    <div
      className={cn(
        'border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * 业务列表通用加载态：
 * 使用整行骨架，统一各表格加载时的占位风格。
 */
export function BusinessListTableLoadingRows({ colSpan, rows = 3, className }: BusinessListTableLoadingRowsProps) {
  return Array.from({ length: rows }).map((_, index) => (
    <TableRow key={index}>
      <TableCell colSpan={colSpan} className={cn('px-4 py-4', className)}>
        <Skeleton className="h-6 w-full" />
      </TableCell>
    </TableRow>
  ))
}

/**
 * 业务列表通用空态：
 * 统一空数据时的文案位置和留白。
 */
export function BusinessListTableEmptyRow({ colSpan, message, className }: BusinessListTableEmptyRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn('text-muted-foreground py-16 text-center', className)}>
        {message}
      </TableCell>
    </TableRow>
  )
}
