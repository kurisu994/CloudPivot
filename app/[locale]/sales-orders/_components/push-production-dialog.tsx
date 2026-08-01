'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/error'
import type { PushProductionResult, SalesOrderDetail } from '@/lib/tauri'
import { pushSalesOrderToProduction } from '@/lib/tauri'

interface PushProductionDialogProps {
  /** 销售单详情（已审核），为 null 时关闭弹窗 */
  detail: SalesOrderDetail | null
  onClose: () => void
}

/** 销售单下推生产弹窗：勾选明细行后生成生产工单 */
export function PushProductionDialog({ detail, onClose }: PushProductionDialogProps) {
  const t = useTranslations('sales.pushProduction')
  const tc = useTranslations('common')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PushProductionResult | null>(null)

  // 打开时默认全选、清空上次结果；关闭后重置
  useEffect(() => {
    if (detail) {
      setSelectedIds(new Set(detail.items.map(item => item.id).filter((id): id is number => id != null)))
      setResult(null)
    } else {
      setSelectedIds(new Set())
      setResult(null)
    }
  }, [detail])

  /** 勾选切换 */
  const toggleItem = (id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  /** 全选/取消全选 */
  const toggleAll = (checked: boolean) => {
    if (!detail) return
    if (checked) {
      setSelectedIds(new Set(detail.items.map(item => item.id).filter((id): id is number => id != null)))
    } else {
      setSelectedIds(new Set())
    }
  }

  /** 确认下推 */
  const handlePush = async () => {
    if (!detail || selectedIds.size === 0) return
    setSubmitting(true)
    try {
      const res = await pushSalesOrderToProduction(detail.id, Array.from(selectedIds))
      setResult(res)
      if (res.created.length > 0) {
        toast.success(t('pushSuccess', { count: res.created.length }))
      }
      if (res.created.length === 0 && res.skipped.length > 0) {
        toast.info(t('allSkipped'))
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t('pushError')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedIds(new Set())
    setResult(null)
    onClose()
  }

  /** 跳过原因码 → 本地化文案 */
  const skipReasonText = (reason: string) => {
    if (reason === 'fully_pushed') return t('skipFullyPushed')
    if (reason === 'no_active_bom') return t('skipNoActiveBom')
    return reason
  }

  const allChecked = detail != null && detail.items.length > 0 && selectedIds.size === detail.items.length

  return (
    <Dialog open={detail != null} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {detail && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[3rem]">
                        <Checkbox checked={allChecked} onCheckedChange={checked => toggleAll(checked === true)} />
                      </TableHead>
                      <TableHead>{t('materialName')}</TableHead>
                      <TableHead>{t('spec')}</TableHead>
                      <TableHead className="text-right">{t('orderQuantity')}</TableHead>
                      <TableHead>{t('unit')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item, idx) => {
                      const id = item.id ?? idx
                      return (
                        <TableRow key={id}>
                          <TableCell>
                            {item.id != null && (
                              <Checkbox
                                checked={selectedIds.has(item.id)}
                                onCheckedChange={checked => item.id != null && toggleItem(item.id, checked === true)}
                              />
                            )}
                          </TableCell>
                          <TableCell>{item.materialName ?? '-'}</TableCell>
                          <TableCell>{item.spec ?? '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unitNameSnapshot}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 下推结果 */}
              {result && (
                <div className="flex flex-col gap-3 text-sm">
                  {result.created.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                      <p className="mb-2 font-medium text-emerald-700 dark:text-emerald-400">{t('createdTitle', { count: result.created.length })}</p>
                      <ul className="flex flex-col gap-1">
                        {result.created.map(order => (
                          <li key={order.productionOrderId}>
                            <span className="font-medium">{order.orderNo}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              — {order.materialName} × {order.plannedQty}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.skipped.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                      <p className="mb-2 font-medium text-amber-700 dark:text-amber-400">{t('skippedTitle', { count: result.skipped.length })}</p>
                      <ul className="flex flex-col gap-1">
                        {result.skipped.map(item => (
                          <li key={item.salesOrderItemId}>
                            <span className="font-medium">{item.materialName}</span>
                            <span className="text-muted-foreground"> — {skipReasonText(item.reason)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {tc('close')}
          </Button>
          <Button disabled={submitting || selectedIds.size === 0} onClick={handlePush}>
            {submitting ? tc('loading') : t('confirmPush')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
