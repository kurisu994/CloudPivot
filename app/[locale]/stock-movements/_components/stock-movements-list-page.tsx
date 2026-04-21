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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TransactionFilter, TransactionListItem, WarehouseItem } from '@/lib/tauri'
import { getInventoryTransactions, getWarehouses } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 20
const COL_COUNT = 10

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
] as const

/**
 * 出入库流水列表页
 */
export function StockMovementsListPage() {
  const t = useTranslations('stockMovements')
  const tc = useTranslations('common')

  const [items, setItems] = useState<TransactionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftWarehouse, setDraftWarehouse] = useState('all')
  const [draftType, setDraftType] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  const [filters, setFilters] = useState<TransactionFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)

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

  /** 获取变动类型的显示文案 */
  const getTypeName = (type: string) => {
    const opt = TYPE_OPTIONS.find(o => o.value === type)
    return opt ? t(opt.labelKey) : type
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      warehouseId: draftWarehouse !== 'all' ? Number(draftWarehouse) : undefined,
      transactionType: draftType !== 'all' ? draftType : undefined,
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
    setDraftDateFrom('')
    setDraftDateTo('')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
      </div>

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
          <div className="flex items-center gap-2">
            <Input type="date" value={draftDateFrom} onChange={e => setDraftDateFrom(e.target.value)} className="w-[140px]" />
            <span className="text-muted-foreground text-sm">~</span>
            <Input type="date" value={draftDateTo} onChange={e => setDraftDateTo(e.target.value)} className="w-[140px]" />
          </div>
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
        tableClassName="min-w-[1200px]"
        footer={
          <BusinessListTableFooter>
            <span>共 {total} 条</span>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </BusinessListTableFooter>
        }
      >
        <TableHeader>
          <TableRow>
            <TableHead className={`${BUSINESS_LIST_STICKY_HEAD_CLASS} w-[160px]`}>{t('transactionNo')}</TableHead>
            <TableHead className="w-[100px]">{t('transactionDate')}</TableHead>
            <TableHead className="w-[120px]">{t('transactionType')}</TableHead>
            <TableHead className="w-[120px]">物料编码</TableHead>
            <TableHead className="w-[140px]">物料名称</TableHead>
            <TableHead className="w-[100px]">仓库</TableHead>
            <TableHead className="w-[90px] text-right">{t('changeQty')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('beforeQty')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('afterQty')}</TableHead>
            <TableHead className="w-[140px]">{t('relatedOrderNo')}</TableHead>
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
                <TableCell className={`${BUSINESS_LIST_STICKY_CELL_CLASS} font-mono text-sm`}>{item.transaction_no}</TableCell>
                <TableCell className="text-sm">{item.transaction_date}</TableCell>
                <TableCell>
                  <Badge variant={item.quantity > 0 ? 'default' : 'secondary'}>{getTypeName(item.transaction_type)}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{item.material_code}</TableCell>
                <TableCell>{item.material_name}</TableCell>
                <TableCell>{item.warehouse_name}</TableCell>
                <TableCell className={`text-right font-mono ${item.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.quantity > 0 ? '+' : ''}
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{item.before_qty}</TableCell>
                <TableCell className="text-right font-mono text-sm">{item.after_qty}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">{item.related_order_no || '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>
    </div>
  )
}
