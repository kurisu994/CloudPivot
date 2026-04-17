'use client'

import { CheckCircle2, CircleDollarSign, Mail, Phone, TrendingUp, User2, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatAmount } from '@/lib/currency'
import type { CustomerDetailResponse } from '@/lib/tauri'
import { getCustomerDetail } from '@/lib/tauri'

interface CustomerDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number | null
}

export function CustomerDetailDialog({ open, onOpenChange, customerId }: CustomerDetailDialogProps) {
  const t = useTranslations('customers')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<CustomerDetailResponse | null>(null)

  useEffect(() => {
    if (!open || customerId === null) {
      setDetail(null)
      return
    }

    setLoading(true)
    void getCustomerDetail(customerId)
      .then(setDetail)
      .catch(error => {
        console.error('加载客户详情失败', error)
        setDetail(null)
        toast.error(t('toast.loadError'))
      })
      .finally(() => setLoading(false))
  }, [open, customerId, t])

  // 计算 KPI 统计数据
  const totalSales = detail?.recentSalesOrders.reduce((acc, curr) => acc + curr.totalAmount, 0) || 0
  const totalReceivable = detail?.receivablesSummary.records.reduce((acc, curr) => acc + curr.receivableAmount, 0) || 0
  const totalReceived = totalReceivable - (detail?.receivablesSummary.totalUnpaidAmount || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden bg-slate-50 p-0 sm:max-w-5xl dark:bg-slate-900 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('detail.title')}</DialogTitle>
          <DialogDescription>{t('dialog.detailDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto w-full">
          {loading || !detail ? (
            <div className="flex flex-col gap-6 p-8">
              <Skeleton className="h-16 w-1/3" />
              <div className="grid grid-cols-3 gap-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-8">
              {/* Header 区域 */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{detail.customer.name}</h2>
                    <Badge
                      variant="outline"
                      className={
                        detail.customer.isEnabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium px-2 py-0.5'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 font-medium px-2 py-0.5'
                      }
                    >
                      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${detail.customer.isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {detail.customer.isEnabled ? t('status.enabled') : t('status.disabled')}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      {t(`customerType.${detail.customer.customerType}`)}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      {t(`grade.${detail.customer.grade}`)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[13px] font-bold tracking-widest text-primary uppercase">{detail.customer.code}</div>
                </div>
              </div>

              {/* 三大 KPI 卡片 */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                {/* 销售总额 */}
                <Card className="relative overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('detail.totalSales')}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatAmount(totalSales, detail.customer.currency as 'VND' | 'CNY' | 'USD')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="mr-1 h-3.5 w-3.5" />
                      {detail.recentSalesOrders.length} {t('detail.salesOrders')}
                    </div>
                    <CircleDollarSign className="absolute -bottom-4 -right-4 h-24 w-24 text-slate-50 opacity-60 dark:text-slate-800/50" />
                  </CardContent>
                </Card>

                {/* 应收余额 */}
                <Card className="relative overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('detail.receivableBalance')}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatAmount(detail.receivablesSummary.totalUnpaidAmount, detail.customer.currency as 'VND' | 'CNY' | 'USD')}
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full w-[35%] rounded-full bg-rose-500 dark:bg-rose-600" />
                    </div>
                    <Wallet className="absolute -bottom-4 -right-4 h-24 w-24 text-slate-50 opacity-60 dark:text-slate-800/50" />
                  </CardContent>
                </Card>

                {/* 已收金额 */}
                <Card className="relative overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('detail.receivedAmount')}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatAmount(totalReceived, detail.customer.currency as 'VND' | 'CNY' | 'USD')}
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full w-[65%] rounded-full bg-primary" />
                    </div>
                    <CheckCircle2 className="absolute -bottom-4 -right-4 h-24 w-24 text-slate-50 opacity-60 dark:text-slate-800/50" />
                  </CardContent>
                </Card>
              </div>

              {/* 联系信息条 */}
              <div className="grid grid-cols-3 gap-6 rounded-2xl border border-slate-200/60 bg-slate-50/50 py-5 px-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/30 mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <User2 className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.contactPerson')}</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-900 dark:text-white">{detail.customer.contactPerson || '—'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.contactPhone')}</div>
                    <div className="mt-0.5 truncate font-mono font-medium tracking-tight text-slate-900 dark:text-white">
                      {detail.customer.contactPhone || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('form.email')}</div>
                    <div className="mt-0.5 truncate font-medium text-slate-900 dark:text-white">{detail.customer.email || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Tabs 切换区域 */}
              <div className="flex-1 min-h-0 flex flex-col">
                <Tabs defaultValue="salesOrders" className="flex flex-col h-full">
                  <div className="border-b border-slate-200 px-2 pb-0 dark:border-slate-800">
                    <TabsList className="flex h-auto w-auto justify-start gap-8 bg-transparent p-0">
                      <TabsTrigger
                        value="salesOrders"
                        className="rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:text-slate-400 dark:hover:text-white data-[state=active]:dark:text-primary"
                      >
                        {t('detail.salesOrders')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="receivables"
                        className="rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:text-slate-400 dark:hover:text-white data-[state=active]:dark:text-primary"
                      >
                        {t('detail.receivables')}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto py-6 px-1">
                    {/* 销售记录 Tab */}
                    <TabsContent value="salesOrders" className="m-0 focus-visible:outline-none">
                      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <Table>
                          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                            <TableRow>
                              <TableHead className="font-medium">{t('detail.orderNo')}</TableHead>
                              <TableHead className="font-medium">{t('detail.orderDate')}</TableHead>
                              <TableHead className="font-medium">{t('detail.orderStatus')}</TableHead>
                              <TableHead className="font-medium">{t('detail.currency')}</TableHead>
                              <TableHead className="text-right font-medium">{t('detail.totalAmount')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.recentSalesOrders.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">
                                  {t('detail.noSalesOrders')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              detail.recentSalesOrders.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                  <TableCell className="font-semibold text-slate-900 dark:text-white">{item.orderNo}</TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">{item.orderDate}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="font-normal">
                                      {t(`salesStatus.${item.status}`)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">{item.currency}</TableCell>
                                  <TableCell className="text-right font-medium text-slate-900 dark:text-white">
                                    {formatAmount(item.totalAmount, item.currency)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    {/* 应收对账 Tab */}
                    <TabsContent value="receivables" className="m-0 focus-visible:outline-none">
                      {/* 应收摘要统计 */}
                      <div className="mb-4 flex items-center gap-6">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{t('detail.overdueCount')}:</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">{detail.receivablesSummary.overdueCount}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{t('detail.openCount')}:</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{detail.receivablesSummary.openCount}</span>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <Table>
                          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                            <TableRow>
                              <TableHead className="font-medium">{t('detail.orderNo')}</TableHead>
                              <TableHead className="font-medium">{t('detail.receivableDate')}</TableHead>
                              <TableHead className="font-medium">{t('detail.dueDate')}</TableHead>
                              <TableHead className="font-medium">{t('detail.currency')}</TableHead>
                              <TableHead className="text-right font-medium">{t('detail.receivableAmount')}</TableHead>
                              <TableHead className="text-right font-medium">{t('detail.receivedAmountCol')}</TableHead>
                              <TableHead className="text-right font-medium">{t('detail.unpaidAmount')}</TableHead>
                              <TableHead className="font-medium">{t('detail.receivableStatusCol')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.receivablesSummary.records.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-500">
                                  {t('detail.noReceivables')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              detail.receivablesSummary.records.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                  <TableCell className="font-medium text-slate-900 dark:text-white">{item.orderNo ?? '—'}</TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">{item.receivableDate}</TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">{item.dueDate ?? '—'}</TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">{item.currency}</TableCell>
                                  <TableCell className="text-right font-medium text-slate-900 dark:text-white">
                                    {formatAmount(item.receivableAmount, item.currency)}
                                  </TableCell>
                                  <TableCell className="text-right text-[13px] text-slate-500 dark:text-slate-400">
                                    {formatAmount(item.receivedAmount, item.currency)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-slate-900 dark:text-white">
                                    {formatAmount(item.unpaidAmount, item.currency)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={item.status === 'unpaid' ? 'destructive' : item.status === 'partial' ? 'secondary' : 'outline'}
                                      className="font-normal"
                                    >
                                      {t(`receivableStatus.${item.status}`)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
