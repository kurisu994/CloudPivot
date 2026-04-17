'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { MaterialItem } from './materials-client-page'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MaterialTableProps {
  data: MaterialItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (id: number) => void
  onToggleStatus: (id: number, currentEnabled: boolean) => void
}

/* ------------------------------------------------------------------ */
/*  物料类型 Badge 颜色映射                                             */
/* ------------------------------------------------------------------ */

const TYPE_COLORS: Record<string, string> = {
  raw: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  semi: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  finished: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function MaterialTable({ data, loading, total, page, pageSize, onPageChange, onPageSizeChange, onEdit, onToggleStatus }: MaterialTableProps) {
  const t = useTranslations('materials')
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  /* 分页器页码生成 */
  const renderPages = () => {
    const pages: (number | '...')[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)

    for (let i = start; i <= end; i++) pages.push(i)
    if (end < totalPages) {
      pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  /* 每页条数选项 — 用于 Select items */
  const pageSizeItems = [
    { value: '20', label: t('table.perPage', { count: '20' }) },
    { value: '50', label: t('table.perPage', { count: '50' }) },
    { value: '100', label: t('table.perPage', { count: '100' }) },
  ]

  return (
    <BusinessListTableShell
      className="border-border bg-card rounded-xl border shadow-sm"
      tableClassName="min-w-[1120px]"
      footer={
        <BusinessListTableFooter>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="font-medium">{t('table.totalRecords', { total: String(total) })}</span>
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
            {renderPages().map((p, idx) =>
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
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className={`w-[240px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>
            <div className="flex items-center gap-3 pl-2">
              <Checkbox />
              <span>{t('table.codeName')}</span>
            </div>
          </TableHead>
          <TableHead className="w-[96px]">{t('table.type')}</TableHead>
          <TableHead className="w-[120px]">{t('table.category')}</TableHead>
          <TableHead className="w-[140px]">{t('table.spec')}</TableHead>
          <TableHead className="w-[72px] text-center">{t('table.unit')}</TableHead>
          <TableHead className="w-[120px] text-right">{t('table.refCost')}</TableHead>
          <TableHead className="w-[120px] text-right">{t('table.salePrice')}</TableHead>
          <TableHead className="w-[72px] text-center">{t('table.stock')}</TableHead>
          <TableHead className="w-[96px] text-center">{t('table.status')}</TableHead>
          <TableHead className="w-[144px] text-right">{t('table.operations')}</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={10} rows={4} />
        ) : data.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={10} message={t('table.noResults')} />
        ) : (
          /* 数据行 */
          data.map(row => (
            <TableRow key={row.id} className="group">
              {/* 第一列 — sticky 编码/名称 */}
              <TableCell className={BUSINESS_LIST_STICKY_CELL_CLASS}>
                <div className="flex items-center gap-3 pl-2">
                  <Checkbox />
                  <div className="min-w-0">
                    <div className="text-muted-foreground font-mono text-[10px]">{row.code}</div>
                    <div className="text-foreground truncate font-bold">{row.name}</div>
                  </div>
                </div>
              </TableCell>

              {/* 类型 */}
              <TableCell>
                <Badge variant="outline" className={TYPE_COLORS[row.material_type] ?? ''}>
                  {t(`filters.type.${row.material_type}` as 'filters.type.raw' | 'filters.type.semi' | 'filters.type.finished')}
                </Badge>
              </TableCell>

              {/* 分类 */}
              <TableCell>{row.category_name || '—'}</TableCell>

              {/* 规格 */}
              <TableCell className="text-muted-foreground">{row.spec || '—'}</TableCell>

              {/* 单位 */}
              <TableCell className="text-center">{row.unit_name || '—'}</TableCell>

              {/* 进价 */}
              <TableCell className="text-right">
                {row.ref_cost_price > 0 ? (
                  <span className="font-bold">{formatAmount(row.ref_cost_price, 'USD')}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* 售价 */}
              <TableCell className="text-right">
                {row.sale_price > 0 ? (
                  <span className="font-bold">{formatAmount(row.sale_price, 'USD')}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* 库存 */}
              <TableCell className="text-center">0</TableCell>

              {/* 状态 */}
              <TableCell className="text-center">
                {row.is_enabled ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    {t('table.active')}
                  </span>
                ) : (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <span className="bg-muted-foreground/40 size-2 rounded-full" />
                    {t('table.inactive')}
                  </span>
                )}
              </TableCell>

              {/* 操作 */}
              <TableCell className="pr-4 text-right">
                <Button variant="link" size="sm" className="text-primary h-auto p-0 font-bold" onClick={() => onEdit(row.id)}>
                  {t('actions.edit')}
                </Button>
                {row.material_type === 'finished' || row.material_type === 'semi' ? (
                  <Button variant="link" size="sm" className="ml-3 h-auto p-0 font-bold text-amber-600 dark:text-amber-400">
                    {t('actions.bom')}
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive ml-3 h-auto p-0 font-bold"
                    onClick={() => onToggleStatus(row.id, row.is_enabled)}
                  >
                    {row.is_enabled ? t('actions.disable') : t('actions.enable')}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </BusinessListTableShell>
  )
}
