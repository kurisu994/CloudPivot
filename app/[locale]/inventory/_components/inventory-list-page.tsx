'use client'

import { Eye, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { CategoryNode, InventoryDetail, InventoryFilter, InventoryListItem, WarehouseItem } from '@/lib/tauri'
import { getCategoryTree, getInventoryDetail, getInventoryList, getWarehouses } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 20
const COL_COUNT = 11

/** 截断表格文本，并在悬浮时显示完整内容。 */
function Truncated({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate">{text}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/** 预警状态选项 */
const ALERT_OPTIONS = [
  { value: 'all', labelKey: 'allAlerts' },
  { value: 'low', labelKey: 'alertLow' },
  { value: 'high', labelKey: 'alertHigh' },
] as const

/**
 * 库存查询列表页
 */
export function InventoryListPage() {
  const t = useTranslations('inventory')
  const tc = useTranslations('common')

  const [items, setItems] = useState<InventoryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 草稿筛选
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftWarehouse, setDraftWarehouse] = useState('all')
  const [draftCategory, setDraftCategory] = useState('all')
  const [draftAlert, setDraftAlert] = useState('all')

  const [filters, setFilters] = useState<InventoryFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])

  // 详情弹窗
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<InventoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getInventoryList({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载库存列表失败', error)
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize])

  const loadOptions = useCallback(async () => {
    try {
      const [wh, cat] = await Promise.all([getWarehouses(false), getCategoryTree()])
      setWarehouses(wh)
      setCategories(cat.filter(c => c.level === 1))
    } catch (error) {
      console.error('加载筛选选项失败', error)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])
  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const warehouseItems = useMemo(
    () => [{ value: 'all', label: t('allWarehouses') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [t, warehouses],
  )
  const categoryItems = useMemo(
    () => [{ value: 'all', label: t('allCategories') }, ...categories.map(c => ({ value: String(c.id), label: c.name }))],
    [t, categories],
  )
  const alertItems = useMemo(() => ALERT_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })), [t])

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      warehouseId: draftWarehouse !== 'all' ? Number(draftWarehouse) : undefined,
      categoryId: draftCategory !== 'all' ? Number(draftCategory) : undefined,
      alertStatus: draftAlert !== 'all' ? draftAlert : undefined,
      page: 1,
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftWarehouse('all')
    setDraftCategory('all')
    setDraftAlert('all')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  const handleViewDetail = async (materialId: number) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const d = await getInventoryDetail(materialId)
      setDetail(d)
    } catch (error) {
      toast.error(getErrorMessage(error, t('loadDetailFailed')))
    } finally {
      setDetailLoading(false)
    }
  }

  /** 预警状态 Badge */
  const alertBadge = (status: string) => {
    switch (status) {
      case 'low':
        return <Badge variant="destructive">{t('alertLow')}</Badge>
      case 'high':
        return <Badge variant="secondary">{t('alertHigh')}</Badge>
      default:
        return <Badge variant="outline">{t('alertNormal')}</Badge>
    }
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
                {warehouseItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Select value={draftCategory} onValueChange={v => v && setDraftCategory(v)} items={categoryItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[140px]">
            <Select value={draftAlert} onValueChange={v => v && setDraftAlert(v)} items={alertItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {alertItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* 数据表格 */}
      <TooltipProvider>
        <BusinessListTableShell
          tableClassName="min-w-[1200px]"
          footer={
            <BusinessListTableFooter>
              <span>{t('totalItems', { total })}</span>
              <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </BusinessListTableFooter>
          }
        >
          <TableHeader>
            <TableRow>
              <TableHead className={`${BUSINESS_LIST_STICKY_HEAD_CLASS} w-[140px]`}>{t('materialCode')}</TableHead>
              <TableHead className="w-[160px]">{t('materialName')}</TableHead>
              <TableHead className="w-[100px]">{t('category')}</TableHead>
              <TableHead className="w-[120px]">{t('warehouse')}</TableHead>
              <TableHead className="w-[100px] text-right">{t('quantity')}</TableHead>
              <TableHead className="w-[100px] text-right">{t('reservedQty')}</TableHead>
              <TableHead className="w-[100px] text-right">{t('availableQty')}</TableHead>
              <TableHead className="w-[80px]">{t('alertStatus')}</TableHead>
              <TableHead className="w-[100px]">{t('lastInDate')}</TableHead>
              <TableHead className="w-[100px]">{t('lastOutDate')}</TableHead>
              <TableHead className="w-[80px]">{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <BusinessListTableLoadingRows colSpan={COL_COUNT} />
            ) : items.length === 0 ? (
              <BusinessListTableEmptyRow colSpan={COL_COUNT} message={t('noInventory')} />
            ) : (
              items.map(item => (
                <TableRow
                  key={item.id}
                  className={`group ${item.alertStatus === 'low' ? 'bg-red-50/50 dark:bg-red-950/20' : item.alertStatus === 'high' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                >
                  <TableCell className={`${BUSINESS_LIST_STICKY_CELL_CLASS} font-mono text-sm`}>
                    <Truncated text={item.materialCode} />
                  </TableCell>
                  <TableCell>
                    <Truncated text={item.materialName} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <Truncated text={item.categoryName || '-'} />
                  </TableCell>
                  <TableCell>
                    <Truncated text={item.warehouseName} />
                  </TableCell>
                  <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{item.reservedQty}</TableCell>
                  <TableCell className="text-right font-mono">{item.availableQty}</TableCell>
                  <TableCell>{alertBadge(item.alertStatus)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.lastInDate || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.lastOutDate || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetail(item.materialId)}>
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </BusinessListTableShell>
      </TooltipProvider>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[75vh] w-3/5 max-w-6xl overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {t('detail')} — {detail?.materialCode} {detail?.materialName}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
          ) : detail ? (
            <Tabs defaultValue="warehouses">
              <TabsList>
                <TabsTrigger value="warehouses">{t('warehouseSummary')}</TabsTrigger>
                <TabsTrigger value="lots">{t('lotDetail')}</TabsTrigger>
                <TabsTrigger value="transactions">{t('recentTransactions')}</TabsTrigger>
              </TabsList>
              <TabsContent value="warehouses" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('warehouse')}</TableHead>
                      <TableHead className="text-right">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('reservedQty')}</TableHead>
                      <TableHead className="text-right">{t('availableQty')}</TableHead>
                      <TableHead className="text-right">{t('inventoryValue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.warehouses.map(w => (
                      <TableRow key={w.warehouseId}>
                        <TableCell>{w.warehouseName}</TableCell>
                        <TableCell className="text-right font-mono">{w.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{w.reservedQty}</TableCell>
                        <TableCell className="text-right font-mono">{w.availableQty}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(w.inventoryValue, 'USD')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="lots" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('lotNo')}</TableHead>
                      <TableHead>{t('warehouse')}</TableHead>
                      <TableHead className="text-right">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('receiptCost')}</TableHead>
                      <TableHead className="text-right">{t('ageDays')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.lots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.lots.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-sm">{l.lotNo}</TableCell>
                          <TableCell>{l.warehouseName}</TableCell>
                          <TableCell className="text-right font-mono">{l.qtyOnHand}</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(l.receiptUnitCost, 'USD')}</TableCell>
                          <TableCell className="text-right">{l.ageDays}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="transactions" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('recentTransactions')}</TableHead>
                      <TableHead>{t('warehouse')}</TableHead>
                      <TableHead className="text-right">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('beforeQty')}</TableHead>
                      <TableHead className="text-right">{t('afterQty')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.recentTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {tc('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.recentTransactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="text-sm">{tx.transactionType}</div>
                            <div className="text-muted-foreground text-xs">{tx.transactionDate}</div>
                          </TableCell>
                          <TableCell>{tx.warehouseName}</TableCell>
                          <TableCell className={`text-right font-mono ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.quantity > 0 ? '+' : ''}
                            {tx.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{tx.beforeQty}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{tx.afterQty}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
