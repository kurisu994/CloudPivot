'use client'

import { Download, Eye, RotateCcw, Search } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { InboundOrderFilter, InboundOrderListItem, PurchaseOrderListItem } from '@/lib/tauri'
import { getInboundOrders, getPurchaseOrders } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 10

interface InboundListPageProps {
  onNewInbound: (purchaseId: number) => void
  onNewFreeInbound: () => void
}

export function InboundListPage({ onNewInbound, onNewFreeInbound }: InboundListPageProps) {
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

  useEffect(() => { void loadOrders() }, [loadOrders])
  useEffect(() => { void loadPendingPOs() }, [loadPendingPOs])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusItems = useMemo(() => [
    { value: 'all', label: t('allStatuses') },
    { value: 'draft', label: t('statusDraft') },
    { value: 'confirmed', label: t('statusConfirmed') },
  ], [t])

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
  const poItems = useMemo(() =>
    pendingPOs.map(po => ({
      value: String(po.id),
      label: `${po.orderNo} - ${po.supplierName}`,
    })),
    [pendingPOs],
  )

  const pageSizeItems = [
    { value: '10', label: t('perPage', { count: '10' }) },
    { value: '20', label: t('perPage', { count: '20' }) },
    { value: '50', label: t('perPage', { count: '50' }) },
  ]

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('inboundTitle')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('inboundDescription')}</p>
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
          <div className="w-[140px]">
            <Select value={draftStatus} onValueChange={v => v && setDraftStatus(v)} items={statusItems}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusItems.map(item => (<SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={draftDateFrom} onChange={e => setDraftDateFrom(e.target.value)} className="w-[140px]" />
            <span className="text-muted-foreground text-sm">~</span>
            <Input type="date" value={draftDateTo} onChange={e => setDraftDateTo(e.target.value)} className="w-[140px]" />
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />{tc('reset')}
          </Button>
          <Button size="sm" onClick={handleSearch}>
            <Search data-icon="inline-start" />{tc('search')}
          </Button>
        </div>
      </div>

      {/* 操作栏：从采购单入库 */}
      <div className="flex flex-wrap items-center gap-3">
        {poItems.length > 0 && (
          <Select
            value=""
            onValueChange={v => { if (v) onNewInbound(Number(v)) }}
            items={poItems}
          >
            <SelectTrigger className="w-[360px]">
              <SelectValue placeholder={t('selectPurchaseOrder')} />
            </SelectTrigger>
            <SelectContent>
              {poItems.map(item => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" onClick={() => toast.info(t('exportComingSoon'))}>
          <Download data-icon="inline-start" />{t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <BusinessListTableShell
        className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
        tableClassName="min-w-[1100px]"
        footer={
          <BusinessListTableFooter>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="font-medium">{t('totalRecords', { count: total })}</span>
              <Select value={pageSize.toString()} onValueChange={v => v && onPageSizeChange(parseInt(v))} items={pageSizeItems}>
                <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pageSizeItems.map(item => (<SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
          </BusinessListTableFooter>
        }
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`w-[170px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('inboundNo')}</TableHead>
            <TableHead className="w-[170px]">{t('sourcePurchaseOrder')}</TableHead>
            <TableHead className="w-[140px]">{t('supplier')}</TableHead>
            <TableHead className="w-[100px]">{t('inboundDate')}</TableHead>
            <TableHead className="w-[100px]">{t('inboundType')}</TableHead>
            <TableHead className="w-[100px]">{t('warehouse')}</TableHead>
            <TableHead className="w-[120px] text-right">{t('inboundAmount')}</TableHead>
            <TableHead className="w-[80px]">{tc('status')}</TableHead>
            <TableHead className="w-[100px] text-right">{tc('actions')}</TableHead>
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
                <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>
                  {order.orderNo}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {order.purchaseOrderNo ?? '—'}
                </TableCell>
                <TableCell><div className="truncate">{order.supplierName ?? '—'}</div></TableCell>
                <TableCell className="text-sm">{order.inboundDate}</TableCell>
                <TableCell className="text-sm">{inboundTypeLabel(order.inboundType)}</TableCell>
                <TableCell className="text-sm">{order.warehouseName}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(order.totalAmount, order.currency as 'VND' | 'CNY' | 'USD')}
                </TableCell>
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
  )

  // 分页回调（在组件内部使用）
  function onPageChange(p: number) { setCurrentPage(p) }
  function onPageSizeChange(s: number) { setPageSize(s); setCurrentPage(1) }
}
