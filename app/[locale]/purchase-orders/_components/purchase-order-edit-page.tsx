'use client'

import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type {
  PurchaseOrderDetail,
  SavePurchaseOrderParams,
  SupplierListItem,
  SupplierMaterialForPurchase,
  WarehouseItem,
} from '@/lib/tauri'
import {
  getPurchaseOrderDetail,
  getSuppliers,
  getSupplierMaterialsForPurchase,
  getWarehouses,
  savePurchaseOrder,
} from '@/lib/tauri'

// ================================================================
// 类型定义
// ================================================================

/** 明细行编辑状态 */
interface ItemRow {
  key: string
  materialId: number
  materialCode: string
  materialName: string
  spec: string
  unitId: number
  unitName: string
  conversionRate: number
  quantity: string
  unitPrice: string
  amount: number
  remark: string
}

/** 币种选项 */
const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'USD', label: 'USD ($)' },
] as const

interface PurchaseOrderEditPageProps {
  orderId: number | null
  onBack: () => void
}

// ================================================================
// 组件
// ================================================================

export function PurchaseOrderEditPage({ orderId, onBack }: PurchaseOrderEditPageProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')
  const isNew = orderId === null

  // 头信息
  const [supplierId, setSupplierId] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [freightAmount, setFreightAmount] = useState('0')
  const [otherCharges, setOtherCharges] = useState('0')
  const [remark, setRemark] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [status, setStatus] = useState('draft')

  // 明细行
  const [items, setItems] = useState<ItemRow[]>([])

  // 下拉选项
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [supplierMaterials, setSupplierMaterials] = useState<SupplierMaterialForPurchase[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 持久化计数器，避免渲染时重置导致 key 重复
  const keyCounterRef = useRef(0)
  const nextKey = () => `item-${Date.now()}-${keyCounterRef.current++}`

  // ================================================================
  // 计算金额
  // ================================================================

  /** 合计金额（原币） */
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items])

  /** 订单总金额 = 合计 - 折扣 + 运费 + 其他 */
  const payableAmount = useMemo(() => {
    const discount = parseInt(discountAmount) || 0
    const freight = parseInt(freightAmount) || 0
    const other = parseInt(otherCharges) || 0
    return totalAmount - discount + freight + other
  }, [totalAmount, discountAmount, freightAmount, otherCharges])

  // ================================================================
  // 数据加载
  // ================================================================

  /** 加载供应商和仓库选项 */
  const loadOptions = useCallback(async () => {
    try {
      const [supplierResult, warehouseResult] = await Promise.all([
        getSuppliers({ page: 1, pageSize: 999 }),
        getWarehouses(false),
      ])
      setSuppliers(supplierResult.items)
      setWarehouses(warehouseResult)
    } catch (error) {
      console.error('加载选项失败', error)
    }
  }, [])

  /** 加载采购单详情（编辑模式） */
  const loadDetail = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const detail: PurchaseOrderDetail = await getPurchaseOrderDetail(orderId)
      setSupplierId(String(detail.supplierId))
      setOrderDate(detail.orderDate)
      setExpectedDate(detail.expectedDate ?? '')
      setWarehouseId(String(detail.warehouseId))
      setCurrency(detail.currency)
      setExchangeRate(String(detail.exchangeRate))
      setDiscountAmount(String(detail.discountAmount))
      setFreightAmount(String(detail.freightAmount))
      setOtherCharges(String(detail.otherCharges))
      setRemark(detail.remark ?? '')
      setOrderNo(detail.orderNo)
      setStatus(detail.status)

      // 转换明细行
      setItems(
        detail.items.map((item, idx) => ({
          key: `loaded-${idx}`,
          materialId: item.materialId,
          materialCode: item.materialCode ?? '',
          materialName: item.materialName ?? '',
          spec: item.spec ?? '',
          unitId: item.unitId,
          unitName: item.unitNameSnapshot,
          conversionRate: item.conversionRateSnapshot,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: item.amount,
          remark: item.remark ?? '',
        })),
      )
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [orderId, t])

  /** 选择供应商后加载物料报价 */
  const loadSupplierMaterials = useCallback(async (sid: number) => {
    try {
      const materials = await getSupplierMaterialsForPurchase(sid)
      setSupplierMaterials(materials)
    } catch (error) {
      console.error('加载供应商物料失败', error)
    }
  }, [])

  useEffect(() => { void loadOptions() }, [loadOptions])
  useEffect(() => { void loadDetail() }, [loadDetail])

  // 供应商变更时加载物料报价并带出币种
  useEffect(() => {
    if (!supplierId) return
    const sid = Number(supplierId)
    if (sid > 0) {
      void loadSupplierMaterials(sid)
      // 带出供应商默认币种
      const supplier = suppliers.find(s => s.id === sid)
      if (supplier && isNew) {
        setCurrency(supplier.currency)
        // USD 汇率固定为 1
        if (supplier.currency === 'USD') {
          setExchangeRate('1')
        }
      }
    }
  }, [supplierId, suppliers, isNew, loadSupplierMaterials])

  // ================================================================
  // 明细行操作
  // ================================================================

  /** 从供应商物料报价添加一行 */
  const handleAddFromSupplier = (material: SupplierMaterialForPurchase) => {
    // 检查是否已添加
    if (items.some(item => item.materialId === material.materialId)) {
      toast.error(t('materialAlreadyAdded', { name: material.materialName }))
      return
    }
    const newItem: ItemRow = {
      key: nextKey(),
      materialId: material.materialId,
      materialCode: material.materialCode,
      materialName: material.materialName,
      spec: material.spec ?? '',
      unitId: material.unitId,
      unitName: material.unitName ?? '',
      conversionRate: material.conversionRate,
      quantity: '1',
      unitPrice: String(material.unitPrice),
      amount: material.unitPrice, // 1 × unitPrice
      remark: '',
    }
    setItems(prev => [...prev, newItem])
  }

  /** 更新明细行字段 */
  const updateItem = (key: string, field: 'quantity' | 'unitPrice' | 'remark', value: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.key !== key) return item
        const updated = { ...item, [field]: value }
        // 重算金额
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = parseFloat(updated.quantity) || 0
          const price = parseInt(updated.unitPrice) || 0
          updated.amount = Math.round(qty * price)
        }
        return updated
      }),
    )
  }

  /** 删除明细行 */
  const removeItem = (key: string) => {
    setItems(prev => prev.filter(item => item.key !== key))
  }

  // ================================================================
  // 保存
  // ================================================================

  const handleSave = async () => {
    // 基本校验
    if (!supplierId) { toast.error(t('fieldRequired', { field: t('supplier') })); return }
    if (!warehouseId) { toast.error(t('fieldRequired', { field: t('warehouse') })); return }
    if (!orderDate) { toast.error(t('fieldRequired', { field: t('orderDate') })); return }
    if (items.length === 0) { toast.error(t('pleaseAddItems')); return }

    setSaving(true)
    try {
      const params: SavePurchaseOrderParams = {
        id: orderId,
        supplierId: Number(supplierId),
        orderDate,
        expectedDate: expectedDate || null,
        warehouseId: Number(warehouseId),
        currency,
        exchangeRate: parseFloat(exchangeRate) || 1,
        discountAmount: parseInt(discountAmount) || 0,
        freightAmount: parseInt(freightAmount) || 0,
        otherCharges: parseInt(otherCharges) || 0,
        remark: remark || null,
        items: items.map((item, idx) => ({
          materialId: item.materialId,
          spec: item.spec || null,
          unitId: item.unitId,
          unitNameSnapshot: item.unitName,
          conversionRateSnapshot: item.conversionRate,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseInt(item.unitPrice) || 0,
          remark: item.remark || null,
          sortOrder: idx,
        })),
      }

      await savePurchaseOrder(params)
      toast.success(t('saveSuccess'))
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // ================================================================
  // 下拉选项
  // ================================================================

  const supplierItems = useMemo(
    () => suppliers.map(s => ({ value: String(s.id), label: `${s.name} [${s.code}]` })),
    [suppliers],
  )

  const warehouseItems = useMemo(
    () => warehouses.map(w => ({ value: String(w.id), label: w.name })),
    [warehouses],
  )

  const currencyItems = useMemo(
    () => CURRENCY_OPTIONS.map(c => ({ value: c.value, label: c.label })),
    [],
  )

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
          <h2 className="text-foreground text-xl font-bold">
            {isNew ? t('addOrder') : `${t('title')} - ${orderNo}`}
          </h2>
          {!isNew && (
            <Badge variant={status === 'draft' ? 'secondary' : 'default'}>
              {t(`status${status.charAt(0).toUpperCase() + status.slice(1).replace('_', '')}` as any)}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>{tc('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tc('loading') : tc('save')}
          </Button>
        </div>
      </div>

      {/* 头信息 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          {/* 供应商 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('supplier')} *</Label>
            <Select value={supplierId} onValueChange={v => setSupplierId(v ?? '')} items={supplierItems} disabled={!isNew && status !== 'draft'}>
              <SelectTrigger>
                <SelectValue placeholder={t('allSuppliers')} />
              </SelectTrigger>
              <SelectContent>
                {supplierItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 采购日期 */}
          <div className="grid gap-2">
            <Label>{t('orderDate')} *</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>

          {/* 预计到货日 */}
          <div className="grid gap-2">
            <Label>{t('expectedDate')}</Label>
            <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          </div>

          {/* 入库仓库 */}
          <div className="grid gap-2">
            <Label>{t('warehouse')} *</Label>
            <Select value={warehouseId} onValueChange={v => setWarehouseId(v ?? '')} items={warehouseItems}>
              <SelectTrigger>
                <SelectValue placeholder={t('allWarehouses')} />
              </SelectTrigger>
              <SelectContent>
                {warehouseItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 结算币种 */}
          <div className="grid gap-2">
            <Label>{t('currency')}</Label>
            <Select value={currency} onValueChange={v => { if (v) { setCurrency(v); if (v === 'USD') setExchangeRate('1') } }} items={currencyItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 汇率 */}
          <div className="grid gap-2">
            <Label>{t('exchangeRate')}</Label>
            <Input
              type="number"
              value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)}
              disabled={currency === 'USD'}
              min={0}
              step="0.01"
            />
          </div>

          {/* 备注 */}
          <div className="grid gap-2">
            <Label>{t('remark')}</Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 明细表格 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('itemsTitle')}</h3>
          {/* 从供应商物料快速添加 */}
          {supplierMaterials.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">{t('quickAdd')}</span>
              <Select
                value=""
                onValueChange={v => {
                  if (!v) return
                  const mat = supplierMaterials.find(m => String(m.materialId) === v)
                  if (mat) handleAddFromSupplier(mat)
                }}
                items={supplierMaterials.map(m => ({
                  value: String(m.materialId),
                  label: `${m.materialName} [${m.materialCode}]`,
                }))}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder={t('selectSupplierMaterial')} />
                </SelectTrigger>
                <SelectContent>
                  {supplierMaterials.map(m => (
                    <SelectItem key={m.materialId} value={String(m.materialId)}>
                      {m.materialName} [{m.materialCode}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1000px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[100px]">{t('materialCode')}</TableHead>
                <TableHead className="w-[160px]">{t('materialName')}</TableHead>
                <TableHead className="w-[100px]">{t('spec')}</TableHead>
                <TableHead className="w-[70px]">{t('unit')}</TableHead>
                <TableHead className="w-[100px]">{t('thisQuantity')}</TableHead>
                <TableHead className="w-[120px]">{t('unitPrice')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('amount')}</TableHead>
                <TableHead className="w-[120px]">{t('remark')}</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground py-12 text-center">
                    {supplierId ? t('addFromSupplierHint') : t('pleaseSelectSupplierFirst')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={item.key} className="group">
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{item.materialCode}</TableCell>
                    <TableCell>
                      <div className="truncate font-medium">{item.materialName}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate text-sm">{item.spec || '—'}</TableCell>
                    <TableCell className="text-sm">{item.unitName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(item.key, 'quantity', e.target.value)}
                        className="h-8 w-full text-right font-mono"
                        min={0}
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={e => updateItem(item.key, 'unitPrice', e.target.value)}
                        className="h-8 w-full text-right font-mono"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatAmount(item.amount, currency as 'VND' | 'CNY' | 'USD')}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.remark}
                        onChange={e => updateItem(item.key, 'remark', e.target.value)}
                        className="h-8 w-full text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeItem(item.key)}>
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 金额汇总 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-5">
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">{t('totalAmount')}</Label>
            <div className="font-mono text-lg font-semibold">
              {formatAmount(totalAmount, currency as 'VND' | 'CNY' | 'USD')}
            </div>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('discountAmount')}</Label>
            <Input
              type="number"
              value={discountAmount}
              onChange={e => setDiscountAmount(e.target.value)}
              className="h-8 font-mono"
              min={0}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('freightAmount')}</Label>
            <Input
              type="number"
              value={freightAmount}
              onChange={e => setFreightAmount(e.target.value)}
              className="h-8 font-mono"
              min={0}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('otherCharges')}</Label>
            <Input
              type="number"
              value={otherCharges}
              onChange={e => setOtherCharges(e.target.value)}
              className="h-8 font-mono"
              min={0}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">{t('payableAmount')}</Label>
            <div className="text-primary font-mono text-xl font-bold">
              {formatAmount(payableAmount, currency as 'VND' | 'CNY' | 'USD')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
