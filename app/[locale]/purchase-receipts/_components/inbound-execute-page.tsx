'use client'

import { ArrowLeft, PackageCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type {
  PendingInboundItem,
  PurchaseOrderDetail,
  SaveInboundOrderParams,
} from '@/lib/tauri'
import {
  getPendingInboundItems,
  getPurchaseOrderDetail,
  saveAndConfirmInbound,
} from '@/lib/tauri'

// ================================================================
// 类型
// ================================================================

/** 入库明细行编辑状态 */
interface InboundItemRow {
  key: string
  purchaseOrderItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string
  unitId: number
  unitName: string
  conversionRate: number
  orderQuantity: number
  receivedQty: number
  remainingQty: number
  unitPrice: number
  /** 本次入库数量（用户输入） */
  thisQty: string
  /** 批次追踪模式 */
  lotTrackingMode: string
  /** 批次号（用户输入或自动生成） */
  lotNo: string
  /** 供应商批次号 */
  supplierBatchNo: string
  /** 追溯属性 JSON */
  traceAttrs: string
  remark: string
}

interface InboundExecutePageProps {
  purchaseId: number | null
  onBack: () => void
}

// ================================================================
// 组件
// ================================================================

export function InboundExecutePage({ purchaseId, onBack }: InboundExecutePageProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')

  // 采购单信息
  const [poDetail, setPoDetail] = useState<PurchaseOrderDetail | null>(null)
  // 入库明细行
  const [items, setItems] = useState<InboundItemRow[]>([])
  // 入库日期
  const [inboundDate, setInboundDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [inboundRemark, setInboundRemark] = useState('')

  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // ================================================================
  // 数据加载
  // ================================================================

  const loadData = useCallback(async () => {
    if (!purchaseId) return
    setLoading(true)
    try {
      const [detail, pendingItems] = await Promise.all([
        getPurchaseOrderDetail(purchaseId),
        getPendingInboundItems(purchaseId),
      ])
      setPoDetail(detail)

      if (pendingItems.length === 0) {
        toast.info(t('noRemainingItems'))
      }

      // 转换为编辑行，默认入库数量 = 剩余可入库数量
      setItems(
        pendingItems.map((item, idx) => ({
          key: `inbound-${idx}`,
          purchaseOrderItemId: item.purchaseOrderItemId,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          spec: item.spec ?? '',
          unitId: item.unitId,
          unitName: item.unitNameSnapshot,
          conversionRate: item.conversionRateSnapshot,
          orderQuantity: item.orderQuantity,
          receivedQty: item.receivedQty,
          remainingQty: item.remainingQty,
          unitPrice: item.unitPrice,
          thisQty: String(item.remainingQty),
          lotTrackingMode: item.lotTrackingMode,
          lotNo: '',
          supplierBatchNo: '',
          traceAttrs: '',
          remark: '',
        })),
      )
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [purchaseId, t])

  useEffect(() => { void loadData() }, [loadData])

  // ================================================================
  // 计算
  // ================================================================

  /** 本次入库货款小计 */
  const inboundTotal = useMemo(() =>
    items.reduce((sum, item) => {
      const qty = parseFloat(item.thisQty) || 0
      return sum + Math.round(qty * item.unitPrice)
    }, 0),
    [items],
  )

  // ================================================================
  // 明细行操作
  // ================================================================

  const updateItem = (key: string, field: keyof InboundItemRow, value: string) => {
    setItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item))
  }

  // ================================================================
  // 确认入库
  // ================================================================

  const handleConfirm = async () => {
    if (!poDetail) return

    // 校验
    const validItems = items.filter(item => {
      const qty = parseFloat(item.thisQty) || 0
      return qty > 0
    })

    if (validItems.length === 0) {
      toast.error(t('pleaseInputInboundQty'))
      return
    }

    // 校验入库数量不超过剩余可入库的 110%
    for (const item of validItems) {
      const qty = parseFloat(item.thisQty) || 0
      const maxQty = item.remainingQty * 1.1
      if (qty > maxQty) {
        toast.error(t('inboundExceedLimit', { name: item.materialName, max: maxQty.toFixed(2) }))
        return
      }
    }

    // 校验批次追踪物料
    for (const item of validItems) {
      if (item.lotTrackingMode === 'required' && !item.lotNo.trim()) {
        // 批次号为空时将自动生成，不需要用户必填
        // 但如果用户想手动指定，可以填写
      }
    }

    if (!window.confirm(t('confirmInboundTip'))) return

    setConfirming(true)
    try {
      const params: SaveInboundOrderParams = {
        purchaseId: poDetail.id,
        supplierId: poDetail.supplierId,
        inboundDate,
        warehouseId: poDetail.warehouseId,
        inboundType: 'purchase',
        remark: inboundRemark || null,
        items: validItems.map(item => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          materialId: item.materialId,
          unitId: item.unitId,
          unitNameSnapshot: item.unitName,
          conversionRateSnapshot: item.conversionRate,
          quantity: parseFloat(item.thisQty) || 0,
          unitPrice: item.unitPrice,
          lotNo: item.lotNo.trim() || null,
          supplierBatchNo: item.supplierBatchNo.trim() || null,
          traceAttrsJson: item.traceAttrs.trim() || null,
          remark: item.remark.trim() || null,
        })),
      }

      await saveAndConfirmInbound(params)
      toast.success(t('confirmInboundSuccess'))
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('confirmInboundError'))
    } finally {
      setConfirming(false)
    }
  }

  // ================================================================
  // 渲染
  // ================================================================

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
          <h2 className="text-foreground text-xl font-bold">{t('newInbound')}</h2>
          {poDetail && (
            <Badge variant="outline" className="font-mono">
              {t('sourcePurchaseOrder')}: {poDetail.orderNo}
            </Badge>
          )}
        </div>
        <Button onClick={handleConfirm} disabled={confirming || items.length === 0}>
          <PackageCheck data-icon="inline-start" />
          {confirming ? tc('loading') : t('confirmInbound')}
        </Button>
      </div>

      {/* 采购单信息 */}
      {poDetail && (
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-4">
            <div>
              <Label className="text-muted-foreground text-xs">{t('supplier')}</Label>
              <div className="font-medium">{poDetail.supplierName}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t('warehouse')}</Label>
              <div className="font-medium">{poDetail.warehouseName} <span className="text-muted-foreground text-xs">({t('warehouseLocked')})</span></div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t('currency')}</Label>
              <div className="font-medium">{poDetail.currency} (1 USD = {poDetail.exchangeRate})</div>
            </div>
            <div>
              <Label className="text-xs">{t('inboundDate')}</Label>
              <Input type="date" value={inboundDate} onChange={e => setInboundDate(e.target.value)} className="mt-1 h-8" />
            </div>
          </div>
        </div>
      )}

      {/* 入库明细表格 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('inboundItemsTitle')}</h3>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[90px]">{t('materialCode')}</TableHead>
                <TableHead className="w-[140px]">{t('materialName')}</TableHead>
                <TableHead className="w-[80px]">{t('spec')}</TableHead>
                <TableHead className="w-[60px]">{t('unit')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('orderQuantity')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('receivedQty')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('remainingQty')}</TableHead>
                <TableHead className="w-[100px]">{t('thisQuantity')}</TableHead>
                <TableHead className="w-[130px]">{t('lotNo')}</TableHead>
                <TableHead className="w-[100px] text-right">{t('amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-12 text-center">
                    {t('noRemainingItems')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => {
                  const thisQty = parseFloat(item.thisQty) || 0
                  const amount = Math.round(thisQty * item.unitPrice)
                  const isLotTracked = item.lotTrackingMode !== 'none'

                  return (
                    <TableRow key={item.key} className="group">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.materialCode}</TableCell>
                      <TableCell>
                        <div className="truncate font-medium">{item.materialName}</div>
                        {isLotTracked && (
                          <div className="text-xs text-amber-600">
                            {item.lotTrackingMode === 'required' ? '🔒 ' + t('lotRequired') : '📦 ' + t('lotOptional')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate text-sm">{item.spec || '—'}</TableCell>
                      <TableCell className="text-sm">{item.unitName}</TableCell>
                      <TableCell className="text-right font-mono">{item.orderQuantity}</TableCell>
                      <TableCell className="text-right font-mono">{item.receivedQty}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{item.remainingQty}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.thisQty}
                          onChange={e => updateItem(item.key, 'thisQty', e.target.value)}
                          className="h-8 w-full text-right font-mono"
                          min={0}
                          max={item.remainingQty * 1.1}
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        {isLotTracked ? (
                          <Input
                            value={item.lotNo}
                            onChange={e => updateItem(item.key, 'lotNo', e.target.value)}
                            className="h-8 w-full text-xs"
                            placeholder={t('lotAutoGenerate')}
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {poDetail && formatAmount(amount, poDetail.currency as 'VND' | 'CNY' | 'USD')}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 汇总和备注 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-3">
          <div>
            <Label className="text-muted-foreground text-xs">{t('inboundSubtotal')}</Label>
            <div className="text-primary font-mono text-xl font-bold">
              {poDetail && formatAmount(inboundTotal, poDetail.currency as 'VND' | 'CNY' | 'USD')}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('feeAutoAllocate')}
            </p>
          </div>
          <div className="col-span-2 lg:col-span-2">
            <Label className="text-xs">{t('remark')}</Label>
            <Input
              value={inboundRemark}
              onChange={e => setInboundRemark(e.target.value)}
              className="mt-1"
              placeholder={t('inboundRemarkPlaceholder')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
