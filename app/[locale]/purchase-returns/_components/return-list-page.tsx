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
import type { InboundOrderListItem, PurchaseReturnFilter, PurchaseReturnListItem } from '@/lib/tauri'
import { getInboundOrders, getPurchaseReturns } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 10

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

  useEffect(() => { void loadReturns() }, [loadReturns])
  useEffect(() => { void loadInbounds() }, [loadInbounds])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusItems = useMemo(() => [
    { value: 'all', label: t('allStatuses') },
    { value: 'draft', label: t('statusDraft') },
    { value: 'confirmed', label: t('statusConfirmed') },
  ], [t])

  const inboundItems = useMemo(() =>
    confirmedInbounds.map(io => ({
      value: String(io.id),
      label: `${io.orderNo} - ${io.supplierName ?? ''}`,
    })),
    [confirmedInbounds],
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
    setDraftKeyword(''); setDraftStatus('all'); setDraftDateFrom(''); setDraftDateTo('')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  const pageSizeItems = [
    { value: '10', label: t('perPage', { count: '10' }) },
    { value: '20', label: t('perPage', { count: '20' }) },
    { value: '50', label: t('perPage', { count: '50' }) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('returnTitle')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('returnDescription')}</p>
      </div>

      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={draftKeyword} onChange={e => setDraftKeyword(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
          </div>
          <div className="w-[140px]">
            <Select value={draftStatus} onValueChange={v => v && setDraftStatus(v)} items={statusItems}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusItems.map(item => (<SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={draftDateFrom} onChange={e => setDraftDateFrom(e.target.value)} className="w-[140px]" />
            <span className="text-muted-foreground text-sm">~</span>
            <Input type="date" value={draftDateTo} onChange={e => setDraftDateTo(e.target.value)} className="w-[140px]" />
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw data-icon="inline-start" />{tc('reset')}</Button>
          <Button size="sm" onClick={handleSearch}><Search data-icon="inline-start" />{tc('search')}</Button>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-3">
        {inboundItems.length > 0 && (
          <Select value="" onValueChange={v => { if (v) onNewReturn(Number(v)) }} items={inboundItems}>
            <SelectTrigger className="w-[360px]">
              <SelectValue placeholder={t('selectInboundOrder')} />
            </SelectTrigger>
            <SelectContent>{inboundItems.map(item => (<SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>))}</SelectContent>
          </Select>
        )}
        <Button variant="outline" onClick={() => toast.info(t('exportComingSoon'))}>
          <Download data-icon="inline-start" />{t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <BusinessListTableShell
        className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
        tableClassName="min-w-[1000px]"
        footer={
          <BusinessListTableFooter>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="font-medium">{t('totalRecords', { count: total })}</span>
              <Select value={pageSize.toString()} onValueChange={v => v && setPageSize(parseInt(v))} items={pageSizeItems}>
                <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{pageSizeItems.map(item => (<SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </BusinessListTableFooter>
        }
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`w-[170px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('returnNo')}</TableHead>
            <TableHead className="w-[170px]">{t('sourceInbound')}</TableHead>
            <TableHead className="w-[140px]">{t('supplier')}</TableHead>
            <TableHead className="w-[100px]">{t('returnDate')}</TableHead>
            <TableHead className="w-[120px] text-right">{t('returnAmount')}</TableHead>
            <TableHead className="w-[140px]">{t('returnReason')}</TableHead>
            <TableHead className="w-[80px]">{tc('status')}</TableHead>
            <TableHead className="w-[80px] text-right">{tc('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={8} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={8} message={tc('noData')} />
          ) : (
            items.map(item => (
              <TableRow key={item.id} className="group">
                <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{item.returnNo}</TableCell>
                <TableCell className="font-mono text-xs">{item.inboundOrderNo}</TableCell>
                <TableCell><div className="truncate">{item.supplierName}</div></TableCell>
                <TableCell className="text-sm">{item.returnDate}</TableCell>
                <TableCell className="text-right font-medium">{formatAmount(item.totalAmount, item.currency as 'VND' | 'CNY' | 'USD')}</TableCell>
                <TableCell className="text-muted-foreground truncate text-sm">{item.returnReason ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                    {item.status === 'confirmed' ? t('statusConfirmed') : t('statusDraft')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('details')}><Eye className="size-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>
    </div>
  )
}
