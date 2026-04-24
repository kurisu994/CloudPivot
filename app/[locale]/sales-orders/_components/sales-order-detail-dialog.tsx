'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Currency } from '@/lib/currency'
import { formatAmount } from '@/lib/currency'
import type { SalesOrderDetail } from '@/lib/tauri'
import { getSalesOrderDetail } from '@/lib/tauri'

/** 销售单状态样式 */
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  partial_out: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'statusDraft',
  approved: 'statusApproved',
  partial_out: 'statusPartialOut',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
}

interface SalesOrderDetailDialogProps {
  orderId: number | null
  onClose: () => void
}

/** 销售单详情只读弹窗 */
export function SalesOrderDetailDialog({ orderId, onClose }: SalesOrderDetailDialogProps) {
  const t = useTranslations('sales')
  const tc = useTranslations('common')
  const [detail, setDetail] = useState<SalesOrderDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (orderId == null) {
      setDetail(null)
      return
    }
    setLoading(true)
    void getSalesOrderDetail(orderId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [orderId])

  /** 货币类型安全转换 */
  const currency = (detail?.currency ?? 'USD') as Currency

  return (
    <Dialog open={orderId != null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t('details')} {detail ? `— ${detail.orderNo}` : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('details')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col gap-3 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          )}

          {!loading && detail && (
            <div className="flex flex-col gap-6">
              {/* 头信息 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('orderNo')}</span>
                  <span className="font-medium">{detail.orderNo}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('customer')}</span>
                  <span className="font-medium">{detail.customerName ?? '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{tc('status')}</span>
                  <Badge className={`w-fit ${STATUS_STYLES[detail.status] ?? ''}`}>{t(STATUS_LABEL_KEYS[detail.status] ?? 'statusDraft')}</Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('orderDate')}</span>
                  <span>{detail.orderDate}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('deliveryDate')}</span>
                  <span>{detail.deliveryDate ?? '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('currency')}</span>
                  <span>{currency}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('totalAmount')}</span>
                  <span className="font-medium">{formatAmount(detail.totalAmount, currency)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('discountRate')}</span>
                  <span>{detail.discountRate > 0 ? `${detail.discountRate}%` : '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('discountAmount')}</span>
                  <span>{formatAmount(detail.discountAmount, currency)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('freightAmount')}</span>
                  <span>{formatAmount(detail.freightAmount, currency)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('otherCharges')}</span>
                  <span>{formatAmount(detail.otherCharges, currency)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('receivableAmount')}</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{formatAmount(detail.receivableAmount, currency)}</span>
                </div>
                {detail.remark && (
                  <div className="col-span-2 flex flex-col gap-1 lg:col-span-3">
                    <span className="text-muted-foreground">{t('remark')}</span>
                    <span>{detail.remark}</span>
                  </div>
                )}
                {detail.approvedByName && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t('approvedBy')}</span>
                    <span>{detail.approvedByName}</span>
                  </div>
                )}
                {detail.approvedAt && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t('approvedAt')}</span>
                    <span>{detail.approvedAt}</span>
                  </div>
                )}
              </div>

              {/* 明细表格 */}
              <div>
                <h3 className="text-foreground mb-3 font-semibold">{t('itemsTitle')}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>{t('materialCode')}</TableHead>
                        <TableHead>{t('materialName')}</TableHead>
                        <TableHead>{t('spec')}</TableHead>
                        <TableHead>{t('unit')}</TableHead>
                        <TableHead className="text-right">{t('orderQuantity')}</TableHead>
                        <TableHead className="text-right">{t('unitPrice')}</TableHead>
                        <TableHead className="text-right">{t('lineDiscount')}</TableHead>
                        <TableHead className="text-right">{t('amount')}</TableHead>
                        <TableHead>{t('remark')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item, idx) => (
                        <TableRow key={item.id ?? idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{item.materialCode ?? '-'}</TableCell>
                          <TableCell>{item.materialName ?? '-'}</TableCell>
                          <TableCell>{item.spec ?? '-'}</TableCell>
                          <TableCell>{item.unitNameSnapshot}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatAmount(item.unitPrice, currency)}</TableCell>
                          <TableCell className="text-right">{item.discountRate > 0 ? `${item.discountRate}%` : '-'}</TableCell>
                          <TableCell className="text-right">{formatAmount(item.amount, currency)}</TableCell>
                          <TableCell>{item.remark ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                      {detail.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-muted-foreground py-6 text-center">
                            {tc('noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {!loading && !detail && orderId != null && (
            <div className="text-muted-foreground flex items-center justify-center py-10">{tc('noData')}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
