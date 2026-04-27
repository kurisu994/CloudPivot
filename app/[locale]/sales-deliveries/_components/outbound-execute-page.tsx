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
import type { PendingOutboundItem, SaveOutboundOrderParams } from '@/lib/tauri'
import { getPendingOutboundItems, invoke, saveAndConfirmOutbound } from '@/lib/tauri'

// ================================================================
// 类型
// ================================================================

/** 销售单详情（从 IPC 获取） */
interface SalesOrderInfo {
  id: number
  orderNo: string
  customerId: number
  customerName: string
  warehouseId: number
  warehouseName: string
  currency: string
  exchangeRate: number
  discountRate: number
  freightAmount: number
  otherCharges: number
}

/** 出库明细行编辑状态 */
interface OutboundItemRow {
  key: string
  salesOrderItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string
  unitId: number
  unitName: string
  conversionRate: number
  orderQuantity: number
  shippedQty: number
  remainingQty: number
  unitPrice: number
  lineDiscount: number
  /** 批次追踪模式 */
  lotTrackingMode: string
  /** 可用库存 */
  availableStock: number
  /** 标准成本 */
  standardCost: number
  /** 实际成本 */
  actualCost: number
  /** 建议分配的批次号（FIFO） */
  suggestedLotNo: string | null
  /** 本次出库数量（用户输入） */
  thisQty: string
  remark: string
}

interface OutboundExecutePageProps {
  salesId: number
  onBack: () => void
}

// ================================================================
// 组件
// ================================================================

export function OutboundExecutePage({ salesId, onBack }: OutboundExecutePageProps) {
  const t = useTranslations('sales')
  const tc = useTranslations('common')

  // 销售单信息
  const [salesInfo, setSalesInfo] = useState<SalesOrderInfo | null>(null)
  // 出库明细行
  const [items, setItems] = useState<OutboundItemRow[]>([])
  // 出库日期
  const [outboundDate, setOutboundDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [outboundRemark, setOutboundRemark] = useState('')

  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // ================================================================
  // 数据加载
  // ================================================================

  const loadData = useCallback(async () => {
    if (!salesId) return
    setLoading(true)
    try {
      // 获取销售单详情
      const detail = await invoke<SalesOrderInfo>('get_sales_order_detail', { id: salesId })
      setSalesInfo(detail)

      // 获取待出库明细
      const pendingItems = await getPendingOutboundItems(salesId)

      if (pendingItems.length === 0) {
        toast.info(t('noRemainingItems'))
      }

      // 转换为编辑行，默认出库数量 = 剩余可出库数量（不超过可用库存）
      setItems(
        pendingItems.map((item, idx) => ({
          key: `outbound-${idx}`,
          salesOrderItemId: item.salesOrderItemId,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          spec: item.spec ?? '',
          unitId: item.unitId,
          unitName: item.unitNameSnapshot,
          conversionRate: item.conversionRateSnapshot,
          orderQuantity: item.orderQuantity,
          shippedQty: item.shippedQty,
          remainingQty: item.remainingQty,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount,
          lotTrackingMode: item.lotTrackingMode,
          availableStock: item.availableStock,
          standardCost: item.standardCost,
          actualCost: item.actualCost,
          suggestedLotNo: item.suggestedLotNo,
          thisQty: String(Math.min(item.remainingQty, item.availableStock)),
          remark: '',
        })),
      )
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('loadOutboundError'))
    } finally {
      setLoading(false)
    }
  }, [salesId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // ================================================================
  // 计算
  // ================================================================

  /** 本次出库货款小计 */
  const outboundTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = parseFloat(item.thisQty) || 0
        const lineAmount = Math.round(qty * item.unitPrice * (1 - item.lineDiscount / 100))
        return sum + lineAmount
      }, 0),
    [items],
  )

  // ================================================================
  // 明细行操作
  // ================================================================

  const updateItem = (key: string, field: 'thisQty' | 'remark', value: string) => {
    setItems(prev => prev.map(item => (item.key === key ? { ...item, [field]: value } : item)))
  }

  // ================================================================
  // 确认出库
  // ================================================================

  const handleConfirm = async () => {
    if (!salesInfo) return

    // 校验
    const validItems = items.filter(item => {
      const qty = parseFloat(item.thisQty) || 0
      return qty > 0
    })

    if (validItems.length === 0) {
      toast.error(t('pleaseInputOutboundQty'))
      return
    }

    // 校验出库数量不超过剩余可出库数量
    for (const item of validItems) {
      const qty = parseFloat(item.thisQty) || 0
      if (qty > item.remainingQty) {
        toast.error(t('outboundExceedLimit', { name: item.materialName, max: item.remainingQty }))
        return
      }
      // 校验库存是否充足
      if (qty > item.availableStock) {
        toast.error(`${item.materialName}: ${t('inventoryInsufficient')}`)
        return
      }
    }

    if (!window.confirm(t('confirmOutboundTip'))) return

    setConfirming(true)
    try {
      const params: SaveOutboundOrderParams = {
        salesId: salesInfo.id,
        customerId: salesInfo.customerId,
        outboundDate,
        warehouseId: salesInfo.warehouseId,
        outboundType: 'sales',
        remark: outboundRemark || null,
        items: validItems.map(item => ({
          salesOrderItemId: item.salesOrderItemId,
          materialId: item.materialId,
          unitId: item.unitId,
          unitNameSnapshot: item.unitName,
          conversionRateSnapshot: item.conversionRate,
          quantity: parseFloat(item.thisQty) || 0,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount,
          remark: item.remark.trim() || null,
        })),
      }

      await saveAndConfirmOutbound(params)
      toast.success(t('confirmOutboundSuccess'))
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('confirmOutboundError'))
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
          <h2 className="text-foreground text-xl font-bold">{t('newOutbound')}</h2>
          {salesInfo && (
            <Badge variant="outline" className="font-mono">
              {t('sourceSalesOrder')}: {salesInfo.orderNo}
            </Badge>
          )}
        </div>
        <Button onClick={handleConfirm} disabled={confirming || items.length === 0}>
          <PackageCheck data-icon="inline-start" />
          {confirming ? tc('loading') : t('confirmOutbound')}
        </Button>
      </div>

      {/* 销售单信息 */}
      {salesInfo && (
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-4">
            <div>
              <Label className="text-muted-foreground text-xs">{t('customer')}</Label>
              <div className="font-medium">{salesInfo.customerName}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t('warehouse')}</Label>
              <div className="font-medium">
                {salesInfo.warehouseName} <span className="text-muted-foreground text-xs">({t('warehouseLocked')})</span>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t('currency')}</Label>
              <div className="font-medium">
                {salesInfo.currency} (1 USD = {salesInfo.exchangeRate})
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('outboundDate')}</Label>
              <Input type="date" value={outboundDate} onChange={e => setOutboundDate(e.target.value)} className="mt-1 h-8" />
            </div>
          </div>
        </div>
      )}

      {/* 出库明细表格 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('outboundItemsTitle')}</h3>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[90px]">{t('materialCode')}</TableHead>
                <TableHead className="w-[130px]">{t('materialName')}</TableHead>
                <TableHead className="w-[70px]">{t('spec')}</TableHead>
                <TableHead className="w-[50px]">{t('unit')}</TableHead>
                <TableHead className="w-[70px] text-right">{t('orderQuantity')}</TableHead>
                <TableHead className="w-[70px] text-right">{t('shippedQty')}</TableHead>
                <TableHead className="w-[70px] text-right">{t('remainingQty')}</TableHead>
                <TableHead className="w-[70px] text-right">{t('availableStock')}</TableHead>
                <TableHead className="w-[90px]">{t('thisQuantity')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('unitPrice')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('standardCost')}</TableHead>
                <TableHead className="w-[90px] text-right">{t('amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-muted-foreground py-12 text-center">
                    {t('noRemainingItems')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => {
                  const thisQty = parseFloat(item.thisQty) || 0
                  const amount = Math.round(thisQty * item.unitPrice * (1 - item.lineDiscount / 100))
                  const isLotTracked = item.lotTrackingMode !== 'none'
                  const isStockInsufficient = thisQty > item.availableStock

                  return (
                    <TableRow key={item.key} className="group">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.materialCode}</TableCell>
                      <TableCell>
                        <div className="truncate font-medium">{item.materialName}</div>
                        {isLotTracked && (
                          <div className="text-xs text-amber-600">
                            {item.lotTrackingMode === 'required' ? '🔒 ' + t('lotRequired') : '📦 ' + t('lotOptional')}
                            {item.suggestedLotNo && <span className="ml-1 text-emerald-600">(FIFO: {item.suggestedLotNo})</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate text-sm">{item.spec || '—'}</TableCell>
                      <TableCell className="text-sm">{item.unitName}</TableCell>
                      <TableCell className="text-right font-mono">{item.orderQuantity}</TableCell>
                      <TableCell className="text-right font-mono">{item.shippedQty}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{item.remainingQty}</TableCell>
                      <TableCell className={`text-right font-mono ${isStockInsufficient ? 'text-destructive font-bold' : ''}`}>
                        {item.availableStock}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.thisQty}
                          onChange={e => updateItem(item.key, 'thisQty', e.target.value)}
                          className="h-8 w-full text-right font-mono"
                          min={0}
                          max={Math.min(item.remainingQty, item.availableStock)}
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {salesInfo && formatAmount(item.unitPrice, salesInfo.currency as 'VND' | 'CNY' | 'USD')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right font-mono text-xs">
                        {salesInfo && formatAmount(item.standardCost, salesInfo.currency as 'VND' | 'CNY' | 'USD')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {salesInfo && formatAmount(amount, salesInfo.currency as 'VND' | 'CNY' | 'USD')}
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
            <Label className="text-muted-foreground text-xs">{t('outboundSubtotal')}</Label>
            <div className="text-primary font-mono text-xl font-bold">
              {salesInfo && formatAmount(outboundTotal, salesInfo.currency as 'VND' | 'CNY' | 'USD')}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{t('feeAutoAllocate')}</p>
          </div>
          <div className="col-span-2 lg:col-span-2">
            <Label className="text-xs">{t('remark')}</Label>
            <Input
              value={outboundRemark}
              onChange={e => setOutboundRemark(e.target.value)}
              className="mt-1"
              placeholder={t('outboundRemarkPlaceholder')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
