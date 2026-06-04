'use client'

import { BadgeDollarSign, Banknote, CircleDollarSign, Clock, CreditCard, RotateCcw, Search, TrendingDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BusinessListTableEmptyRow, BusinessListTableLoadingRows, BusinessListTableShell } from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type Currency, formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { ReceiptRecordItem, ReceivableListItem } from '@/lib/tauri'
import { getReceiptRecords, getReceivables, recordReceipt } from '@/lib/tauri'

const COL_COUNT = 9

/** 状态筛选项 */
const STATUS_OPTIONS = [
  { value: 'all', labelKey: 'all' },
  { value: 'unpaid', labelKey: 'unpaid' },
  { value: 'partial', labelKey: 'partial' },
  { value: 'paid', labelKey: 'paid' },
] as const

/**
 * 应收账款页面组件
 */
export function ReceivablesPage() {
  const t = useTranslations('finance')
  const tc = useTranslations('common')

  // 列表数据
  const [items, setItems] = useState<ReceivableListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [kpi, setKpi] = useState({ totalReceivable: 0, totalReceived: 0, totalPartial: 0, totalOverdue: 0 })

  // 筛选
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // 收款弹窗
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [receiptTarget, setReceiptTarget] = useState<ReceivableListItem | null>(null)
  const [receiptAmount, setReceiptAmount] = useState('')
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [receiptMethod, setReceiptMethod] = useState('transfer')
  const [receiptRemark, setReceiptRemark] = useState('')
  const [receiptSubmitting, setReceiptSubmitting] = useState(false)

  // 收款记录弹窗
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false)
  const [recordsTarget, setRecordsTarget] = useState<ReceivableListItem | null>(null)
  const [records, setRecords] = useState<ReceiptRecordItem[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  const statusItems = useMemo(
    () => STATUS_OPTIONS.map(o => ({ value: o.value, label: o.value === 'all' ? tc('all') : t(`status.${o.labelKey}`) })),
    [t, tc],
  )

  const receiptMethodItems = useMemo(
    () => [
      { value: 'transfer', label: t('paymentMethods.transfer') },
      { value: 'cash', label: t('paymentMethods.cash') },
      { value: 'check', label: t('paymentMethods.check') },
      { value: 'other', label: t('paymentMethods.other') },
    ],
    [t],
  )

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getReceivables({
        keyword: keyword || undefined,
        status: status || undefined,
        page,
        pageSize: pageSize,
      })
      setKpi(res.summary)
      setItems(res.list.items)
      setTotal(res.list.total)
    } catch (error) {
      console.error('加载应收账款失败', error)
    } finally {
      setLoading(false)
    }
  }, [keyword, status, page])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSearch = () => {
    setKeyword(draftKeyword.trim())
    setStatus(draftStatus !== 'all' ? draftStatus : '')
    setPage(1)
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftStatus('all')
    setKeyword('')
    setStatus('')
    setPage(1)
  }

  // 打开收款弹窗
  const openReceiptDialog = (item: ReceivableListItem) => {
    setReceiptTarget(item)
    setReceiptAmount('')
    setReceiptDate(new Date().toISOString().slice(0, 10))
    setReceiptMethod('transfer')
    setReceiptRemark('')
    setReceiptDialogOpen(true)
  }

  // 确认收款
  const handleConfirmReceipt = async () => {
    if (!receiptTarget) return
    const amount = Math.round(Number(receiptAmount))
    if (!amount || amount <= 0) {
      toast.error(t('receivables.dialog.receiptAmount') + ' > 0')
      return
    }
    setReceiptSubmitting(true)
    try {
      await recordReceipt({
        receivableId: receiptTarget.id,
        receiptDate: receiptDate,
        receiptAmount: amount,
        receiptMethod: receiptMethod,
        remark: receiptRemark || undefined,
      })
      toast.success(t('receivables.toast.receiptSuccess'))
      setReceiptDialogOpen(false)
      void loadData()
    } catch (error) {
      toast.error(getErrorMessage(error, String(error)))
    } finally {
      setReceiptSubmitting(false)
    }
  }

  // 打开收款记录弹窗
  const openRecordsDialog = async (item: ReceivableListItem) => {
    setRecordsTarget(item)
    setRecordsDialogOpen(true)
    setRecordsLoading(true)
    try {
      const data = await getReceiptRecords(item.id)
      setRecords(data)
    } catch (error) {
      console.error('加载收款记录失败', error)
    } finally {
      setRecordsLoading(false)
    }
  }

  // 状态 Badge
  const statusBadge = (s: string) => {
    switch (s) {
      case 'paid':
        return (
          <Badge variant="default" className="bg-emerald-600">
            {t('status.paid')}
          </Badge>
        )
      case 'partial':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            {t('status.partial')}
          </Badge>
        )
      default:
        return <Badge variant="outline">{t('status.unpaid')}</Badge>
    }
  }

  // 类型 Badge
  const typeBadge = (type: string) => {
    if (type === 'return_offset') {
      return (
        <Badge variant="destructive" className="text-xs">
          {t('adjustmentType.returnOffset')}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs">
        {t('adjustmentType.normal')}
      </Badge>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* 页面标题 */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('receivables.title')}</h1>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/50">
            <CircleDollarSign className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('receivables.kpi.totalReceivable')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalReceivable, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-emerald-100 p-2.5 dark:bg-emerald-900/50">
            <BadgeDollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('receivables.kpi.totalReceived')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalReceived, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/50">
            <Banknote className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('receivables.kpi.totalPartial')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalPartial, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-red-100 p-2.5 dark:bg-red-900/50">
            <TrendingDown className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('receivables.kpi.totalOverdue')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalOverdue, 'USD' as Currency)}</p>
          </div>
        </div>
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
                placeholder={t('receivables.filter.search')}
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

      {/* 列表表格 */}
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell tableClassName="min-w-[1100px]">
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow>
              <TableHead className="w-[120px]">{t('receivables.table.type')}</TableHead>
              <TableHead className="w-[160px]">{t('receivables.table.orderNo')}</TableHead>
              <TableHead className="w-[140px]">{t('receivables.table.customer')}</TableHead>
              <TableHead className="w-[100px]">{t('receivables.table.receivableDate')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('receivables.table.receivableAmount')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('receivables.table.receivedAmount')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('receivables.table.unreceivedAmount')}</TableHead>
              <TableHead className="w-[90px]">{t('receivables.table.status')}</TableHead>
              <TableHead className="w-[110px]">{t('receivables.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <BusinessListTableLoadingRows colSpan={COL_COUNT} />
            ) : items.length === 0 ? (
              <BusinessListTableEmptyRow colSpan={COL_COUNT} message={tc('noData')} />
            ) : (
              items.map(item => (
                <TableRow key={item.id} className={item.adjustmentType === 'return_offset' ? 'bg-red-50/30 dark:bg-red-950/10' : ''}>
                  <TableCell>{typeBadge(item.adjustmentType)}</TableCell>
                  <TableCell className="font-mono text-sm">{item.orderNo || '-'}</TableCell>
                  <TableCell className="truncate">{item.customerName}</TableCell>
                  <TableCell className="text-sm">{item.receivableDate}</TableCell>
                  <TableCell className={`text-right font-mono ${item.receivableAmount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {formatAmount(item.receivableAmount, item.currency as Currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(item.receivedAmount, item.currency as Currency)}</TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${item.unreceivedAmount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}
                  >
                    {formatAmount(item.unreceivedAmount, item.currency as Currency)}
                  </TableCell>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.status !== 'paid' && item.adjustmentType === 'normal' && (
                        <Button variant="ghost" size="sm" onClick={() => openReceiptDialog(item)}>
                          <CreditCard className="size-4" />
                        </Button>
                      )}
                      {item.receivedAmount > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => void openRecordsDialog(item)}>
                          <Clock className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </BusinessListTableShell>
      </div>

      {/* 分页 */}
      <div className="shrink-0 pt-4">
        <PaginationControls
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* 登记收款弹窗 */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('receivables.dialog.title')}</DialogTitle>
            <DialogDescription>
              {receiptTarget?.customerName} — {receiptTarget?.orderNo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('receivables.dialog.receivableAmount')}</span>
                <p className="font-mono font-semibold">
                  {receiptTarget && formatAmount(receiptTarget.receivableAmount, receiptTarget.currency as Currency)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('receivables.dialog.unreceivedAmount')}</span>
                <p className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {receiptTarget && formatAmount(receiptTarget.unreceivedAmount, receiptTarget.currency as Currency)}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('receivables.dialog.receiptAmount')} *</Label>
              <Input type="number" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('receivables.dialog.receiptDate')} *</Label>
              <DatePicker value={receiptDate} onChange={setReceiptDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('receivables.dialog.receiptMethod')}</Label>
              <Select value={receiptMethod} onValueChange={v => v && setReceiptMethod(v)} items={receiptMethodItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {receiptMethodItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('receivables.dialog.remark')}</Label>
              <Input value={receiptRemark} onChange={e => setReceiptRemark(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              {t('receivables.dialog.cancel')}
            </Button>
            <Button onClick={() => void handleConfirmReceipt()} disabled={receiptSubmitting}>
              <CreditCard data-icon="inline-start" />
              {t('receivables.dialog.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 收款记录弹窗 */}
      <Dialog open={recordsDialogOpen} onOpenChange={setRecordsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('receivables.records.title')}</DialogTitle>
            <DialogDescription>
              {recordsTarget?.customerName} — {recordsTarget?.orderNo}
            </DialogDescription>
          </DialogHeader>
          {recordsLoading ? (
            <div className="text-muted-foreground py-8 text-center">{tc('loading')}</div>
          ) : records.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">{tc('noData')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('receivables.records.date')}</TableHead>
                  <TableHead className="text-right">{t('receivables.records.amount')}</TableHead>
                  <TableHead>{t('receivables.records.method')}</TableHead>
                  <TableHead>{t('receivables.records.remark')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(rec => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-sm">{rec.receiptDate}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(rec.receiptAmount, rec.currency as Currency)}</TableCell>
                    <TableCell className="text-sm">{rec.receiptMethod ? t(`paymentMethods.${rec.receiptMethod}`) : '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{rec.remark || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
