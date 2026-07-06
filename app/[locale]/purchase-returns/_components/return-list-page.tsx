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
import type { InboundOrderListItem, PurchaseReturnFilter, PurchaseReturnListItem, ReturnableInboundItem } from '@/lib/tauri'
import { getInboundOrders, getPurchaseReturns, getReturnableInboundItems } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 50

const formatQuantity = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })

interface ReturnListPageProps {
  onNewReturn: (inboundId: number) => void
}

export function ReturnListPage({ onNewReturn }: ReturnListPageProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')

  const [items, setItems] = useState<PurchaseReturnListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  const [filters, setFilters] = useState<PurchaseReturnFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // 已确认的入库单（用于"从入库单退货"）
  const [confirmedInbounds, setConfirmedInbounds] = useState<InboundOrderListItem[]>([])
  const [newReturnOpen, setNewReturnOpen] = useState(false)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [selectedInboundId, setSelectedInboundId] = useState<string | null>(null)
  const [returnableItems, setReturnableItems] = useState<ReturnableInboundItem[]>([])
  const [returnableLoading, setReturnableLoading] = useState(false)

  const loadReturns = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getPurchaseReturns({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载退货单失败', error)
      toast.error(t('loadReturnError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, t])

  const loadInbounds = useCallback(async () => {
    try {
      const result = await getInboundOrders({ status: 'confirmed', page: 1, pageSize: 999 })
      setConfirmedInbounds(result.items)
    } catch (error) {
      console.error('加载入库单失败', error)
    }
  }, [])

  useEffect(() => {
    void loadReturns()
  }, [loadReturns])
  useEffect(() => {
    void loadInbounds()
  }, [loadInbounds])
  useEffect(() => {
    if (!newReturnOpen || !selectedInboundId) {
      setReturnableItems([])
      return
    }

    let ignore = false
    setReturnableLoading(true)
    void getReturnableInboundItems(Number(selectedInboundId))
      .then(result => {
        if (!ignore) {
          setReturnableItems(result)
        }
      })
      .catch(error => {
        if (!ignore) {
          console.error('加载可退明细失败', error)
          toast.error(getErrorMessage(error, t('loadReturnError')))
          setReturnableItems([])
        }
      })
      .finally(() => {
        if (!ignore) {
          setReturnableLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [newReturnOpen, selectedInboundId, t])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusItems = useMemo(
    () => [
      { value: 'all', label: t('allStatuses') },
      { value: 'draft', label: t('statusDraft') },
      { value: 'confirmed', label: t('statusConfirmed') },
    ],
    [t],
  )

  const inboundItems = useMemo(
    () =>
      confirmedInbounds
        .filter(io => selectedPurchaseId && String(io.purchaseId) === selectedPurchaseId)
        .map(io => ({
          value: String(io.id),
          label: `${io.orderNo} · ${io.inboundDate} · ${formatAmount(io.totalAmount, io.currency as 'VND' | 'CNY' | 'USD')}`,
        })),
    [confirmedInbounds, selectedPurchaseId],
  )
  const purchaseItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        purchaseOrderNo: string
        supplierName: string
        warehouseName: string
        inboundCount: number
      }
    >()

    for (const inbound of confirmedInbounds) {
      if (!inbound.purchaseId) continue
      const key = String(inbound.purchaseId)
      const current = groups.get(key)
      if (current) {
        current.inboundCount += 1
      } else {
        groups.set(key, {
          purchaseOrderNo: inbound.purchaseOrderNo ?? '—',
          supplierName: inbound.supplierName ?? '—',
          warehouseName: inbound.warehouseName,
          inboundCount: 1,
        })
      }
    }

    return Array.from(groups.entries()).map(([value, item]) => ({
      value,
      label: `${item.purchaseOrderNo} · ${item.supplierName} · ${item.warehouseName} · ${t('inboundOrderCount', { count: item.inboundCount })}`,
      ...item,
    }))
  }, [confirmedInbounds, t])
  const selectedPurchase = useMemo(() => purchaseItems.find(item => item.value === selectedPurchaseId) ?? null, [purchaseItems, selectedPurchaseId])
  const selectedInbound = useMemo(
    () => confirmedInbounds.find(io => String(io.id) === selectedInboundId) ?? null,
    [confirmedInbounds, selectedInboundId],
  )

  const handleOpenNewReturn = () => {
    setSelectedPurchaseId(null)
    setSelectedInboundId(null)
    setReturnableItems([])
    setNewReturnOpen(true)
    void loadInbounds()
  }

  const handleSelectPurchase = (value: string | null) => {
    setSelectedPurchaseId(value)
    setSelectedInboundId(null)
    setReturnableItems([])
  }

  const handleConfirmNewReturn = () => {
    if (!selectedPurchaseId || !selectedPurchase) {
      toast.error(t('fieldRequired', { field: t('sourcePurchaseOrder') }))
      return
    }
    if (!selectedInboundId || !selectedInbound) {
      toast.error(t('fieldRequired', { field: t('sourceInbound') }))
      return
    }
    if (returnableItems.length === 0) {
      toast.error(t('noReturnableItems'))
      return
    }
    setNewReturnOpen(false)
    onNewReturn(Number(selectedInboundId))
  }

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
        <Button onClick={handleOpenNewReturn}>
          <Plus data-icon="inline-start" />
          {t('newReturn')}
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
          tableClassName="min-w-[50rem]"
        >
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-[8.75rem] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('returnNo')}</TableHead>
              <TableHead className="w-[8.75rem]">{t('sourcePurchaseOrder')}</TableHead>
              <TableHead className="w-[8.75rem]">{t('sourceInbound')}</TableHead>
              <TableHead className="w-[6.875rem]">{t('supplier')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('returnDate')}</TableHead>
              <TableHead className="w-[6.25rem] text-right">{t('returnAmount')}</TableHead>
              <TableHead className="w-[6.875rem]">{t('returnReason')}</TableHead>
              <TableHead className="w-[4.375rem]">{tc('status')}</TableHead>
              <TableHead className="w-[4.375rem] text-right">{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <BusinessListTableLoadingRows colSpan={9} />
            ) : items.length === 0 ? (
              <BusinessListTableEmptyRow colSpan={9} message={tc('noData')} />
            ) : (
              items.map(item => (
                <TableRow key={item.id} className="group">
                  <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{item.returnNo}</TableCell>
                  <TableCell className="font-mono text-xs">{item.purchaseOrderNo ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{item.inboundOrderNo}</TableCell>
                  <TableCell>
                    <div className="truncate">{item.supplierName}</div>
                  </TableCell>
                  <TableCell className="text-sm">{item.returnDate}</TableCell>
                  <TableCell className="text-right font-medium">{formatAmount(item.totalAmount, item.currency as 'VND' | 'CNY' | 'USD')}</TableCell>
                  <TableCell className="text-muted-foreground truncate text-sm">{item.returnReason ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                      {item.status === 'confirmed' ? t('statusConfirmed') : t('statusDraft')}
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

      <Dialog open={newReturnOpen} onOpenChange={setNewReturnOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('newReturnDialogTitle')}</DialogTitle>
            <DialogDescription>{t('newReturnDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Combobox
              items={purchaseItems}
              value={selectedPurchaseId}
              onValueChange={handleSelectPurchase}
              placeholder={t('selectReturnPurchaseOrder')}
              emptyText={t('noReturnablePurchaseOrders')}
              disabled={purchaseItems.length === 0}
              popupClassName="max-w-[calc(100vw-2rem)] sm:min-w-[36rem]"
              itemLabelClassName="whitespace-normal break-words"
            />

            {selectedPurchase ? (
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground text-xs">{t('sourcePurchaseOrder')}</div>
                  <div className="font-mono font-medium">{selectedPurchase.purchaseOrderNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t('supplier')}</div>
                  <div className="font-medium">{selectedPurchase.supplierName}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t('warehouse')}</div>
                  <div>{selectedPurchase.warehouseName}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t('sourceInbound')}</div>
                  <div>{t('inboundOrderCount', { count: selectedPurchase.inboundCount })}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-muted-foreground text-sm">
                {purchaseItems.length === 0 ? t('noReturnablePurchaseOrders') : t('selectReturnPurchaseOrder')}
              </div>
            )}

            {selectedPurchase && (
              <Combobox
                items={inboundItems}
                value={selectedInboundId}
                onValueChange={setSelectedInboundId}
                placeholder={t('selectInboundOrder')}
                emptyText={t('noConfirmedInboundOrders')}
                disabled={inboundItems.length === 0}
                popupClassName="max-w-[calc(100vw-2rem)] sm:min-w-[36rem]"
                itemLabelClassName="whitespace-normal break-words"
              />
            )}

            {selectedInbound && (
              <div className="rounded-lg border p-3">
                <div className="mb-3 font-medium text-sm">{t('returnableDetails')}</div>
                {returnableLoading ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">{tc('loading')}</div>
                ) : returnableItems.length > 0 ? (
                  <div className="flex max-h-56 flex-col gap-2 overflow-auto">
                    {returnableItems.map(item => (
                      <div key={item.inboundItemId} className="rounded-md bg-muted/30 p-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="truncate font-medium text-sm">
                            {item.materialCode} · {item.materialName}
                          </div>
                          <div className="text-muted-foreground text-xs">{item.spec || '—'}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-right text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">{t('inboundQuantity')}</div>
                            <div className="font-mono">
                              {formatQuantity(item.inboundQuantity)} {item.unitNameSnapshot}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">{t('alreadyReturned')}</div>
                            <div className="font-mono">
                              {formatQuantity(item.alreadyReturnedQty)} {item.unitNameSnapshot}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">{t('returnableQty')}</div>
                            <div className="font-mono font-semibold">
                              {formatQuantity(item.returnableQty)} {item.unitNameSnapshot}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-muted-foreground text-sm">{t('noReturnableItems')}</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewReturnOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleConfirmNewReturn}
              disabled={
                !selectedPurchaseId ||
                !selectedPurchase ||
                !selectedInboundId ||
                !selectedInbound ||
                returnableLoading ||
                returnableItems.length === 0
              }
            >
              {t('startReturn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
