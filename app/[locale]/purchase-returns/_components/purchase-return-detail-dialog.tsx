'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Currency } from '@/lib/currency'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { PurchaseReturnDetail } from '@/lib/tauri'
import { getPurchaseReturnDetail } from '@/lib/tauri'

const formatQuantity = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })

interface PurchaseReturnDetailDialogProps {
  returnId: number | null
  onClose: () => void
}

/** 采购退货单详情只读弹窗 */
export function PurchaseReturnDetailDialog({ returnId, onClose }: PurchaseReturnDetailDialogProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')
  const [detail, setDetail] = useState<PurchaseReturnDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (returnId == null) {
      setDetail(null)
      return
    }

    let ignore = false
    setLoading(true)
    void getPurchaseReturnDetail(returnId)
      .then(result => {
        if (!ignore) setDetail(result)
      })
      .catch(error => {
        if (!ignore) {
          console.error('加载采购退货详情失败', error)
          toast.error(getErrorMessage(error, tc('loadDetailFailed')))
          setDetail(null)
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [returnId, tc])

  const currency = (detail?.currency ?? 'USD') as Currency

  return (
    <Dialog open={returnId != null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-6xl xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>
            {t('details')} {detail ? `— ${detail.returnNo}` : ''}
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
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('returnNo')}</span>
                  <span className="font-mono font-medium">{detail.returnNo}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('sourcePurchaseOrder')}</span>
                  <span className="font-mono">{detail.purchaseOrderNo ?? '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('sourceInbound')}</span>
                  <span className="font-mono">{detail.inboundOrderNo}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{tc('status')}</span>
                  <Badge variant={detail.status === 'confirmed' ? 'default' : 'secondary'} className="w-fit">
                    {detail.status === 'confirmed' ? t('statusConfirmed') : t('statusDraft')}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('supplier')}</span>
                  <span className="font-medium">{detail.supplierName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('warehouse')}</span>
                  <span>{detail.warehouseName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('returnDate')}</span>
                  <span>{detail.returnDate}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('currency')}</span>
                  <span>{detail.currency}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t('returnAmount')}</span>
                  <span className="font-semibold text-destructive">{formatAmount(detail.totalAmount, currency)}</span>
                </div>
                {detail.returnReason && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t('returnReason')}</span>
                    <span>{detail.returnReason}</span>
                  </div>
                )}
                {detail.createdByName && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t('createdBy')}</span>
                    <span>{detail.createdByName}</span>
                  </div>
                )}
                {detail.confirmedByName && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t('confirmedBy')}</span>
                    <span>{detail.confirmedByName}</span>
                  </div>
                )}
                {detail.confirmedAt && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t('confirmedAt')}</span>
                    <span>{detail.confirmedAt}</span>
                  </div>
                )}
                {detail.remark && (
                  <div className="col-span-2 flex flex-col gap-1 lg:col-span-4">
                    <span className="text-muted-foreground">{t('remark')}</span>
                    <span>{detail.remark}</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-foreground">{t('returnItemsTitle')}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <Table className="min-w-[62.5rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[2.5rem]">#</TableHead>
                        <TableHead>{t('materialCode')}</TableHead>
                        <TableHead>{t('materialName')}</TableHead>
                        <TableHead>{t('spec')}</TableHead>
                        <TableHead>{t('unit')}</TableHead>
                        <TableHead className="text-right">{t('inboundQuantity')}</TableHead>
                        <TableHead className="text-right">{t('thisReturnQty')}</TableHead>
                        <TableHead className="text-right">{t('unitPrice')}</TableHead>
                        <TableHead className="text-right">{t('amount')}</TableHead>
                        <TableHead>{t('lotInfo')}</TableHead>
                        <TableHead>{t('remark')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{item.materialCode}</TableCell>
                          <TableCell>{item.materialName}</TableCell>
                          <TableCell className="text-muted-foreground">{item.spec ?? '-'}</TableCell>
                          <TableCell>{item.unitNameSnapshot}</TableCell>
                          <TableCell className="text-right font-mono">{formatQuantity(item.inboundQuantity)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatQuantity(item.quantity)}</TableCell>
                          <TableCell className="text-right">{formatAmount(item.unitPrice, currency)}</TableCell>
                          <TableCell className="text-right font-medium">{formatAmount(item.amount, currency)}</TableCell>
                          <TableCell className="font-mono text-xs">{item.lotNo ?? '-'}</TableCell>
                          <TableCell>{item.remark ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                      {detail.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
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

          {!loading && !detail && returnId != null && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">{tc('noData')}</div>
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
