'use client'

import { Eye, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SupplierListItem } from '@/lib/tauri'
import { COUNTRY_OPTIONS, GRADE_OPTIONS } from './suppliers-content'

/** 等级对应的颜色样式 */
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
  onToggleStatus?: (supplier: SupplierListItem) => void
}

/** 供应商数据表格 */
export function SupplierTable({ suppliers, loading, onEdit, onToggleStatus }: SupplierTableProps) {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-16 dark:border-slate-800">
        <p className="text-muted-foreground text-sm">{tc('loading')}...</p>
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
            <TableHead className="w-[120px]">{t('country')}</TableHead>
            <TableHead className="w-[100px]">{t('contactPerson')}</TableHead>
            <TableHead className="w-[150px]">{t('contactPhone')}</TableHead>
            <TableHead className="w-[100px]">{t('grade')}</TableHead>
            <TableHead className="w-[100px]">{t('currency')}</TableHead>
            <TableHead className="w-[80px]">{t('isEnabled')}</TableHead>
            <TableHead className="w-[120px] text-right">{tc('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map(supplier => (
            <TableRow key={supplier.id}>
              {/* 编码 */}
              <TableCell className="font-mono text-xs font-medium">{supplier.code}</TableCell>

              {/* 名称 */}
              <TableCell>
                <div className="font-medium">{supplier.name}</div>
                {supplier.shortName && <div className="text-muted-foreground text-xs">{supplier.shortName}</div>}
              </TableCell>

              {/* 国家 */}
              <TableCell>
                <span className="text-sm">{t(COUNTRY_OPTIONS.find(o => o.value === supplier.country)?.labelKey ?? 'countryOTHER')}</span>
              </TableCell>

              {/* 联系人 */}
              <TableCell className="text-sm">{supplier.contactPerson ?? '—'}</TableCell>

              {/* 联系电话 */}
              <TableCell className="text-sm">{supplier.contactPhone ?? '—'}</TableCell>

              {/* 等级 */}
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRADE_COLORS[supplier.grade] || GRADE_COLORS.D}`}
                >
                  {t(GRADE_OPTIONS.find(o => o.value === supplier.grade)?.labelKey ?? 'gradeD')}
                </span>
              </TableCell>

              {/* 结算币种 */}
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {supplier.currency}
                </Badge>
              </TableCell>

              {/* 状态 */}
              <TableCell>
                <Badge variant={supplier.isEnabled ? 'default' : 'secondary'} className="text-xs">
                  {supplier.isEnabled ? tc('enabled') : tc('disabled')}
                </Badge>
              </TableCell>

              {/* 操作 */}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => onEdit(supplier)} title={tc('edit')}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => toast.info('详情页即将上线')} title={t('details')}>
                    <Eye className="size-3.5" />
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
