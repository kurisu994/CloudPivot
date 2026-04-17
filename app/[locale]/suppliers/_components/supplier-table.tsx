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
import type { SupplierListItem } from '@/lib/tauri'
import { COUNTRY_OPTIONS, GRADE_OPTIONS } from './suppliers-content'

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  D: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface SupplierTableProps {
  suppliers: SupplierListItem[]
  loading?: boolean
  total: number
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (supplier: SupplierListItem) => void
  onView: (supplier: SupplierListItem) => void
  onDelete: (supplier: SupplierListItem) => void
  onToggleStatus: (supplier: SupplierListItem) => void
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

export function SupplierTable({
  suppliers,
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
}: SupplierTableProps) {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  const pageSizeItems = [
    { value: '10', label: t('perPage', { count: '10' }) },
    { value: '20', label: t('perPage', { count: '20' }) },
    { value: '50', label: t('perPage', { count: '50' }) },
  ]

  return (
    <BusinessListTableShell
      className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      tableClassName="min-w-[1300px]"
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
          <TableHead className={`w-[140px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('code')}</TableHead>
          <TableHead className="w-[180px]">{t('name')}</TableHead>
          <TableHead className="w-[120px]">{t('country')}</TableHead>
          <TableHead className="w-[120px]">{t('contactPerson')}</TableHead>
          <TableHead className="w-[140px]">{t('contactPhone')}</TableHead>
          <TableHead className="w-[100px]">{t('grade')}</TableHead>
          <TableHead className="w-[100px]">{t('currency')}</TableHead>
          <TableHead className="w-[140px] text-right">{t('payableBalance')}</TableHead>
          <TableHead className="w-[100px]">{t('isEnabled')}</TableHead>
          <TableHead className="w-[160px] text-right">{tc('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={10} />
        ) : suppliers.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={10} message={tc('noData')} />
        ) : (
          suppliers.map(supplier => (
            <TableRow key={supplier.id} className="group">
              <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{supplier.code}</TableCell>
              <TableCell>
                <div className="truncate font-medium">{supplier.name}</div>
                {supplier.shortName && <div className="text-muted-foreground truncate text-xs">{supplier.shortName}</div>}
              </TableCell>
              <TableCell>{t(COUNTRY_OPTIONS.find(option => option.value === supplier.country)?.labelKey ?? 'countryOTHER')}</TableCell>
              <TableCell>{supplier.contactPerson ?? '—'}</TableCell>
              <TableCell>{supplier.contactPhone ?? '—'}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRADE_COLORS[supplier.grade] || GRADE_COLORS.D}`}
                >
                  {t(GRADE_OPTIONS.find(option => option.value === supplier.grade)?.labelKey ?? 'gradeD')}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {supplier.currency}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatAmount(supplier.payableBalance, supplier.currency as 'VND' | 'CNY' | 'USD')}
              </TableCell>
              <TableCell>
                <Badge variant={supplier.isEnabled ? 'default' : 'secondary'} className="text-xs">
                  {supplier.isEnabled ? tc('enabled') : tc('disabled')}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => onEdit(supplier)} title={tc('edit')}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onView(supplier)} title={t('details')}>
                    <Eye className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onToggleStatus(supplier)}
                    title={supplier.isEnabled ? t('disableSupplier') : t('enableSupplier')}
                  >
                    <Power className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onDelete(supplier)} title={tc('delete')}>
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
