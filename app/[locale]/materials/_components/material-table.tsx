'use client'

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
import { Checkbox } from '@/components/ui/checkbox'
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

  /* 每页条数选项 — 用于 Select items */
  return (
    <BusinessListTableShell
      className="border-border bg-card rounded-xl border shadow-sm"
      tableClassName="min-w-[1120px]"
      footer={
        <BusinessListTableFooter>
          <span className="text-xs font-bold text-slate-400">{t('table.totalRecords', { total: String(total) })}</span>
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
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
          {/* 进价/售价暂时隐藏 */}
          <TableHead className="w-[72px] text-center">{t('table.stock')}</TableHead>
          <TableHead className="w-[96px] text-center">{t('table.status')}</TableHead>
          <TableHead className="w-[144px] text-right">{t('table.operations')}</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={8} rows={4} />
        ) : data.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={8} message={t('table.noResults')} />
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
                <Badge variant="outline" className={TYPE_COLORS[row.materialType] ?? ''}>
                  {t(`filters.type.${row.materialType}` as 'filters.type.raw' | 'filters.type.semi' | 'filters.type.finished')}
                </Badge>
              </TableCell>

              {/* 分类 */}
              <TableCell>{row.categoryName || '—'}</TableCell>

              {/* 规格 */}
              <TableCell className="text-muted-foreground">{row.spec || '—'}</TableCell>

              {/* 单位 */}
              <TableCell className="text-center">{row.unitName || '—'}</TableCell>

              {/* 进价/售价暂时隐藏 */}

              {/* 安全库存 */}
              <TableCell className="text-center">
                {row.safetyStock > 0 ? row.safetyStock : <span className="text-muted-foreground">—</span>}
              </TableCell>

              {/* 状态 */}
              <TableCell className="text-center">
                {row.isEnabled ? (
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
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive ml-3 h-auto p-0 font-bold"
                  onClick={() => onToggleStatus(row.id, row.isEnabled)}
                >
                  {row.isEnabled ? t('actions.disable') : t('actions.enable')}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </BusinessListTableShell>
  )
}
