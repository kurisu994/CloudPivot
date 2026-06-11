'use client'

import { Eye, Pencil, Power, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell
          className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          tableClassName="min-w-[62.5rem]"
        >
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-[6rem] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('code')}</TableHead>
              <TableHead className="w-[8.75rem]">{t('name')}</TableHead>
              <TableHead className="w-[5rem]">{t('country')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('contactPerson')}</TableHead>
              <TableHead className="w-[7.5rem]">{t('contactPhone')}</TableHead>
              <TableHead className="w-[5rem]">{t('grade')}</TableHead>
              <TableHead className="w-[5rem]">{t('currency')}</TableHead>
              <TableHead className="w-[6.875rem] text-right">{t('payableBalance')}</TableHead>
              <TableHead className="w-[4.375rem]">{t('isEnabled')}</TableHead>
              <TableHead className="w-[7.5rem] text-right">{tc('actions')}</TableHead>
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
      </div>
      <div className="shrink-0 pt-4">
        <BusinessListTableFooter>
          <span className="text-xs font-bold text-slate-400">{t('totalRecords', { count: total })}</span>
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        </BusinessListTableFooter>
      </div>
    </div>
  )
}
