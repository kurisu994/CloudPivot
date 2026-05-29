'use client'

import { ArrowLeft, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { OutboundOrderListItem, ReturnableOutboundItem, SaveSalesReturnParams } from '@/lib/tauri'
import { getOutboundOrders, getReturnableOutboundItems, saveAndConfirmSalesReturn } from '@/lib/tauri'

/** 退货明细行编辑状态 */
interface ReturnItemRow {
  key: string
  outboundItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string
  unitId: number
  unitName: string
  conversionRate: number
  outboundQuantity: number
  alreadyReturned: number
  returnableQty: number
  unitPrice: number
  lotId: number | null
  lotNo: string | null
  /** 本次退货数量 */
  thisQty: string
  remark: string
}

interface ReturnExecutePageProps {
  outboundId: number
  onBack: () => void
}

export function ReturnExecutePage({ outboundId, onBack }: ReturnExecutePageProps) {
  const t = useTranslations('sales')
  const tc = useTranslations('common')

  const [outboundInfo, setOutboundInfo] = useState<OutboundOrderListItem | null>(null)
  const [items, setItems] = useState<ReturnItemRow[]>([])
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [returnReason, setReturnReason] = useState('')
  const [returnRemark, setReturnRemark] = useState('')

  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 加载出库单信息
      const allOutbounds = await getOutboundOrders({ page: 1, pageSize: 999 })
      const found = allOutbounds.items.find(ob => ob.id === outboundId)
      if (found) setOutboundInfo(found)

      // 加载可退明细
      const returnableItems = await getReturnableOutboundItems(outboundId)

      if (returnableItems.length === 0) {
        toast.info(t('noReturnableItems'))
      }

      setItems(
        returnableItems.map((item, idx) => ({
          key: `return-${idx}`,
          outboundItemId: item.outboundItemId,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          spec: item.spec ?? '',
          unitId: item.unitId,
          unitName: item.unitNameSnapshot,
          conversionRate: item.conversionRateSnapshot,
          outboundQuantity: item.outboundQuantity,
          alreadyReturned: item.alreadyReturnedQty,
          returnableQty: item.returnableQty,
          unitPrice: item.unitPrice,
          lotId: item.lotId,
          lotNo: item.lotNo,
          thisQty: '',
          remark: '',
        })),
      )
    } catch (error) {
      toast.error(getErrorMessage(error, t('loadReturnError')))
    } finally {
      setLoading(false)
    }
  }, [outboundId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // 退货总金额
  const returnTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = parseFloat(item.thisQty) || 0
        return sum + Math.round(qty * item.unitPrice)
      }, 0),
    [items],
  )

  const updateItem = (key: string, field: 'thisQty' | 'remark', value: string) => {
    setItems(prev => prev.map(item => (item.key === key ? { ...item, [field]: value } : item)))
  }

  // 确认退货
  const handleConfirm = () => {
    const validItems = items.filter(item => (parseFloat(item.thisQty) || 0) > 0)

    if (validItems.length === 0) {
      toast.error(t('pleaseInputReturnQty'))
      return
    }

    // 校验退货数量不超过可退数量
    for (const item of validItems) {
      const qty = parseFloat(item.thisQty) || 0
      if (qty > item.returnableQty) {
        toast.error(t('returnExceedLimit', { name: item.materialName, max: item.returnableQty }))
        return
      }
    }

    // 退货原因为必填字段
    if (!returnReason.trim()) {
      toast.error(t('fieldRequired', { field: t('returnReason') }))
      return
    }

    setShowConfirm(true)
  }

  /** 确认退货（弹窗确认后执行） */
  const doConfirm = async () => {
    const validItems = items.filter(item => (parseFloat(item.thisQty) || 0) > 0)

    setShowConfirm(false)
    setConfirming(true)
    try {
      const params: SaveSalesReturnParams = {
        outboundId,
        returnDate,
        returnReason: returnReason.trim(),
        remark: returnRemark || null,
        items: validItems.map(item => ({
          sourceOutboundItemId: item.outboundItemId,
          lotId: item.lotId,
          materialId: item.materialId,
          unitId: item.unitId,
          unitNameSnapshot: item.unitName,
          conversionRateSnapshot: item.conversionRate,
          quantity: parseFloat(item.thisQty) || 0,
          unitPrice: item.unitPrice,
          remark: item.remark || null,
        })),
      }

      await saveAndConfirmSalesReturn(params)
      toast.success(t('confirmReturnSuccess'))
      onBack()
    } catch (error) {
      toast.error(getErrorMessage(error, t('confirmReturnError')))
      throw error
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground">{tc('loading')}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
            {tc('back')}
          </Button>
          <h2 className="text-foreground text-xl font-bold">{t('newReturn')}</h2>
          {outboundInfo && (
            <Badge variant="outline" className="font-mono">
              {t('sourceOutbound')}: {outboundInfo.orderNo}
            </Badge>
          )}
        </div>
        <Button onClick={handleConfirm} disabled={confirming || items.length === 0} variant="destructive">
          <Undo2 data-icon="inline-start" />
          {confirming ? tc('loading') : t('confirmReturn')}
        </Button>
      </div>

      {/* 出库单信息 */}
      {outboundInfo && (
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-4">
            <div>
              <Label className="text-muted-foreground text-xs">{t('customer')}</Label>
              <div className="font-medium">{outboundInfo.customerName}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t('warehouse')}</Label>
              <div className="font-medium">{outboundInfo.warehouseName}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t('currency')}</Label>
              <div className="font-medium">{outboundInfo.currency}</div>
            </div>
            <div>
              <Label className="text-xs">{t('returnDate')}</Label>
              <DatePicker value={returnDate} onChange={setReturnDate} className="mt-1" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <Label className="text-xs">
                {t('returnReason')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                className="mt-1"
                placeholder={t('returnReasonPlaceholder')}
              />
            </div>
            <div>
              <Label className="text-xs">{t('remark')}</Label>
              <Input value={returnRemark} onChange={e => setReturnRemark(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
      )}

      {/* 退货明细表格 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('returnItemsTitle')}</h3>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[90px]">{t('materialCode')}</TableHead>
                <TableHead className="w-[140px]">{t('materialName')}</TableHead>
                <TableHead className="w-[80px]">{t('spec')}</TableHead>
                <TableHead className="w-[60px]">{t('unit')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('outboundQuantity')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('alreadyReturned')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('returnableQty')}</TableHead>
                <TableHead className="w-[100px]">{t('thisReturnQty')}</TableHead>
                <TableHead className="w-[100px]">{t('lotInfo')}</TableHead>
                <TableHead className="w-[100px] text-right">{t('amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-12 text-center">
                    {t('noReturnableItems')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => {
                  const thisQty = parseFloat(item.thisQty) || 0
                  const amount = Math.round(thisQty * item.unitPrice)

                  return (
                    <TableRow key={item.key} className="group">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.materialCode}</TableCell>
                      <TableCell>
                        <div className="truncate font-medium">{item.materialName}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate text-sm">{item.spec || '—'}</TableCell>
                      <TableCell className="text-sm">{item.unitName}</TableCell>
                      <TableCell className="text-right font-mono">{item.outboundQuantity}</TableCell>
                      <TableCell className="text-right font-mono">{item.alreadyReturned}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{item.returnableQty}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.thisQty}
                          onChange={e => updateItem(item.key, 'thisQty', e.target.value)}
                          className="h-8 w-full text-right font-mono"
                          min={0}
                          max={item.returnableQty}
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.lotNo ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {outboundInfo && formatAmount(amount, outboundInfo.currency as 'VND' | 'CNY' | 'USD')}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 退货金额汇总 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div>
          <Label className="text-muted-foreground text-xs">{t('returnSubtotal')}</Label>
          <div className="text-destructive font-mono text-xl font-bold">
            {outboundInfo && formatAmount(returnTotal, outboundInfo.currency as 'VND' | 'CNY' | 'USD')}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{t('returnCostRecalcHint')}</p>
        </div>
      </div>

      {/* 退货确认对话框 */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={t('confirmReturnTip')}
        confirmText={tc('confirm')}
        cancelText={tc('cancel')}
        destructive
        onConfirm={doConfirm}
      />
    </div>
  )
}
