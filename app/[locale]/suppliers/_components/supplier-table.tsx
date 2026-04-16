'use client'

import { Eye, Pencil, Power, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  onEdit: (supplier: SupplierListItem) => void
  onView: (supplier: SupplierListItem) => void
  onDelete: (supplier: SupplierListItem) => void
  onToggleStatus: (supplier: SupplierListItem) => void
}

export function SupplierTable({ suppliers, loading, onEdit, onView, onDelete, onToggleStatus }: SupplierTableProps) {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    )
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-16 dark:border-slate-800">
        <p className="text-muted-foreground text-sm">{tc('noData')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[140px]">{t('code')}</TableHead>
            <TableHead>{t('name')}</TableHead>
            <TableHead className="w-[140px]">{t('country')}</TableHead>
            <TableHead className="w-[120px]">{t('contactPerson')}</TableHead>
            <TableHead className="w-[150px]">{t('contactPhone')}</TableHead>
            <TableHead className="w-[100px]">{t('grade')}</TableHead>
            <TableHead className="w-[100px]">{t('currency')}</TableHead>
            <TableHead className="w-[120px] text-right">{t('payableBalance')}</TableHead>
            <TableHead className="w-[90px]">{t('isEnabled')}</TableHead>
            <TableHead className="w-[220px] text-right">{tc('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map(supplier => (
            <TableRow key={supplier.id}>
              <TableCell className="font-mono text-xs font-medium">{supplier.code}</TableCell>
              <TableCell>
                <div className="font-medium">{supplier.name}</div>
                {supplier.shortName && <div className="text-muted-foreground text-xs">{supplier.shortName}</div>}
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
