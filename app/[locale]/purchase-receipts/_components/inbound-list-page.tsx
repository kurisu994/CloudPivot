'use client'

import { Download, Eye, Plus, RotateCcw, Search } from 'lucide-react'
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
import { Combobox } from '@/components/ui/combobox'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { InboundOrderFilter, InboundOrderListItem, PurchaseOrderDetail, PurchaseOrderListItem } from '@/lib/tauri'
import { getInboundOrders, getPurchaseOrderDetail, getPurchaseOrders } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 50

const formatQuantity = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })

interface InboundListPageProps {
  onNewInbound: (purchaseId: number) => void
}

export function InboundListPage({ onNewInbound }: InboundListPageProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')

  const [items, setItems] = useState<InboundOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  const [filters, setFilters] = useState<InboundOrderFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // 可入库的采购单列表（用于"从采购单入库"）
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrderListItem[]>([])
  const [newInboundOpen, setNewInboundOpen] = useState(false)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [selectedPODetail, setSelectedPODetail] = useState<PurchaseOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getInboundOrders({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载入库单失败', error)
      toast.error(t('loadInboundError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, t])

  const loadPendingPOs = useCallback(async () => {
    try {
      // 获取已审核和部分入库的采购单
      const approved = await getPurchaseOrders({ status: 'approved', page: 1, pageSize: 999 })
      const partial = await getPurchaseOrders({ status: 'partial_in', page: 1, pageSize: 999 })
      setPendingPOs([...approved.items, ...partial.items])
    } catch (error) {
      console.error('加载待入库采购单失败', error)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])
  useEffect(() => {
    void loadPendingPOs()
  }, [loadPendingPOs])
  useEffect(() => {
    if (!newInboundOpen || !selectedPurchaseId) {
      setSelectedPODetail(null)
      return
    }

    let ignore = false
    setDetailLoading(true)
    void getPurchaseOrderDetail(Number(selectedPurchaseId))
      .then(detail => {
        if (!ignore) {
          setSelectedPODetail(detail)
        }
      })
      .catch(error => {
        if (!ignore) {
          console.error('加载采购单入库进度失败', error)
          toast.error(getErrorMessage(error, t('loadError')))
          setSelectedPODetail(null)
        }
      })
      .finally(() => {
        if (!ignore) {
          setDetailLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [newInboundOpen, selectedPurchaseId, t])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusItems = useMemo(
    () => [
      { value: 'all', label: t('allStatuses') },
      { value: 'draft', label: t('statusDraft') },
      { value: 'confirmed', label: t('statusConfirmed') },
    ],
    [t],
  )

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      status: draftStatus !== 'all' ? draftStatus : undefined,
      dateFrom: draftDateFrom || undefined,
      dateTo: draftDateTo || undefined,
      page: 1,
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftStatus('all')
    setDraftDateFrom('')
    setDraftDateTo('')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  // 从采购单入库的下拉选项
  const poItems = useMemo(
    () =>
      pendingPOs.map(po => ({
        value: String(po.id),
        label: `${po.orderNo} · ${po.supplierName} · ${po.warehouseName}`,
      })),
    [pendingPOs],
  )
  const selectedPO = useMemo(() => pendingPOs.find(po => String(po.id) === selectedPurchaseId) ?? null, [pendingPOs, selectedPurchaseId])
  const remainingDetailRows = useMemo(
    () =>
      (selectedPODetail?.items ?? [])
        .map(item => {
          const receivedQty = item.receivedQty ?? 0
          return {
            id: item.id ?? `${item.materialId}-${item.sortOrder ?? 0}`,
            materialCode: item.materialCode ?? '',
            materialName: item.materialName ?? '',
            spec: item.spec ?? '',
            unitName: item.unitNameSnapshot,
            orderQuantity: item.quantity,
            receivedQty,
            remainingQty: Math.max(item.quantity - receivedQty, 0),
          }
        })
        .filter(item => item.remainingQty > 0),
    [selectedPODetail],
  )

  const handleOpenNewInbound = () => {
    setSelectedPurchaseId(null)
    setSelectedPODetail(null)
    setNewInboundOpen(true)
    void loadPendingPOs()
  }

  const handleConfirmNewInbound = () => {
    if (!selectedPurchaseId || !selectedPO) {
      toast.error(t('fieldRequired', { field: t('sourcePurchaseOrder') }))
      return
    }
    setNewInboundOpen(false)
    onNewInbound(Number(selectedPurchaseId))
  }

  const inboundTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      purchase: t('typePurchase'),
      return: t('typeReturn'),
      production: t('typeProduction'),
      other: t('typeOther'),
    }
    return map[type] || type
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[13.75rem] flex-1">
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
          <div className="w-[8.75rem]">
            <Select value={draftStatus} onValueChange={v => v && setDraftStatus(v)} items={statusItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
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
            className="w-[17.5rem]"
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

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleOpenNewInbound}>
          <Plus data-icon="inline-start" />
          {t('newInbound')}
        </Button>
        <Button variant="outline" onClick={() => toast.info(t('exportComingSoon'))}>
          <Download data-icon="inline-start" />
          {t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell
          className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          tableClassName="min-w-[55rem]"
        >
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-[8.75rem] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('inboundNo')}</TableHead>
              <TableHead className="w-[8.75rem]">{t('sourcePurchaseOrder')}</TableHead>
              <TableHead className="w-[6.875rem]">{t('supplier')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('inboundDate')}</TableHead>
              <TableHead className="w-[5rem]">{t('inboundType')}</TableHead>
              <TableHead className="w-[5rem]">{t('warehouse')}</TableHead>
              <TableHead className="w-[6.25rem] text-right">{t('inboundAmount')}</TableHead>
              <TableHead className="w-[4.375rem]">{tc('status')}</TableHead>
              <TableHead className="w-[5rem] text-right">{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <BusinessListTableLoadingRows colSpan={9} />
            ) : items.length === 0 ? (
              <BusinessListTableEmptyRow colSpan={9} message={tc('noData')} />
            ) : (
              items.map(order => (
                <TableRow key={order.id} className="group">
                  <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{order.orderNo}</TableCell>
                  <TableCell className="font-mono text-xs">{order.purchaseOrderNo ?? '—'}</TableCell>
                  <TableCell>
                    <div className="truncate">{order.supplierName ?? '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm">{order.inboundDate}</TableCell>
                  <TableCell className="text-sm">{inboundTypeLabel(order.inboundType)}</TableCell>
                  <TableCell className="text-sm">{order.warehouseName}</TableCell>
                  <TableCell className="text-right font-medium">{formatAmount(order.totalAmount, order.currency as 'VND' | 'CNY' | 'USD')}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                      {order.status === 'confirmed' ? t('statusConfirmed') : t('statusDraft')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('details')}>
                      <Eye className="size-3.5" />
                    </Button>
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
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </BusinessListTableFooter>
      </div>

      <Dialog open={newInboundOpen} onOpenChange={setNewInboundOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('newInboundDialogTitle')}</DialogTitle>
            <DialogDescription>{t('newInboundDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Combobox
              items={poItems}
              value={selectedPurchaseId}
              onValueChange={setSelectedPurchaseId}
              placeholder={t('selectPurchaseOrder')}
              emptyText={t('noPendingPurchaseOrders')}
              disabled={pendingPOs.length === 0}
              popupClassName="max-w-[calc(100vw-2rem)] sm:min-w-[36rem]"
              itemLabelClassName="whitespace-normal break-words"
            />

            {selectedPO ? (
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground text-xs">{t('sourcePurchaseOrder')}</div>
                  <div className="font-mono font-medium">{selectedPO.orderNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t('supplier')}</div>
                  <div className="font-medium">{selectedPO.supplierName}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t('warehouse')}</div>
                  <div>{selectedPO.warehouseName}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t('payableAmount')}</div>
                  <div className="font-medium">{formatAmount(selectedPO.payableAmount, selectedPO.currency as 'VND' | 'CNY' | 'USD')}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-muted-foreground text-sm">
                {pendingPOs.length === 0 ? t('noPendingPurchaseOrders') : t('selectPurchaseOrder')}
              </div>
            )}

            {selectedPO && (
              <div className="rounded-lg border p-3">
                <div className="mb-3 font-medium text-sm">{t('remainingInboundDetails')}</div>
                {detailLoading ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">{tc('loading')}</div>
                ) : remainingDetailRows.length > 0 ? (
                  <div className="flex max-h-56 flex-col gap-2 overflow-auto">
                    {remainingDetailRows.map(item => (
                      <div key={item.id} className="rounded-md bg-muted/30 p-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="truncate font-medium text-sm">
                            {item.materialCode} · {item.materialName}
                          </div>
                          <div className="text-muted-foreground text-xs">{item.spec || '—'}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-right text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">{t('orderQuantity')}</div>
                            <div className="font-mono">
                              {formatQuantity(item.orderQuantity)} {item.unitName}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">{t('receivedQty')}</div>
                            <div className="font-mono">
                              {formatQuantity(item.receivedQty)} {item.unitName}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">{t('remainingQty')}</div>
                            <div className="font-mono font-semibold">
                              {formatQuantity(item.remainingQty)} {item.unitName}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-muted-foreground text-sm">{t('noRemainingItems')}</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewInboundOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleConfirmNewInbound} disabled={!selectedPurchaseId || !selectedPO}>
              {t('startInbound')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
