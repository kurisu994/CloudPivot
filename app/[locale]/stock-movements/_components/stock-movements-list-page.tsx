'use client'

import { RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { TransactionFilter, TransactionListItem, WarehouseItem } from '@/lib/tauri'
import { getInventoryTransactions, getWarehouses } from '@/lib/tauri'

/** 格式化数量显示，消除 JS 浮点精度噪声 */
function fmtQty(v: number): string {
  return Number(v.toFixed(6)).toString()
}

/** 截断 + Tooltip：列宽不足时省略号，hover 显示完整文本 */
function Truncated({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`block truncate ${className || ''}`}>{text}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  )
}

const DEFAULT_PAGE_SIZE = 50
const COL_COUNT = 11

/** 变动类型选项 */
const TYPE_OPTIONS = [
  { value: 'purchase_in', labelKey: 'purchaseIn' },
  { value: 'sales_out', labelKey: 'salesOut' },
  { value: 'purchase_return', labelKey: 'purchaseReturn' },
  { value: 'sales_return', labelKey: 'salesReturn' },
  { value: 'check_gain', labelKey: 'checkGain' },
  { value: 'check_loss', labelKey: 'checkLoss' },
  { value: 'transfer_in', labelKey: 'transferIn' },
  { value: 'transfer_out', labelKey: 'transferOut' },
  { value: 'production_out', labelKey: 'productionOut' },
  { value: 'production_in', labelKey: 'productionIn' },
  { value: 'other_in', labelKey: 'otherIn' },
  { value: 'other_out', labelKey: 'otherOut' },
] as const

/** 来源单据类型筛选项（值与后端 source_type 一致，标签取 stockMovements.sourceTypes.*） */
const SOURCE_TYPE_OPTIONS = [
  'manual_stock_movement',
  'purchase_inbound',
  'purchase_return',
  'production_order',
  'stock_check',
  'transfer',
  'outbound',
  'sales_return',
] as const

/** 手工批量单业务类型（用于流水页业务类型筛选与自然名称显示） */
const MANUAL_BUSINESS_TYPES = [
  'manual_purchase_in',
  'borrowed_material_in',
  'lent_material_return_in',
  'adjustment_in',
  'other_in',
  'manual_production_out',
  'borrowed_material_return_out',
  'lent_material_out',
  'scrap_out',
  'sample_out',
  'adjustment_out',
  'other_out',
] as const

/**
 * 出入库流水列表页
 */
export function StockMovementsListPage() {
  const t = useTranslations('stockMovements')
  const tc = useTranslations('common')
  const ti = useTranslations('inventory')
  const tm = useTranslations('manualStockMovements')

  const [items, setItems] = useState<TransactionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftWarehouse, setDraftWarehouse] = useState('all')
  const [draftType, setDraftType] = useState('all')
  const [draftSource, setDraftSource] = useState('all')
  const [draftBusinessType, setDraftBusinessType] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  const [filters, setFilters] = useState<TransactionFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getInventoryTransactions({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载流水失败', error)
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize])

  useEffect(() => {
    void loadData()
  }, [loadData])
  useEffect(() => {
    void getWarehouses(false)
      .then(setWarehouses)
      .catch(() => {})
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const warehouseItems = useMemo(
    () => [{ value: 'all', label: t('allTypes') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [t, warehouses],
  )
  const typeItems = useMemo(() => [{ value: 'all', label: t('allTypes') }, ...TYPE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))], [t])

  /** 手工批量单业务类型自然名称（复用 manualStockMovements.typeXxx） */
  const getBusinessTypeLabel = useCallback(
    (bt: string) =>
      tm(
        `type${bt
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join('')}`,
      ),
    [tm],
  )

  const sourceItems = useMemo(
    () => [{ value: 'all', label: t('allSources') }, ...SOURCE_TYPE_OPTIONS.map(s => ({ value: s, label: t(`sourceTypes.${s}`) }))],
    [t],
  )
  const businessTypeItems = useMemo(
    () => [{ value: 'all', label: t('allBusinessTypes') }, ...MANUAL_BUSINESS_TYPES.map(b => ({ value: b, label: getBusinessTypeLabel(b) }))],
    [t, getBusinessTypeLabel],
  )

  /** 获取变动类型的显示文案 */
  const getTypeName = (type: string) => {
    const opt = TYPE_OPTIONS.find(o => o.value === type)
    return opt ? t(opt.labelKey) : type
  }

  /** 来源单据类型标签；未知来源返回 null（回退为仅显示单据号） */
  const getSourceLabel = (sourceType: string | null) =>
    sourceType && (SOURCE_TYPE_OPTIONS as readonly string[]).includes(sourceType) ? t(`sourceTypes.${sourceType}`) : null

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      warehouseId: draftWarehouse !== 'all' ? Number(draftWarehouse) : undefined,
      transactionType: draftType !== 'all' ? draftType : undefined,
      sourceType: draftSource !== 'all' ? draftSource : undefined,
      businessType: draftBusinessType !== 'all' ? draftBusinessType : undefined,
      dateFrom: draftDateFrom || undefined,
      dateTo: draftDateTo || undefined,
      page: 1,
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftWarehouse('all')
    setDraftType('all')
    setDraftSource('all')
    setDraftBusinessType('all')
    setDraftDateFrom('')
    setDraftDateTo('')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {/* 筛选区 */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={draftKeyword}
                  onChange={e => setDraftKeyword(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-9"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <div className="w-[160px]">
              <Select value={draftWarehouse} onValueChange={v => v && setDraftWarehouse(v)} items={warehouseItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouseItems.map(i => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <Select value={draftType} onValueChange={v => v && setDraftType(v)} items={typeItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeItems.map(i => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Select value={draftSource} onValueChange={v => v && setDraftSource(v)} items={sourceItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceItems.map(i => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Select value={draftBusinessType} onValueChange={v => v && setDraftBusinessType(v)} items={businessTypeItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businessTypeItems.map(i => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangePicker
              fromValue={draftDateFrom}
              toValue={draftDateTo}
              onChange={(from, to) => {
                setDraftDateFrom(from)
                setDraftDateTo(to)
              }}
              className="w-[280px]"
            />
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw data-icon="inline-start" />
              {tc('reset')}
            </Button>
            <Button size="sm" onClick={handleSearch}>
              <Search data-icon="inline-start" />
              {tc('search')}
            </Button>
          </div>
        </div>

        {/* 表格 */}
        <BusinessListTableShell
          tableClassName="min-w-[1400px]"
          footer={
            <BusinessListTableFooter>
              <span className="text-xs font-bold text-slate-400">{t('totalItems', { total })}</span>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </BusinessListTableFooter>
          }
        >
          <TableHeader>
            <TableRow>
              <TableHead className={`${BUSINESS_LIST_STICKY_HEAD_CLASS} w-[240px]`}>{t('transactionNo')}</TableHead>
              <TableHead className="w-[100px]">{t('transactionDate')}</TableHead>
              <TableHead className="w-[120px]">{t('transactionType')}</TableHead>
              <TableHead className="w-[120px]">{ti('materialCode')}</TableHead>
              <TableHead className="w-[140px]">{ti('materialName')}</TableHead>
              <TableHead className="w-[100px]">{ti('warehouse')}</TableHead>
              <TableHead className="w-[90px] text-right">{t('changeQty')}</TableHead>
              <TableHead className="w-[80px] text-right">{t('beforeQty')}</TableHead>
              <TableHead className="w-[80px] text-right">{t('afterQty')}</TableHead>
              <TableHead className="w-[160px]">{t('relatedOrderNo')}</TableHead>
              <TableHead className="w-[150px]">{t('source')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <BusinessListTableLoadingRows colSpan={COL_COUNT} />
            ) : items.length === 0 ? (
              <BusinessListTableEmptyRow colSpan={COL_COUNT} message={t('noRecords')} />
            ) : (
              items.map(item => (
                <TableRow key={item.id} className="group">
                  <TableCell className={`${BUSINESS_LIST_STICKY_CELL_CLASS} font-mono text-sm`}>
                    <Truncated text={item.transactionNo} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Truncated text={item.transactionDate} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.quantity > 0 ? 'default' : 'secondary'}>
                      {item.businessType ? getBusinessTypeLabel(item.businessType) : getTypeName(item.transactionType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <Truncated text={item.materialCode} />
                  </TableCell>
                  <TableCell>
                    <Truncated text={item.materialName} />
                  </TableCell>
                  <TableCell>
                    <Truncated text={item.warehouseName} />
                  </TableCell>
                  <TableCell className={`text-right font-mono ${item.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <Truncated text={`${item.quantity > 0 ? '+' : ''}${fmtQty(item.quantity)}`} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <Truncated text={fmtQty(item.beforeQty)} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <Truncated text={fmtQty(item.afterQty)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    <Truncated text={item.relatedOrderNo || '-'} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Truncated text={getSourceLabel(item.sourceType) ?? '-'} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </BusinessListTableShell>
      </div>
    </TooltipProvider>
  )
}
