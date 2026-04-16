'use client'

import { Building2, CreditCard, History, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { SupplierDetailResponse } from '@/lib/tauri'
import { getSupplierDetail } from '@/lib/tauri'

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
      <Icon className="text-primary size-4" />
      {title}
    </h3>
  )
}

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('details')}</DialogTitle>
          <DialogDescription>{t('detailDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading || !detail ? (
            <div className="flex flex-col gap-4 py-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-6 py-2">
              <div className="flex flex-col gap-4">
                <SectionTitle icon={Building2} title={t('basicInfo')} />
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <div className="text-muted-foreground text-xs">{t('code')}</div>
                    <div className="font-medium">{detail.supplier.code}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t('name')}</div>
                    <div className="font-medium">{detail.supplier.name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t('contactPerson')}</div>
                    <div>{detail.supplier.contactPerson ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t('contactPhone')}</div>
                    <div>{detail.supplier.contactPhone ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t('currency')}</div>
                    <div>{detail.supplier.currency}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t('settlementType')}</div>
                    <div>{t(detail.supplier.settlementType)}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <SectionTitle icon={Package} title={t('supplyMaterials')} />
                <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('materialName')}</TableHead>
                        <TableHead>{t('quotePrice')}</TableHead>
                        <TableHead>{t('leadDays')}</TableHead>
                        <TableHead>{t('preferredSupplier')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.supplyMaterials.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                            {t('noMaterials')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        detail.supplyMaterials.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.materialName}</div>
                              <div className="text-muted-foreground text-xs">
                                {item.materialCode}
                                {item.materialSpec ? ` · ${item.materialSpec}` : ''}
                              </div>
                            </TableCell>
                            <TableCell>{item.supplyPrice === null ? '—' : formatAmount(item.supplyPrice, item.currency)}</TableCell>
                            <TableCell>{item.leadDays}</TableCell>
                            <TableCell>{item.isPreferred ? t('yes') : t('no')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <SectionTitle icon={History} title={t('recentPurchases')} />
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('purchaseOrderNo')}</TableHead>
                          <TableHead>{t('purchaseDate')}</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead className="text-right">{t('amount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.recentPurchases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                              {t('noPurchaseHistory')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          detail.recentPurchases.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>{item.orderNo}</TableCell>
                              <TableCell>{item.orderDate}</TableCell>
                              <TableCell>{t(`purchaseStatus.${item.status}`)}</TableCell>
                              <TableCell className="text-right">{formatAmount(item.totalAmount, item.currency)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <SectionTitle icon={CreditCard} title={t('payables')} />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-muted-foreground text-xs">{t('payableTotal')}</div>
                      <div className="mt-1 font-semibold">
                        {formatAmount(detail.payablesSummary.totalUnpaidAmount, detail.supplier.currency as 'VND' | 'CNY' | 'USD')}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-muted-foreground text-xs">{t('openPayables')}</div>
                      <div className="mt-1 font-semibold">{detail.payablesSummary.openCount}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-muted-foreground text-xs">{t('overduePayables')}</div>
                      <div className="mt-1 font-semibold">{detail.payablesSummary.overdueCount}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('purchaseOrderNo')}</TableHead>
                          <TableHead>{t('dueDate')}</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead className="text-right">{t('unpaidAmount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.payablesSummary.records.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                              {t('noPayables')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          detail.payablesSummary.records.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>{item.orderNo ?? '—'}</TableCell>
                              <TableCell>{item.dueDate ?? '—'}</TableCell>
                              <TableCell>{t(`payableStatus.${item.status}`)}</TableCell>
                              <TableCell className="text-right">{formatAmount(item.unpaidAmount, item.currency)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
