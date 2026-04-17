'use client'

import { ChevronLeft, ChevronRight, Eye, Pencil, Power, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { CustomerListItem } from '@/lib/tauri'
import { COUNTRY_OPTIONS, CUSTOMER_TYPE_OPTIONS, GRADE_OPTIONS } from './customers-content'

/** 客户等级颜色映射 */
const GRADE_COLORS: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

interface CustomerTableProps {
  customers: CustomerListItem[]
  loading?: boolean
  total: number
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (customer: CustomerListItem) => void
  onView: (customer: CustomerListItem) => void
  onDelete: (customer: CustomerListItem) => void
  onToggleStatus: (customer: CustomerListItem) => void
}

/** 分页器页码生成 */
function buildPageNumbers(current: number, total: number): (number | '...')[] {
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

export function CustomerTable({
  customers,
  loading,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onView,
  onDelete,
  onToggleStatus,
}: CustomerTableProps) {
  const t = useTranslations('customers')

  const pageSizeItems = [
    { value: '10', label: t('perPage', { count: '10' }) },
    { value: '20', label: t('perPage', { count: '20' }) },
    { value: '50', label: t('perPage', { count: '50' }) },
  ]

  return (
    <BusinessListTableShell
      className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      tableClassName="min-w-[1120px]"
      footer={
        <BusinessListTableFooter>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="font-medium">{t('totalRecords', { count: total })}</span>
            <Select value={pageSize.toString()} onValueChange={v => v && onPageSizeChange(parseInt(v))} items={pageSizeItems}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {buildPageNumbers(page, totalPages).map((p, idx) =>
              p === '...' ? (
                <span key={`dots-${idx}`} className="text-muted-foreground/50 px-2">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? 'default' : 'ghost'}
                  size="icon-sm"
                  className="font-bold"
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </Button>
              ),
            )}
            <Button variant="ghost" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </BusinessListTableFooter>
      }
    >
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`w-[130px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('table.code')}</TableHead>
          <TableHead className="w-[160px]">{t('table.name')}</TableHead>
          <TableHead className="w-[100px]">{t('table.customerType')}</TableHead>
          <TableHead className="w-[100px]">{t('table.country')}</TableHead>
          <TableHead className="w-[100px]">{t('table.grade')}</TableHead>
          <TableHead className="w-[110px]">{t('table.contactPerson')}</TableHead>
          <TableHead className="w-[90px]">{t('table.currency')}</TableHead>
          <TableHead className="w-[130px] text-right">{t('table.receivableBalance')}</TableHead>
          <TableHead className="w-[90px]">{t('table.status')}</TableHead>
          <TableHead className="w-[140px] text-right">{t('table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={10} />
        ) : customers.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={10} message={t('table.noResults')} />
        ) : (
          customers.map(customer => (
            <TableRow key={customer.id} className="group">
              <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{customer.code}</TableCell>
              <TableCell>
                <div className="truncate font-medium">{customer.name}</div>
              </TableCell>
              <TableCell>
                {t(
                  `customerType.${CUSTOMER_TYPE_OPTIONS.find((o: { value: string }) => o.value === customer.customerType)?.value ?? customer.customerType}`,
                )}
              </TableCell>
              <TableCell>
                {t(`country.${COUNTRY_OPTIONS.find((o: { value: string }) => o.value === customer.country)?.value ?? customer.country}`)}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRADE_COLORS[customer.grade] || GRADE_COLORS.normal}`}
                >
                  {t(`grade.${GRADE_OPTIONS.find((o: { value: string }) => o.value === customer.grade)?.value ?? customer.grade}`)}
                </span>
              </TableCell>
              <TableCell>{customer.contactPerson ?? '—'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {customer.currency}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatAmount(customer.receivableBalance, customer.currency as 'VND' | 'CNY' | 'USD')}
              </TableCell>
              <TableCell>
                <Badge variant={customer.isEnabled ? 'default' : 'secondary'} className="text-xs">
                  {customer.isEnabled ? t('status.enabled') : t('status.disabled')}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => onView(customer)} title={t('action.detail')}>
                    <Eye className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onEdit(customer)} title={t('action.edit')}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onToggleStatus(customer)}
                    title={customer.isEnabled ? t('action.disable') : t('action.enable')}
                  >
                    <Power className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onDelete(customer)} title={t('action.delete')}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </BusinessListTableShell>
  )
}
