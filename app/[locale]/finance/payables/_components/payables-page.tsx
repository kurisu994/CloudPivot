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
import type { PayableListItem, PaymentRecordItem } from '@/lib/tauri'
import { getPayables, getPaymentRecords, recordPayment } from '@/lib/tauri'

const COL_COUNT = 9

/** 状态筛选项 */
const STATUS_OPTIONS = [
  { value: 'all', labelKey: 'all' },
  { value: 'unpaid', labelKey: 'unpaid' },
  { value: 'partial', labelKey: 'partial' },
  { value: 'paid', labelKey: 'paid' },
] as const

/**
 * 应付账款页面组件
 */
export function PayablesPage() {
  const t = useTranslations('finance')
  const tc = useTranslations('common')

  // 列表数据
  const [items, setItems] = useState<PayableListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [kpi, setKpi] = useState({ totalPayable: 0, totalPaid: 0, totalPartial: 0, totalOverdue: 0 })

  // 筛选
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // 付款弹窗
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<PayableListItem | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState('transfer')
  const [payRemark, setPayRemark] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  // 付款记录弹窗
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false)
  const [recordsTarget, setRecordsTarget] = useState<PayableListItem | null>(null)
  const [records, setRecords] = useState<PaymentRecordItem[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  const statusItems = useMemo(
    () => STATUS_OPTIONS.map(o => ({ value: o.value, label: o.value === 'all' ? tc('all') : t(`status.${o.labelKey}`) })),
    [t, tc],
  )

  const payMethodItems = useMemo(
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
      const res = await getPayables({
        keyword: keyword || undefined,
        status: status || undefined,
        page,
        pageSize: pageSize,
      })
      setKpi(res.summary)
      setItems(res.list.items)
      setTotal(res.list.total)
    } catch (error) {
      console.error('加载应付账款失败', error)
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

  // 打开付款弹窗
  const openPayDialog = (item: PayableListItem) => {
    setPayTarget(item)
    setPayAmount('')
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayMethod('transfer')
    setPayRemark('')
    setPayDialogOpen(true)
  }

  // 确认付款
  const handleConfirmPayment = async () => {
    if (!payTarget) return
    const amount = Math.round(Number(payAmount))
    if (!amount || amount <= 0) {
      toast.error(t('payables.dialog.paymentAmount') + ' > 0')
      return
    }
    setPaySubmitting(true)
    try {
      await recordPayment({
        payableId: payTarget.id,
        paymentDate: payDate,
        paymentAmount: amount,
        paymentMethod: payMethod,
        remark: payRemark || undefined,
      })
      toast.success(t('payables.toast.paymentSuccess'))
      setPayDialogOpen(false)
      void loadData()
    } catch (error) {
      toast.error(getErrorMessage(error, String(error)))
    } finally {
      setPaySubmitting(false)
    }
  }

  // 打开付款记录弹窗
  const openRecordsDialog = async (item: PayableListItem) => {
    setRecordsTarget(item)
    setRecordsDialogOpen(true)
    setRecordsLoading(true)
    try {
      const data = await getPaymentRecords(item.id)
      setRecords(data)
    } catch (error) {
      console.error('加载付款记录失败', error)
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
        <h1 className="text-foreground text-2xl font-bold">{t('payables.title')}</h1>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/50">
            <CircleDollarSign className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('payables.kpi.totalPayable')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalPayable, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-emerald-100 p-2.5 dark:bg-emerald-900/50">
            <BadgeDollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('payables.kpi.totalPaid')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalPaid, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/50">
            <Banknote className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('payables.kpi.totalPartial')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalPartial, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-red-100 p-2.5 dark:bg-red-900/50">
            <TrendingDown className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('payables.kpi.totalOverdue')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(kpi.totalOverdue, 'USD' as Currency)}</p>
          </div>
        </div>
      </div>

      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[13.75rem] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={draftKeyword}
                onChange={e => setDraftKeyword(e.target.value)}
                placeholder={t('payables.filter.search')}
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
        <BusinessListTableShell tableClassName="min-w-[55rem]">
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow>
              <TableHead className="w-[5.5rem]">{t('payables.table.type')}</TableHead>
              <TableHead className="w-[8.125rem]">{t('payables.table.orderNo')}</TableHead>
              <TableHead className="w-[6.875rem]">{t('payables.table.supplier')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('payables.table.payableDate')}</TableHead>
              <TableHead className="w-[6.25rem] text-right">{t('payables.table.payableAmount')}</TableHead>
              <TableHead className="w-[6.25rem] text-right">{t('payables.table.paidAmount')}</TableHead>
              <TableHead className="w-[6.25rem] text-right">{t('payables.table.unpaidAmount')}</TableHead>
              <TableHead className="w-[4.5rem]">{t('payables.table.status')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('payables.table.actions')}</TableHead>
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
                  <TableCell className="truncate">{item.supplierName}</TableCell>
                  <TableCell className="text-sm">{item.payableDate}</TableCell>
                  <TableCell className={`text-right font-mono ${item.payableAmount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {formatAmount(item.payableAmount, item.currency as Currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(item.paidAmount, item.currency as Currency)}</TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${item.unpaidAmount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                    {formatAmount(item.unpaidAmount, item.currency as Currency)}
                  </TableCell>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.status !== 'paid' && item.adjustmentType === 'normal' && (
                        <Button variant="ghost" size="sm" onClick={() => openPayDialog(item)}>
                          <CreditCard className="size-4" />
                        </Button>
                      )}
                      {item.paidAmount > 0 && (
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

      {/* 登记付款弹窗 */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payables.dialog.title')}</DialogTitle>
            <DialogDescription>
              {payTarget?.supplierName} — {payTarget?.orderNo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('payables.dialog.payableAmount')}</span>
                <p className="font-mono font-semibold">{payTarget && formatAmount(payTarget.payableAmount, payTarget.currency as Currency)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('payables.dialog.unpaidAmount')}</span>
                <p className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {payTarget && formatAmount(payTarget.unpaidAmount, payTarget.currency as Currency)}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('payables.dialog.paymentAmount')} *</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('payables.dialog.paymentDate')} *</Label>
              <DatePicker value={payDate} onChange={setPayDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('payables.dialog.paymentMethod')}</Label>
              <Select value={payMethod} onValueChange={v => v && setPayMethod(v)} items={payMethodItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {payMethodItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('payables.dialog.remark')}</Label>
              <Input value={payRemark} onChange={e => setPayRemark(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              {t('payables.dialog.cancel')}
            </Button>
            <Button onClick={() => void handleConfirmPayment()} disabled={paySubmitting}>
              <CreditCard data-icon="inline-start" />
              {t('payables.dialog.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 付款记录弹窗 */}
      <Dialog open={recordsDialogOpen} onOpenChange={setRecordsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('payables.records.title')}</DialogTitle>
            <DialogDescription>
              {recordsTarget?.supplierName} — {recordsTarget?.orderNo}
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
                  <TableHead>{t('payables.records.date')}</TableHead>
                  <TableHead className="text-right">{t('payables.records.amount')}</TableHead>
                  <TableHead>{t('payables.records.method')}</TableHead>
                  <TableHead>{t('payables.records.remark')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(rec => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-sm">{rec.paymentDate}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(rec.paymentAmount, rec.currency as Currency)}</TableCell>
                    <TableCell className="text-sm">{rec.paymentMethod ? t(`paymentMethods.${rec.paymentMethod}`) : '-'}</TableCell>
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
