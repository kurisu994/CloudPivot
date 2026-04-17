'use client'

import {
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  Phone,
  TreePine,
  TrendingUp,
  User2,
  Wallet,
} from 'lucide-react'
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
import type { SupplierDetailResponse } from '@/lib/tauri'
import { getSupplierDetail } from '@/lib/tauri'

interface SupplierDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: number | null
}

export function SupplierDetailDialog({ open, onOpenChange, supplierId }: SupplierDetailDialogProps) {
  const t = useTranslations('suppliers')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<SupplierDetailResponse | null>(null)

  useEffect(() => {
    if (!open || supplierId === null) {
      setDetail(null)
      return
    }

    setLoading(true)
    void getSupplierDetail(supplierId)
      .then(setDetail)
      .catch(error => {
        console.error('加载供应商详情失败', error)
        setDetail(null)
        toast.error(t('loadError'))
      })
      .finally(() => setLoading(false))
  }, [open, supplierId, t])

  // 计算一些统计数据
  const totalPurchased = detail?.recentPurchases.reduce((acc, curr) => acc + curr.totalAmount, 0) || 0
  const totalPaid = detail?.payablesSummary.records.reduce((acc, curr) => acc + curr.paidAmount, 0) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden bg-slate-50 p-0 sm:max-w-5xl dark:bg-slate-900 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('details')}</DialogTitle>
          <DialogDescription>{t('detailDescription')}</DialogDescription>
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
              {/* Header 部位 */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {detail.supplier.name}
                    </h2>
                    <Badge
                      variant="outline"
                      className={
                        detail.supplier.isEnabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium px-2 py-0.5'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 font-medium px-2 py-0.5'
                      }
                    >
                      <span
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${detail.supplier.isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}
                      />
                      {detail.supplier.isEnabled ? t('cooperationNormal') : t('cooperationStopped')}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[13px] font-bold tracking-widest text-primary uppercase">
                    {detail.supplier.code}
                  </div>
                </div>
              </div>

              {/* 三大指标 KPI 卡片 */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <Card className="relative overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('totalPurchased')}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatAmount(totalPurchased, detail.supplier.currency as 'VND' | 'CNY' | 'USD')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="mr-1 h-3.5 w-3.5" />
                      +12.5% <span className="ml-1 text-slate-400 dark:text-slate-500 font-medium">{t('yoyInc')}</span>
                    </div>
                    <CircleDollarSign className="absolute -bottom-4 -right-4 h-24 w-24 text-slate-50 opacity-60 dark:text-slate-800/50" />
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('payableBalance')}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatAmount(detail.payablesSummary.totalUnpaidAmount, detail.supplier.currency as 'VND' | 'CNY' | 'USD')}
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full w-[35%] rounded-full bg-rose-500 dark:bg-rose-600" />
                    </div>
                    <Wallet className="absolute -bottom-4 -right-4 h-24 w-24 text-slate-50 opacity-60 dark:text-slate-800/50" />
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('totalPaid')}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatAmount(totalPaid, detail.supplier.currency as 'VND' | 'CNY' | 'USD')}
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
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('contactPerson')}</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-900 dark:text-white">
                      {detail.supplier.contactPerson || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('contactPhone')}</div>
                    <div className="mt-0.5 truncate font-mono font-medium tracking-tight text-slate-900 dark:text-white">
                      {detail.supplier.contactPhone || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <MapPin className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('address')}</div>
                    <div className="mt-0.5 truncate font-medium text-slate-900 dark:text-white">
                      {[
                        detail.supplier.country === 'VN'
                          ? t('countryVN')
                          : detail.supplier.country === 'CN'
                            ? t('countryCN')
                            : detail.supplier.country,
                        detail.supplier.province,
                        detail.supplier.city,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              </div>

              {/* 内容切换 Tabs */}
              <div className="flex-1 min-h-0 flex flex-col">
                <Tabs defaultValue="materials" className="flex flex-col h-full">
                  <div className="border-b border-slate-200 px-2 pb-0 dark:border-slate-800">
                    <TabsList className="flex h-auto w-auto justify-start gap-8 bg-transparent p-0">
                      <TabsTrigger
                        value="materials"
                        className="rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:text-slate-400 dark:hover:text-white data-[state=active]:dark:text-primary"
                      >
                        {t('materialsList')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="purchases"
                        className="rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:text-slate-400 dark:hover:text-white data-[state=active]:dark:text-primary"
                      >
                        {t('purchaseRecords')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="finances"
                        className="rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:text-slate-400 dark:hover:text-white data-[state=active]:dark:text-primary"
                      >
                        {t('financeReconciliation')}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto py-6 px-1">
                    <TabsContent value="materials" className="m-0 focus-visible:outline-none">
                      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <Table>
                          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                            <TableRow>
                              <TableHead className="w-[40%] font-medium">{t('materialName')}</TableHead>
                              <TableHead className="font-medium">{t('grade')}</TableHead>
                              <TableHead className="font-medium">{t('specifications')}</TableHead>
                              <TableHead className="text-right font-medium">
                                {t('latestQuote')} ({detail.supplier.currency})
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.supplyMaterials.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">
                                  {t('noMaterials')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              detail.supplyMaterials.map((item, idx) => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                  <TableCell>
                                    <div className="flex items-center gap-3 py-1">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-500">
                                        <TreePine className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <div className="font-semibold text-slate-900 dark:text-white">
                                          {item.materialName}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="border-blue-200 bg-blue-50 px-2 py-0.5 font-normal text-blue-600 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400"
                                    >
                                      {idx % 2 === 0 ? 'FSC 认证' : 'PEFC 认证'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-[13px] text-slate-500 dark:text-slate-400">
                                    {item.materialSpec || '—'}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-slate-900 dark:text-white">
                                    {item.supplyPrice === null
                                      ? '—'
                                      : formatAmount(item.supplyPrice, item.currency)
                                          .replace(item.currency, '')
                                          .trim()}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="purchases" className="m-0 focus-visible:outline-none">
                      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <Table>
                          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                            <TableRow>
                              <TableHead className="font-medium">{t('purchaseOrderNo')}</TableHead>
                              <TableHead className="font-medium">{t('purchaseDate')}</TableHead>
                              <TableHead className="font-medium">{t('status')}</TableHead>
                              <TableHead className="text-right font-medium">{t('amount')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.recentPurchases.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">
                                  {t('noPurchaseHistory')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              detail.recentPurchases.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                  <TableCell className="font-semibold text-slate-900 dark:text-white">
                                    {item.orderNo}
                                  </TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">
                                    {item.orderDate}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="font-normal">
                                      {t(`purchaseStatus.${item.status}`)}
                                    </Badge>
                                  </TableCell>
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

                    <TabsContent value="finances" className="m-0 focus-visible:outline-none">
                      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <Table>
                          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                            <TableRow>
                              <TableHead className="font-medium">{t('purchaseOrderNo')}</TableHead>
                              <TableHead className="font-medium">{t('dueDate')}</TableHead>
                              <TableHead className="font-medium">{t('status')}</TableHead>
                              <TableHead className="text-right font-medium">{t('unpaidAmount')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.payablesSummary.records.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">
                                  {t('noPayables')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              detail.payablesSummary.records.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                  <TableCell className="font-medium text-slate-900 dark:text-white">
                                    {item.orderNo ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-[13px] text-slate-500 dark:text-slate-400">
                                    {item.dueDate ?? '—'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={item.status === 'unpaid' ? 'destructive' : 'secondary'}
                                      className="font-normal"
                                    >
                                      {t(`payableStatus.${item.status}`)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-slate-900 dark:text-white">
                                    {formatAmount(item.unpaidAmount, item.currency)}
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
