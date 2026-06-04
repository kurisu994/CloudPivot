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
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { OutboundOrderFilter, OutboundOrderListItem } from '@/lib/tauri'
import { getOutboundOrders, invoke } from '@/lib/tauri'
import type { SalesOrderListItem } from '../../sales-orders/_components/sales-order-table'

const DEFAULT_PAGE_SIZE = 50

interface OutboundListPageProps {
  onNewOutbound: (salesId: number) => void
}

export function OutboundListPage({ onNewOutbound }: OutboundListPageProps) {
  const t = useTranslations('sales')
  const tc = useTranslations('common')

  const [items, setItems] = useState<OutboundOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  const [filters, setFilters] = useState<OutboundOrderFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // 可出库的销售单列表（已审核 + 部分出库）
  const [pendingSOs, setPendingSOs] = useState<SalesOrderListItem[]>([])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getOutboundOrders({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载出库单失败', error)
      toast.error(t('loadOutboundError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, t])

  const loadPendingSOs = useCallback(async () => {
    try {
      // 获取已审核和部分出库的销售单
      const approved = await invoke<{ total: number; items: SalesOrderListItem[] }>('get_sales_orders', {
        filter: { status: 'approved', page: 1, pageSize: 999 },
      })
      const partial = await invoke<{ total: number; items: SalesOrderListItem[] }>('get_sales_orders', {
        filter: { status: 'partial_out', page: 1, pageSize: 999 },
      })
      setPendingSOs([...approved.items, ...partial.items])
    } catch (error) {
      console.error('加载待出库销售单失败', error)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])
  useEffect(() => {
    void loadPendingSOs()
  }, [loadPendingSOs])

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

  // 从销售单出库的下拉选项
  const soItems = useMemo(
    () =>
      pendingSOs.map(so => ({
        value: String(so.id),
        label: `${so.orderNo} - ${so.customerName}`,
      })),
    [pendingSOs],
  )

  const outboundTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      sales: t('typeSales'),
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

      {/* 操作栏：从销售单出库 */}
      <div className="flex flex-wrap items-center gap-3">
        {soItems.length > 0 && (
          <Select
            value=""
            onValueChange={v => {
              if (v) onNewOutbound(Number(v))
            }}
            items={soItems}
          >
            <SelectTrigger className="w-[360px]">
              <SelectValue placeholder={t('selectSalesOrder')} />
            </SelectTrigger>
            <SelectContent>
              {soItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" onClick={() => toast.info(t('exportComingSoon'))}>
          <Download data-icon="inline-start" />
          {t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell
          className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          tableClassName="min-w-[1100px]"
        >
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-[170px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('outboundNo')}</TableHead>
              <TableHead className="w-[170px]">{t('sourceSalesOrder')}</TableHead>
              <TableHead className="w-[140px]">{t('customer')}</TableHead>
              <TableHead className="w-[100px]">{t('outboundDate')}</TableHead>
              <TableHead className="w-[100px]">{t('outboundType')}</TableHead>
              <TableHead className="w-[100px]">{t('warehouse')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('outboundAmount')}</TableHead>
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
                  <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{order.orderNo}</TableCell>
                  <TableCell className="font-mono text-xs">{order.salesOrderNo ?? '—'}</TableCell>
                  <TableCell>
                    <div className="truncate">{order.customerName ?? '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm">{order.outboundDate}</TableCell>
                  <TableCell className="text-sm">{outboundTypeLabel(order.outboundType)}</TableCell>
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
    </div>
  )
}
