'use client'

import { ArrowLeft, Calculator, Plus, ShoppingCart, Trash2 } from 'lucide-react'
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
import type { CustomerListItem } from '@/lib/tauri'
import { getCustomers, invoke } from '@/lib/tauri'

// ================================================================
// 类型定义
// ================================================================

/** 定制配置明细行编辑状态 */
interface ConfigItemRow {
  key: string
  configKey: string
  standardValue: string
  customValue: string
  extraCharge: string
  remark: string
  sortOrder: number
}

/** 定制单详情 */
interface CustomOrderDetailData {
  id: number
  order_no: string
  customer_id: number
  customer_name: string | null
  order_date: string
  delivery_date: string | null
  currency: string
  exchange_rate: number
  custom_type: string
  priority: string
  status: string
  ref_material_id: number | null
  ref_material_name: string | null
  ref_bom_id: number | null
  custom_desc: string | null
  quote_amount: number
  quote_amount_base: number
  cost_amount: number
  attachment_path: string | null
  sales_order_id: number | null
  sales_order_no: string | null
  remark: string | null
  created_by_name: string | null
  confirmed_by_name: string | null
  confirmed_at: string | null
  created_at: string | null
  updated_at: string | null
  items: {
    id?: number
    config_key: string
    standard_value: string | null
    custom_value: string
    extra_charge: number
    remark: string | null
    sort_order: number
  }[]
  custom_bom: { bom_id: number; bom_code: string; material_name: string | null; total_standard_cost: number; item_count: number } | null
  reservations: {
    material_id: number
    material_code: string | null
    material_name: string | null
    unit_name: string | null
    warehouse_name: string | null
    reserved_qty: number
    consumed_qty: number
    status: string
  }[]
}

/** 参考物料选项 */
interface MaterialOption {
  id: number
  code: string
  name: string
}

/** BOM 选项 */
interface BomOption {
  id: number
  bom_code: string
  material_name: string | null
}

/** 币种选项 */
const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'USD', label: 'USD ($)' },
] as const

/** 定制类型选项 */
const TYPE_OPTIONS = [
  { value: 'size', labelKey: 'typeSize' },
  { value: 'material', labelKey: 'typeMaterial' },
  { value: 'full', labelKey: 'typeFull' },
] as const

/** 优先级选项 */
const PRIORITY_OPTIONS = [
  { value: 'normal', labelKey: 'priorityNormal' },
  { value: 'urgent', labelKey: 'priorityUrgent' },
  { value: 'critical', labelKey: 'priorityCritical' },
] as const

/** 状态样式 */
const STATUS_STYLES: Record<string, string> = {
  quoting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  quoting: 'statusQuoting',
  confirmed: 'statusConfirmed',
  producing: 'statusProducing',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
}

/** 预留状态样式 */
const RESERVATION_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  consumed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  released: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const RESERVATION_LABEL_KEYS: Record<string, string> = {
  active: 'reservationActive',
  consumed: 'reservationConsumed',
  released: 'reservationReleased',
  cancelled: 'reservationCancelled',
}

interface CustomOrderDetailPageProps {
  orderId: number | null
  onBack: () => void
}

export function CustomOrderDetailPage({ orderId, onBack }: CustomOrderDetailPageProps) {
  const t = useTranslations('customOrders')
  const tc = useTranslations('common')
  const isNew = orderId === null

  // 头信息
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [customType, setCustomType] = useState('size')
  const [priority, setPriority] = useState('normal')
  const [refMaterialId, setRefMaterialId] = useState('')
  const [refBomId, setRefBomId] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('0')
  const [remark, setRemark] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [status, setStatus] = useState('quoting')
  const [costAmount, setCostAmount] = useState(0)
  const [salesOrderNo, setSalesOrderNo] = useState<string | null>(null)
  const [confirmedByName, setConfirmedByName] = useState<string | null>(null)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)

  // 配置明细行
  const [configItems, setConfigItems] = useState<ConfigItemRow[]>([])

  // 定制 BOM 信息
  const [customBom, setCustomBom] = useState<CustomOrderDetailData['custom_bom']>(null)

  // 预留状态
  const [reservations, setReservations] = useState<CustomOrderDetailData['reservations']>([])

  // 下拉选项
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([])
  const [bomOptions, setBomOptions] = useState<BomOption[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const keyCounterRef = useRef(0)
  const nextKey = () => `cfg-${Date.now()}-${keyCounterRef.current++}`

  const isReadonly = status !== 'quoting'

  // ================================================================
  // 计算
  // ================================================================

  /** 加价合计 */
  const extraChargeTotal = useMemo(() => configItems.reduce((sum, item) => sum + (parseInt(item.extraCharge) || 0), 0), [configItems])

  /** 毛利预估 = 报价 - 成本 */
  const estimatedProfit = useMemo(() => {
    const quote = parseInt(quoteAmount) || 0
    return quote - costAmount
  }, [quoteAmount, costAmount])

  // ================================================================
  // 数据加载
  // ================================================================

  const loadOptions = useCallback(async () => {
    try {
      const [customerResult, matResult] = await Promise.all([
        getCustomers({ page: 1, pageSize: 999 }),
        invoke<MaterialOption[]>('get_material_reference_options', {}),
      ])
      setCustomers(customerResult.items)
      setMaterialOptions(matResult)
    } catch (error) {
      console.error('加载选项失败', error)
    }
  }, [])

  /** 加载 BOM 选项（基于参考物料） */
  const loadBomOptions = useCallback(async (materialId: number) => {
    if (!materialId) {
      setBomOptions([])
      return
    }
    try {
      const result = await invoke<{ items: { id: number; bom_code: string; material_name: string | null }[] }>('get_boms', {
        filter: { material_id: materialId, page: 1, page_size: 100, keyword: null, status: null },
      })
      setBomOptions(result.items.map(b => ({ id: b.id, bom_code: b.bom_code, material_name: b.material_name })))
    } catch {
      setBomOptions([])
    }
  }, [])

  /** 加载定制单详情（编辑模式） */
  const loadDetail = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const detail = await invoke<CustomOrderDetailData>('get_custom_order_detail', { id: orderId })
      setCustomerId(String(detail.customer_id))
      setOrderDate(detail.order_date)
      setDeliveryDate(detail.delivery_date ?? '')
      setCurrency(detail.currency)
      setExchangeRate(String(detail.exchange_rate))
      setCustomType(detail.custom_type)
      setPriority(detail.priority)
      setRefMaterialId(detail.ref_material_id ? String(detail.ref_material_id) : '')
      setRefBomId(detail.ref_bom_id ? String(detail.ref_bom_id) : '')
      setCustomDesc(detail.custom_desc ?? '')
      setQuoteAmount(String(detail.quote_amount))
      setRemark(detail.remark ?? '')
      setOrderNo(detail.order_no)
      setStatus(detail.status)
      setCostAmount(detail.cost_amount)
      setSalesOrderNo(detail.sales_order_no)
      setConfirmedByName(detail.confirmed_by_name)
      setConfirmedAt(detail.confirmed_at)
      setCustomBom(detail.custom_bom)
      setReservations(detail.reservations)

      // 转换配置明细行
      setConfigItems(
        detail.items.map((item, idx) => ({
          key: `loaded-${idx}`,
          configKey: item.config_key,
          standardValue: item.standard_value ?? '',
          customValue: item.custom_value,
          extraCharge: String(item.extra_charge),
          remark: item.remark ?? '',
          sortOrder: item.sort_order,
        })),
      )

      // 加载 BOM 选项
      if (detail.ref_material_id) {
        await loadBomOptions(detail.ref_material_id)
      }
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [orderId, t, loadBomOptions])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])
  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  // 参考物料变更时加载 BOM 选项
  useEffect(() => {
    if (refMaterialId) {
      void loadBomOptions(Number(refMaterialId))
    } else {
      setBomOptions([])
    }
  }, [refMaterialId, loadBomOptions])

  // ================================================================
  // 配置明细操作
  // ================================================================

  const addConfigItem = () => {
    setConfigItems(prev => [
      ...prev,
      {
        key: nextKey(),
        configKey: '',
        standardValue: '',
        customValue: '',
        extraCharge: '0',
        remark: '',
        sortOrder: prev.length,
      },
    ])
  }

  const updateConfigItem = (key: string, field: keyof ConfigItemRow, value: string) => {
    setConfigItems(prev => prev.map(item => (item.key === key ? { ...item, [field]: value } : item)))
  }

  const removeConfigItem = (key: string) => {
    setConfigItems(prev => prev.filter(item => item.key !== key))
  }

  // ================================================================
  // 业务操作
  // ================================================================

  const handleSave = async () => {
    if (!customerId) {
      toast.error(t('customer') + '不能为空')
      return
    }
    setSaving(true)
    try {
      const params = {
        id: orderId,
        customer_id: Number(customerId),
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        currency,
        exchange_rate: parseFloat(exchangeRate) || 1,
        custom_type: customType,
        priority,
        ref_material_id: refMaterialId ? Number(refMaterialId) : null,
        ref_bom_id: refBomId ? Number(refBomId) : null,
        custom_desc: customDesc || null,
        quote_amount: parseInt(quoteAmount) || 0,
        attachment_path: null,
        remark: remark || null,
        items: configItems.map((item, idx) => ({
          config_key: item.configKey,
          standard_value: item.standardValue || null,
          custom_value: item.customValue,
          extra_charge: parseInt(item.extraCharge) || 0,
          remark: item.remark || null,
          sort_order: idx,
        })),
      }

      await invoke<number>('save_custom_order', { params })
      toast.success(t('saveSuccess'))
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  /** 创建定制 BOM */
  const handleCreateBom = async () => {
    if (!refBomId) {
      toast.error(t('selectBom'))
      return
    }
    try {
      await invoke<number>('create_custom_bom', {
        customOrderId: orderId,
        sourceBomId: Number(refBomId),
      })
      toast.success(t('bomCreateSuccess'))
      await loadDetail()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('bomCreateError'))
    }
  }

  /** 成本核算 */
  const handleCalcCost = async () => {
    try {
      const cost = await invoke<number>('calculate_custom_cost', { customOrderId: orderId })
      setCostAmount(cost)
      toast.success(t('costCalcSuccess'))
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('costCalcError'))
    }
  }

  /** 转销售单 */
  const handleConvert = async () => {
    if (!window.confirm(t('convertConfirm'))) return
    try {
      await invoke<number>('convert_to_sales_order', { customOrderId: orderId })
      toast.success(t('convertSuccess'))
      await loadDetail()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('convertError'))
    }
  }

  // ================================================================
  // 下拉选项
  // ================================================================

  const customerItems = useMemo(() => customers.map(c => ({ value: String(c.id), label: `${c.name} [${c.code}]` })), [customers])
  const currencyItems = useMemo(() => CURRENCY_OPTIONS.map(c => ({ value: c.value, label: c.label })), [])
  const typeItems = useMemo(() => TYPE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) })), [t])
  const priorityItems = useMemo(() => PRIORITY_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) })), [t])
  const materialSelectItems = useMemo(() => materialOptions.map(m => ({ value: String(m.id), label: `${m.name} [${m.code}]` })), [materialOptions])
  const bomSelectItems = useMemo(
    () => bomOptions.map(b => ({ value: String(b.id), label: `${b.bom_code} - ${b.material_name ?? ''}` })),
    [bomOptions],
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
          <h2 className="text-foreground text-xl font-bold">{isNew ? t('addOrder') : `${t('title')} - ${orderNo}`}</h2>
          {!isNew && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || ''}`}>
              {t(STATUS_LABEL_KEYS[status] || 'statusQuoting')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* 业务操作按钮 */}
          {status === 'confirmed' && !salesOrderNo && (
            <Button variant="outline" onClick={handleConvert}>
              <ShoppingCart className="size-4" />
              {t('convertToSales')}
            </Button>
          )}
          {status === 'quoting' && !isNew && customBom && (
            <Button variant="outline" onClick={handleCalcCost}>
              <Calculator className="size-4" />
              {t('calculateCost')}
            </Button>
          )}
          <Button variant="outline" onClick={onBack}>
            {tc('cancel')}
          </Button>
          {!isReadonly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tc('loading') : tc('save')}
            </Button>
          )}
        </div>
      </div>

      {/* 头信息 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          {/* 客户 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('customer')} *</Label>
            <Select value={customerId} onValueChange={v => setCustomerId(v ?? '')} items={customerItems} disabled={isReadonly}>
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

          {/* 定制日期 */}
          <div className="grid gap-2">
            <Label>{t('orderDate')} *</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} disabled={isReadonly} />
          </div>

          {/* 交货日期 */}
          <div className="grid gap-2">
            <Label>{t('deliveryDate')}</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} disabled={isReadonly} />
          </div>

          {/* 定制类型 */}
          <div className="grid gap-2">
            <Label>{t('customType')} *</Label>
            <Select value={customType} onValueChange={v => v && setCustomType(v)} items={typeItems} disabled={isReadonly}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 优先级 */}
          <div className="grid gap-2">
            <Label>{t('priority')}</Label>
            <Select value={priority} onValueChange={v => v && setPriority(v)} items={priorityItems} disabled={isReadonly}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 币种 */}
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
              disabled={isReadonly}
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
              disabled={currency === 'USD' || isReadonly}
              min={0}
              step="0.01"
            />
          </div>

          {/* 参考产品 */}
          <div className="grid gap-2">
            <Label>{t('refProduct')}</Label>
            <Select value={refMaterialId} onValueChange={v => setRefMaterialId(v ?? '')} items={materialSelectItems} disabled={isReadonly}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {materialSelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 参考 BOM */}
          <div className="grid gap-2">
            <Label>{t('refBom')}</Label>
            <Select
              value={refBomId}
              onValueChange={v => setRefBomId(v ?? '')}
              items={bomSelectItems}
              disabled={isReadonly || bomOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {bomSelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 报价金额 */}
          <div className="grid gap-2">
            <Label>{t('quoteAmount')} *</Label>
            <Input type="number" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} disabled={isReadonly} min={0} />
          </div>

          {/* 定制说明 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('customDesc')}</Label>
            <Input value={customDesc} onChange={e => setCustomDesc(e.target.value)} disabled={isReadonly} />
          </div>

          {/* 备注 */}
          <div className="col-span-2 grid gap-2">
            <Label>{t('remark')}</Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} disabled={isReadonly} />
          </div>
        </div>

        {/* 确认信息（只读展示） */}
        {confirmedByName && (
          <div className="mt-4 flex gap-6 border-t pt-4">
            <div className="text-muted-foreground text-sm">
              {t('confirmedBy')}: <span className="text-foreground font-medium">{confirmedByName}</span>
            </div>
            <div className="text-muted-foreground text-sm">
              {t('confirmedAt')}: <span className="text-foreground">{confirmedAt}</span>
            </div>
            {salesOrderNo && (
              <div className="text-muted-foreground text-sm">
                {t('salesOrderNo')}: <span className="text-foreground font-mono">{salesOrderNo}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 定制配置明细表格 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('configTitle')}</h3>
          {!isReadonly && (
            <Button variant="outline" size="sm" onClick={addConfigItem}>
              <Plus data-icon="inline-start" />
              {t('addConfig')}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[800px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[150px]">{t('configKey')}</TableHead>
                <TableHead className="w-[150px]">{t('standardValue')}</TableHead>
                <TableHead className="w-[150px]">{t('customValue')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('extraCharge')}</TableHead>
                <TableHead className="w-[140px]">{t('configRemark')}</TableHead>
                {!isReadonly && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {configItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isReadonly ? 6 : 7} className="text-muted-foreground py-12 text-center">
                    {t('noConfigItems')}
                  </TableCell>
                </TableRow>
              ) : (
                configItems.map((item, idx) => (
                  <TableRow key={item.key}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={item.configKey}
                        onChange={e => updateConfigItem(item.key, 'configKey', e.target.value)}
                        className="h-8"
                        disabled={isReadonly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.standardValue}
                        onChange={e => updateConfigItem(item.key, 'standardValue', e.target.value)}
                        className="h-8"
                        disabled={isReadonly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.customValue}
                        onChange={e => updateConfigItem(item.key, 'customValue', e.target.value)}
                        className="h-8"
                        disabled={isReadonly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.extraCharge}
                        onChange={e => updateConfigItem(item.key, 'extraCharge', e.target.value)}
                        className="h-8 text-right font-mono"
                        disabled={isReadonly}
                        min={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.remark}
                        onChange={e => updateConfigItem(item.key, 'remark', e.target.value)}
                        className="h-8 text-sm"
                        disabled={isReadonly}
                      />
                    </TableCell>
                    {!isReadonly && (
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeConfigItem(item.key)}>
                          <Trash2 className="text-destructive size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 定制 BOM 区域 */}
      {!isNew && (
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground font-semibold">{t('bomTitle')}</h3>
            {!isReadonly && !customBom && refBomId && (
              <Button variant="outline" size="sm" onClick={handleCreateBom}>
                <Plus data-icon="inline-start" />
                {t('createBom')}
              </Button>
            )}
          </div>
          {customBom ? (
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">{t('bomTitle')}</p>
                <p className="font-mono text-sm font-medium">{customBom.bom_code}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('bomMaterial')}</p>
                <p className="text-sm">{customBom.material_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('bomCost')}</p>
                <p className="font-mono text-sm font-medium">{formatAmount(customBom.total_standard_cost, 'USD')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('bomStdQty')}</p>
                <p className="text-sm">{customBom.item_count} 项</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">{t('bomNone')}</p>
          )}
        </div>
      )}

      {/* 预留状态 */}
      {reservations.length > 0 && (
        <div className="border-border bg-card rounded-xl border shadow-sm">
          <div className="border-b px-6 py-4">
            <h3 className="text-foreground font-semibold">{t('reservationTitle')}</h3>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[700px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t('bomMaterialCode')}</TableHead>
                  <TableHead className="w-[150px]">{t('bomMaterial')}</TableHead>
                  <TableHead className="w-[80px]">{tc('unit')}</TableHead>
                  <TableHead className="w-[100px] text-right">{t('reservedQty')}</TableHead>
                  <TableHead className="w-[100px] text-right">{t('consumedQty')}</TableHead>
                  <TableHead className="w-[100px]">{tc('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((res, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{res.material_code ?? '—'}</TableCell>
                    <TableCell className="text-sm">{res.material_name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{res.unit_name ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{res.reserved_qty}</TableCell>
                    <TableCell className="text-right font-mono">{res.consumed_qty}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${RESERVATION_STYLES[res.status] || ''}`}
                      >
                        {t(RESERVATION_LABEL_KEYS[res.status] || 'reservationActive')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 报价信息汇总 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h3 className="text-foreground mb-4 font-semibold">{t('quoteTitle')}</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-5">
          <div>
            <p className="text-muted-foreground text-xs">{t('materialCost')}</p>
            <p className="font-mono text-lg font-semibold">{formatAmount(costAmount, currency as 'VND' | 'CNY' | 'USD')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('configCharges')}</p>
            <p className="font-mono text-lg">{formatAmount(extraChargeTotal, currency as 'VND' | 'CNY' | 'USD')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('totalCost')}</p>
            <p className="font-mono text-lg">{formatAmount(costAmount + extraChargeTotal, currency as 'VND' | 'CNY' | 'USD')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('quotePrice')}</p>
            <p className="text-primary font-mono text-xl font-bold">{formatAmount(parseInt(quoteAmount) || 0, currency as 'VND' | 'CNY' | 'USD')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('estimatedProfit')}</p>
            <p className={`font-mono text-lg font-semibold ${estimatedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatAmount(estimatedProfit, currency as 'VND' | 'CNY' | 'USD')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
