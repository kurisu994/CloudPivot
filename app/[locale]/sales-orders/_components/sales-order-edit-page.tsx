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
import type { CustomerListItem, MaterialReferenceOption, WarehouseItem } from '@/lib/tauri'
import { getCustomers, getMaterialReferenceOptions, getWarehouses, invoke } from '@/lib/tauri'

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
  lineDiscount: string
  amount: number
  remark: string
}

/** 销售单详情（从后端获取） */
interface SalesOrderDetail {
  id: number
  orderNo: string
  customerId: number
  customerName: string | null
  orderDate: string
  deliveryDate: string | null
  warehouseId: number
  warehouseName: string | null
  currency: string
  exchangeRate: number
  status: string
  totalAmount: number
  discountRate: number
  discountAmount: number
  freightAmount: number
  otherCharges: number
  receivableAmount: number
  shippingAddress: string | null
  remark: string | null
  createdByUserId: number | null
  createdByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  items: SalesOrderItemData[]
}

/** 销售单明细项 */
interface SalesOrderItemData {
  id?: number | null
  materialId: number
  materialCode?: string | null
  materialName?: string | null
  spec?: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  unitPrice: number
  lineDiscount: number
  amount: number
  shippedQty?: number | null
  remark?: string | null
  sortOrder?: number | null
}

/** 币种选项 */
const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'USD', label: 'USD ($)' },
] as const

interface SalesOrderEditPageProps {
  orderId: number | null
  onBack: () => void
}

// ================================================================
// 组件
// ================================================================

export function SalesOrderEditPage({ orderId, onBack }: SalesOrderEditPageProps) {
  const t = useTranslations('sales')
  const tc = useTranslations('common')
  const isNew = orderId === null

  // 头信息
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [discountRate, setDiscountRate] = useState('0')
  const [freightAmount, setFreightAmount] = useState('0')
  const [otherCharges, setOtherCharges] = useState('0')
  const [shippingAddress, setShippingAddress] = useState('')
  const [remark, setRemark] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [status, setStatus] = useState('draft')

  // 明细行
  const [items, setItems] = useState<ItemRow[]>([])

  // 下拉选项
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [materialOptions, setMaterialOptions] = useState<MaterialReferenceOption[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 持久化计数器，避免渲染时重置导致 key 重复
  const keyCounterRef = useRef(0)
  const nextKey = () => `item-${Date.now()}-${keyCounterRef.current++}`

  // ================================================================
  // 计算金额
  // ================================================================

  /** 合计金额（原币，各行金额之和） */
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items])

  /** 整单折扣金额 = 合计金额 × 整单折扣率/100 */
  const discountAmount = useMemo(() => {
    const rate = parseFloat(discountRate) || 0
    return Math.round((totalAmount * rate) / 100)
  }, [totalAmount, discountRate])

  /** 应收金额 = 合计 - 整单折扣 + 运费 + 其他 */
  const receivableAmount = useMemo(() => {
    const freight = parseInt(freightAmount) || 0
    const other = parseInt(otherCharges) || 0
    return totalAmount - discountAmount + freight + other
  }, [totalAmount, discountAmount, freightAmount, otherCharges])

  // ================================================================
  // 数据加载
  // ================================================================

  /** 加载客户、仓库和物料选项 */
  const loadOptions = useCallback(async () => {
    try {
      const [customerResult, warehouseResult, materials] = await Promise.all([
        getCustomers({ page: 1, pageSize: 999 }),
        getWarehouses(false),
        getMaterialReferenceOptions(),
      ])
      setCustomers(customerResult.items)
      setWarehouses(warehouseResult)
      setMaterialOptions(materials)
    } catch (error) {
      console.error('加载选项失败', error)
    }
  }, [])

  /** 加载销售单详情（编辑模式） */
  const loadDetail = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const detail = await invoke<SalesOrderDetail>('get_sales_order_detail', { id: orderId })
      setCustomerId(String(detail.customerId))
      setOrderDate(detail.orderDate)
      setDeliveryDate(detail.deliveryDate ?? '')
      setWarehouseId(String(detail.warehouseId))
      setCurrency(detail.currency)
      setExchangeRate(String(detail.exchangeRate))
      setDiscountRate(String(detail.discountRate))
      setFreightAmount(String(detail.freightAmount))
      setOtherCharges(String(detail.otherCharges))
      setShippingAddress(detail.shippingAddress ?? '')
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
          lineDiscount: String(item.lineDiscount),
          amount: item.amount,
          remark: item.remark ?? '',
        })),
      )
    } catch (error) {
      toast.error(typeof error === 'string' ? error : tc('loadDetailFailed'))
    } finally {
      setLoading(false)
    }
  }, [orderId, t])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])
  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  // 客户变更时带出币种、汇率、收货地址、折扣率
  useEffect(() => {
    if (!customerId) return
    const cid = Number(customerId)
    if (cid > 0 && isNew) {
      const customer = customers.find(c => c.id === cid)
      if (customer) {
        setCurrency(customer.currency)
        if (customer.currency === 'USD') {
          setExchangeRate('1')
        }
        // 带出客户默认折扣率（如果有）
        // defaultDiscount 在 SaveCustomerParams 中定义，但 CustomerListItem 没有
        // 这里暂时不设置，后续可通过详情接口获取
      }
    }
  }, [customerId, customers, isNew])

  // ================================================================
  // 明细行操作
  // ================================================================

  /** 从物料选择器添加一行 */
  const handleAddMaterial = (materialId: string) => {
    if (!materialId) return
    const mat = materialOptions.find(m => String(m.id) === materialId)
    if (!mat) return

    // 检查是否已添加
    if (items.some(item => item.materialId === mat.id)) {
      toast.error(tc('itemExists', { name: mat.name }))
      return
    }

    const newItem: ItemRow = {
      key: nextKey(),
      materialId: mat.id,
      materialCode: mat.code,
      materialName: mat.name,
      spec: mat.spec ?? '',
      unitId: mat.id, // 物料参考选项中 unitName 对应的 unitId 需要后端提供，暂用 materialId
      unitName: mat.unitName ?? '',
      conversionRate: 1,
      quantity: '1',
      unitPrice: '0',
      lineDiscount: '0',
      amount: 0,
      remark: '',
    }
    setItems(prev => [...prev, newItem])
  }

  /** 更新明细行字段 */
  const updateItem = (key: string, field: 'quantity' | 'unitPrice' | 'lineDiscount' | 'remark', value: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.key !== key) return item
        const updated = { ...item, [field]: value }
        // 重算金额：行金额 = 数量 × 单价 × (1 - 行折扣率/100)
        if (field === 'quantity' || field === 'unitPrice' || field === 'lineDiscount') {
          const qty = parseFloat(updated.quantity) || 0
          const price = parseInt(updated.unitPrice) || 0
          const discount = parseFloat(updated.lineDiscount) || 0
          updated.amount = Math.round(qty * price * (1 - discount / 100))
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
    if (!customerId) {
      toast.error(t('fieldRequired', { field: t('customer') }))
      return
    }
    if (!warehouseId) {
      toast.error(t('fieldRequired', { field: t('warehouse') }))
      return
    }
    if (!orderDate) {
      toast.error(t('fieldRequired', { field: t('orderDate') }))
      return
    }
    if (items.length === 0) {
      toast.error(t('pleaseAddItems'))
      return
    }

    setSaving(true)
    try {
      const params = {
        id: orderId,
        customerId: Number(customerId),
        orderDate,
        deliveryDate: deliveryDate || null,
        warehouseId: Number(warehouseId),
        currency,
        exchangeRate: parseFloat(exchangeRate) || 1,
        discountRate: parseFloat(discountRate) || 0,
        freightAmount: parseInt(freightAmount) || 0,
        otherCharges: parseInt(otherCharges) || 0,
        shippingAddress: shippingAddress || null,
        remark: remark || null,
        items: items.map((item, idx) => ({
          materialId: item.materialId,
          spec: item.spec || null,
          unitId: item.unitId,
          unitNameSnapshot: item.unitName,
          conversionRateSnapshot: item.conversionRate,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseInt(item.unitPrice) || 0,
          lineDiscount: parseFloat(item.lineDiscount) || 0,
          remark: item.remark || null,
          sortOrder: idx,
        })),
      }

      await invoke<number>('save_sales_order', { params })
      toast.success(tc('saveSuccess'))
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : tc('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // ================================================================
  // 下拉选项
  // ================================================================

  const customerItems = useMemo(() => customers.map(c => ({ value: String(c.id), label: `${c.name} [${c.code}]` })), [customers])

  const warehouseItems = useMemo(() => warehouses.map(w => ({ value: String(w.id), label: w.name })), [warehouses])

  const currencyItems = useMemo(() => CURRENCY_OPTIONS.map(c => ({ value: c.value, label: c.label })), [])

  const materialSelectItems = useMemo(() => materialOptions.map(m => ({ value: String(m.id), label: `${m.name} [${m.code}]` })), [materialOptions])

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
          <h2 className="text-foreground text-xl font-bold">{isNew ? t('addOrder') : `${t('title')} - ${orderNo}`}</h2>
          {!isNew && (
            <Badge variant={status === 'draft' ? 'secondary' : 'default'}>
              {t(`status${status.charAt(0).toUpperCase() + status.slice(1).replace('_', '')}` as any)}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tc('loading') : tc('save')}
          </Button>
        </div>
      </div>

      {/* 头信息 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          {/* 客户 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('customer')} *</Label>
            <Select value={customerId} onValueChange={v => setCustomerId(v ?? '')} items={customerItems} disabled={!isNew && status !== 'draft'}>
              <SelectTrigger>
                <SelectValue placeholder={t('allCustomers')} />
              </SelectTrigger>
              <SelectContent>
                {customerItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 销售日期 */}
          <div className="grid gap-2">
            <Label>{t('orderDate')} *</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>

          {/* 交货日期 */}
          <div className="grid gap-2">
            <Label>{t('deliveryDate')}</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>

          {/* 出库仓库 */}
          <div className="grid gap-2">
            <Label>{t('warehouse')} *</Label>
            <Select value={warehouseId} onValueChange={v => setWarehouseId(v ?? '')} items={warehouseItems}>
              <SelectTrigger>
                <SelectValue placeholder={t('allWarehouses')} />
              </SelectTrigger>
              <SelectContent>
                {warehouseItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 结算币种 */}
          <div className="grid gap-2">
            <Label>{t('currency')}</Label>
            <Select
              value={currency}
              onValueChange={v => {
                if (v) {
                  setCurrency(v)
                  if (v === 'USD') setExchangeRate('1')
                }
              }}
              items={currencyItems}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
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

          {/* 收货地址 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('shippingAddress')}</Label>
            <Input value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} />
          </div>

          {/* 备注 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('remark')}</Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 明细表格 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('itemsTitle')}</h3>
          {/* 物料选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{t('addMaterial')}</span>
            <Select
              value=""
              onValueChange={v => {
                if (v) handleAddMaterial(v)
              }}
              items={materialSelectItems}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder={t('addMaterial')} />
              </SelectTrigger>
              <SelectContent>
                {materialSelectItems.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[100px]">{t('materialCode')}</TableHead>
                <TableHead className="w-[150px]">{t('materialName')}</TableHead>
                <TableHead className="w-[90px]">{t('spec')}</TableHead>
                <TableHead className="w-[60px]">{t('unit')}</TableHead>
                <TableHead className="w-[90px]">{t('thisQuantity')}</TableHead>
                <TableHead className="w-[110px]">{t('unitPrice')}</TableHead>
                <TableHead className="w-[80px]">{t('lineDiscount')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('amount')}</TableHead>
                <TableHead className="w-[110px]">{t('remark')}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-12 text-center">
                    {customerId ? t('pleaseAddItems') : t('pleaseSelectCustomerFirst')}
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
                    <TableCell>
                      <Input
                        type="number"
                        value={item.lineDiscount}
                        onChange={e => updateItem(item.key, 'lineDiscount', e.target.value)}
                        className="h-8 w-full text-right font-mono"
                        min={0}
                        max={100}
                        step="0.1"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatAmount(item.amount, currency as 'VND' | 'CNY' | 'USD')}</TableCell>
                    <TableCell>
                      <Input value={item.remark} onChange={e => updateItem(item.key, 'remark', e.target.value)} className="h-8 w-full text-sm" />
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
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-6">
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">{t('totalAmount')}</Label>
            <div className="font-mono text-lg font-semibold">{formatAmount(totalAmount, currency as 'VND' | 'CNY' | 'USD')}</div>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('discountRate')} (%)</Label>
            <Input
              type="number"
              value={discountRate}
              onChange={e => setDiscountRate(e.target.value)}
              className="h-8 font-mono"
              min={0}
              max={100}
              step="0.1"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">{t('discountAmount')}</Label>
            <div className="font-mono text-sm">{formatAmount(discountAmount, currency as 'VND' | 'CNY' | 'USD')}</div>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('freightAmount')}</Label>
            <Input type="number" value={freightAmount} onChange={e => setFreightAmount(e.target.value)} className="h-8 font-mono" min={0} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('otherCharges')}</Label>
            <Input type="number" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} className="h-8 font-mono" min={0} />
          </div>
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">{t('receivableAmount')}</Label>
            <div className="text-primary font-mono text-xl font-bold">{formatAmount(receivableAmount, currency as 'VND' | 'CNY' | 'USD')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
