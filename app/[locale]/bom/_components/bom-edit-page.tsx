'use client'

import { ArrowLeft, Calculator, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { invoke, isTauriEnv } from '@/lib/tauri'
import { formatAmount } from '@/lib/currency'

import { BomItemDialog } from './bom-item-dialog'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

interface BomDetail {
  id: number
  bom_code: string
  material_id: number
  material_code: string | null
  material_name: string | null
  material_spec: string | null
  version: string
  status: string
  effective_date: string | null
  total_standard_cost: number
  remark: string | null
  items: BomItemRow[]
}

export interface BomItemRow {
  id?: number
  bom_id?: number
  child_material_id: number
  material_code: string | null
  material_name: string | null
  material_spec: string | null
  unit_name: string | null
  ref_cost_price: number | null
  standard_qty: number
  wastage_rate: number
  actual_qty: number | null
  process_step: string | null
  is_key_part: boolean
  substitute_id: number | null
  substitute_name: string | null
  remark: string | null
  sort_order: number
}

interface ParentMaterialOption {
  id: number
  code: string
  name: string
  spec: string | null
  material_type: string
}

interface DemandItem {
  material_id: number
  material_code: string | null
  material_name: string | null
  material_spec: string | null
  unit_name: string | null
  single_qty: number
  total_qty: number
  current_stock: number
  shortage: number
}

/* ------------------------------------------------------------------ */
/*  Mock 数据                                                          */
/* ------------------------------------------------------------------ */

const MOCK_PARENT_MATERIALS: ParentMaterialOption[] = [
  { id: 4, code: 'FP-001', name: '实木餐椅', spec: '450×520×880mm', material_type: 'finished' },
  { id: 5, code: 'FP-002', name: '橡木茶几', spec: '1200×600×450mm', material_type: 'finished' },
  { id: 6, code: 'SP-001', name: '餐椅椅架', spec: null, material_type: 'semi' },
]

const MOCK_BOM_DETAIL: BomDetail = {
  id: 1,
  bom_code: 'BOM-20260401-001',
  material_id: 4,
  material_code: 'FP-001',
  material_name: '实木餐椅',
  material_spec: '450×520×880mm',
  version: 'V2.0',
  status: 'active',
  effective_date: '2026-03-15',
  total_standard_cost: 4500,
  remark: null,
  items: [
    {
      child_material_id: 1,
      material_code: 'M-0001',
      material_name: '白橡实木板',
      material_spec: '2440×1220',
      unit_name: '张',
      ref_cost_price: 28000,
      standard_qty: 2.5,
      wastage_rate: 5,
      actual_qty: 2.625,
      process_step: 'cutting',
      is_key_part: true,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 1,
    },
    {
      child_material_id: 7,
      material_code: 'M-0007',
      material_name: '木方',
      material_spec: '40×40',
      unit_name: '根',
      ref_cost_price: 1200,
      standard_qty: 4,
      wastage_rate: 3,
      actual_qty: 4.12,
      process_step: 'cutting',
      is_key_part: false,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 2,
    },
    {
      child_material_id: 8,
      material_code: 'M-0008',
      material_name: '不锈钢腿',
      material_spec: '710mm',
      unit_name: '个',
      ref_cost_price: 3500,
      standard_qty: 4,
      wastage_rate: 0,
      actual_qty: 4,
      process_step: 'assembly',
      is_key_part: true,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 3,
    },
    {
      child_material_id: 9,
      material_code: 'M-0009',
      material_name: '螺丝M6',
      material_spec: '30mm',
      unit_name: '个',
      ref_cost_price: 15,
      standard_qty: 16,
      wastage_rate: 2,
      actual_qty: 16.32,
      process_step: 'assembly',
      is_key_part: false,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 4,
    },
    {
      child_material_id: 10,
      material_code: 'M-0010',
      material_name: '木蜡油',
      material_spec: null,
      unit_name: '千克',
      ref_cost_price: 6800,
      standard_qty: 0.5,
      wastage_rate: 10,
      actual_qty: 0.55,
      process_step: 'painting',
      is_key_part: false,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 5,
    },
  ],
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

interface BomEditPageProps {
  bomId: number | null
  onBack: () => void
}

export function BomEditPage({ bomId, onBack }: BomEditPageProps) {
  const t = useTranslations('bom')
  const isNew = bomId === null

  // BOM 头信息
  const [materialId, setMaterialId] = useState<string>('')
  const [version, setVersion] = useState('V1.0')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [remark, setRemark] = useState('')
  const [bomCode, setBomCode] = useState('')
  const [status, setStatus] = useState('draft')

  // BOM 明细
  const [items, setItems] = useState<BomItemRow[]>([])

  // 父项物料选项
  const [parentMaterials, setParentMaterials] = useState<ParentMaterialOption[]>([])

  // 明细编辑弹窗
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)

  // 需求计算
  const [demandQty, setDemandQty] = useState<string>('10')
  const [demandResults, setDemandResults] = useState<DemandItem[]>([])
  const [demandLoading, setDemandLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const parentMaterialItems = useMemo(
    () =>
      parentMaterials.map(m => ({
        value: m.id.toString(),
        label: `${m.name}${m.spec ? ` (${m.spec})` : ''} [${m.code}]`,
      })),
    [parentMaterials],
  )

  /** 计算标准成本合计 */
  const totalStandardCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const actualQty = item.standard_qty * (1 + item.wastage_rate / 100)
      const cost = (item.ref_cost_price ?? 0) * actualQty
      return sum + cost
    }, 0)
  }, [items])

  /** 加载父项物料选项 */
  const fetchParentMaterials = useCallback(async () => {
    if (!isTauriEnv()) {
      setParentMaterials(MOCK_PARENT_MATERIALS)
      return
    }
    try {
      const res = await invoke<ParentMaterialOption[]>('get_bom_parent_materials')
      setParentMaterials(res)
    } catch (e) {
      console.error('加载父项物料失败', e)
    }
  }, [])

  /** 加载 BOM 详情 */
  const fetchBomDetail = useCallback(async () => {
    if (!bomId) return
    setLoading(true)
    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 300))
      const detail = MOCK_BOM_DETAIL
      setMaterialId(detail.material_id.toString())
      setVersion(detail.version)
      setEffectiveDate(detail.effective_date ?? '')
      setRemark(detail.remark ?? '')
      setBomCode(detail.bom_code)
      setStatus(detail.status)
      setItems(detail.items)
      setLoading(false)
      return
    }
    try {
      const detail = await invoke<BomDetail>('get_bom_detail', { id: bomId })
      setMaterialId(detail.material_id.toString())
      setVersion(detail.version)
      setEffectiveDate(detail.effective_date ?? '')
      setRemark(detail.remark ?? '')
      setBomCode(detail.bom_code)
      setStatus(detail.status)
      setItems(detail.items)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [bomId, t])

  useEffect(() => {
    fetchParentMaterials()
  }, [fetchParentMaterials])
  useEffect(() => {
    fetchBomDetail()
  }, [fetchBomDetail])

  /** 保存 BOM */
  const handleSave = async () => {
    if (!materialId) {
      toast.error(t('notifications.noMaterialSelected'))
      return
    }
    if (items.length === 0) {
      toast.error(t('notifications.noItemsAdded'))
      return
    }

    setSaving(true)
    const params = {
      id: bomId,
      material_id: parseInt(materialId, 10),
      version,
      effective_date: effectiveDate || null,
      status: isNew ? 'draft' : status,
      remark: remark || null,
      items: items.map((item, idx) => ({
        child_material_id: item.child_material_id,
        standard_qty: item.standard_qty,
        wastage_rate: item.wastage_rate,
        process_step: item.process_step || null,
        is_key_part: item.is_key_part,
        substitute_id: item.substitute_id,
        remark: item.remark || null,
        sort_order: idx + 1,
      })),
    }

    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 300))
      toast.success(t('notifications.saveBomSuccess'))
      setSaving(false)
      onBack()
      return
    }

    try {
      await invoke('save_bom', { params })
      toast.success(t('notifications.saveBomSuccess'))
      onBack()
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.saveBomFailed'))
    } finally {
      setSaving(false)
    }
  }

  /** 删除明细行 */
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  /** 添加/编辑明细回调 */
  const handleItemSave = (item: BomItemRow) => {
    if (editingItemIndex !== null) {
      setItems(prev => prev.map((r, i) => (i === editingItemIndex ? item : r)))
    } else {
      setItems(prev => [...prev, { ...item, sort_order: prev.length + 1 }])
    }
    setItemDialogOpen(false)
    setEditingItemIndex(null)
  }

  /** 需求计算 */
  const handleCalcDemand = async () => {
    const qty = parseFloat(demandQty)
    if (!qty || qty <= 0) return

    if (!bomId && items.length === 0) return

    setDemandLoading(true)

    if (!isTauriEnv() || !bomId) {
      // 本地计算
      await new Promise(r => setTimeout(r, 200))
      const results: DemandItem[] = items.map(item => {
        const singleQty = item.standard_qty * (1 + item.wastage_rate / 100)
        const totalQty = singleQty * qty
        const currentStock = 100 // mock
        return {
          material_id: item.child_material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          material_spec: item.material_spec,
          unit_name: item.unit_name,
          single_qty: singleQty,
          total_qty: totalQty,
          current_stock: currentStock,
          shortage: Math.max(0, totalQty - currentStock),
        }
      })
      setDemandResults(results)
      setDemandLoading(false)
      return
    }

    try {
      const results = await invoke<DemandItem[]>('calculate_bom_demand', {
        bomId,
        quantity: qty,
      })
      setDemandResults(results)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.loadFailed'))
    } finally {
      setDemandLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground">加载中...</span>
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
            {t('actions.backToList')}
          </Button>
          <h2 className="text-foreground text-xl font-bold">{isNew ? t('form.titleNew') : t('form.titleEdit')}</h2>
          {!isNew && bomCode && (
            <Badge variant="outline" className="font-mono">
              {bomCode}
            </Badge>
          )}
          {!isNew && <Badge variant={status === 'active' ? 'default' : 'secondary'}>{t(`status.${status}`)}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '...' : t('actions.save')}
          </Button>
        </div>
      </div>

      {/* BOM 头信息 */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h3 className="text-foreground mb-4 font-semibold">{t('form.title')}</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          <div className="col-span-2 grid gap-2">
            <Label>{t('form.selectMaterial')} *</Label>
            <Select value={materialId} onValueChange={v => setMaterialId(v ?? '')} items={parentMaterialItems} disabled={!isNew}>
              <SelectTrigger>
                <SelectValue placeholder={t('form.selectMaterialPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {parentMaterialItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t('form.version')} *</Label>
            <Input value={version} onChange={e => setVersion(e.target.value)} placeholder={t('form.versionPlaceholder')} />
          </div>
          <div className="grid gap-2">
            <Label>{t('form.effectiveDate')}</Label>
            <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>
          <div className="col-span-2 grid gap-2 lg:col-span-3">
            <Label>{t('form.remark')}</Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('form.remarkPlaceholder')} />
          </div>
          <div className="grid gap-2">
            <Label>{t('detail.standardCost')}</Label>
            <div className="text-foreground flex h-9 items-center rounded-md border px-3 font-mono text-lg font-semibold">
              {formatAmount(Math.round(totalStandardCost), 'USD')}
            </div>
          </div>
        </div>
      </div>

      {/* BOM 明细 */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">{t('items.title')}</h3>
          <Button
            size="sm"
            onClick={() => {
              setEditingItemIndex(null)
              setItemDialogOpen(true)
            }}
          >
            <Plus data-icon="inline-start" />
            {t('actions.addMaterial')}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="w-[160px]">{t('items.materialName')}</TableHead>
                <TableHead className="w-[100px]">{t('items.spec')}</TableHead>
                <TableHead className="w-[60px]">{t('items.unit')}</TableHead>
                <TableHead className="w-[90px]">{t('items.standardQty')}</TableHead>
                <TableHead className="w-[90px]">{t('items.wastageRate')}</TableHead>
                <TableHead className="w-[90px]">{t('items.actualQty')}</TableHead>
                <TableHead className="w-[100px]">{t('items.unitPrice')}</TableHead>
                <TableHead className="w-[100px]">{t('items.cost')}</TableHead>
                <TableHead className="w-[80px]">{t('items.processStep')}</TableHead>
                <TableHead className="w-[80px]">{t('items.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-12 text-center">
                    {t('items.noItems')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => {
                  const actualQty = item.standard_qty * (1 + item.wastage_rate / 100)
                  const cost = (item.ref_cost_price ?? 0) * actualQty
                  return (
                    <TableRow key={`${item.child_material_id}-${idx}`} className="group">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{item.material_name}</div>
                          <div className="text-muted-foreground truncate text-xs">{item.material_code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate">{item.material_spec ?? '—'}</TableCell>
                      <TableCell>{item.unit_name ?? '—'}</TableCell>
                      <TableCell className="font-mono">{item.standard_qty}</TableCell>
                      <TableCell className="font-mono">{item.wastage_rate}%</TableCell>
                      <TableCell className="font-mono">{actualQty.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">{formatAmount(item.ref_cost_price ?? 0, 'USD')}</TableCell>
                      <TableCell className="font-mono font-semibold">{formatAmount(Math.round(cost), 'USD')}</TableCell>
                      <TableCell>
                        {item.process_step ? <Badge variant="outline">{t(`form.processSteps.${item.process_step}` as any)}</Badge> : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingItemIndex(idx)
                              setItemDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)}>
                            <Trash2 className="text-destructive size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 需求计算 */}
      {items.length > 0 && (
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <h3 className="text-foreground mb-4 font-semibold">{t('demand.title')}</h3>
          <div className="mb-4 flex items-center gap-3">
            <Label>{t('demand.quantity')}</Label>
            <Input type="number" className="w-[120px]" value={demandQty} onChange={e => setDemandQty(e.target.value)} min={1} />
            <span className="text-muted-foreground text-sm">{t('demand.unit')}</span>
            <Button size="sm" onClick={handleCalcDemand} disabled={demandLoading}>
              <Calculator data-icon="inline-start" />
              {t('actions.calcDemand')}
            </Button>
          </div>

          {demandResults.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('demand.materialName')}</TableHead>
                    <TableHead>{t('items.spec')}</TableHead>
                    <TableHead>{t('items.unit')}</TableHead>
                    <TableHead>{t('demand.singleQty')}</TableHead>
                    <TableHead>{t('demand.totalQty')}</TableHead>
                    <TableHead>{t('demand.currentStock')}</TableHead>
                    <TableHead>{t('demand.shortage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demandResults.map(d => (
                    <TableRow key={d.material_id}>
                      <TableCell>
                        <span className="font-medium">{d.material_name}</span>
                        <span className="text-muted-foreground ml-1 text-xs">({d.material_code})</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.material_spec ?? '—'}</TableCell>
                      <TableCell>{d.unit_name ?? '—'}</TableCell>
                      <TableCell className="font-mono">{d.single_qty.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">{d.total_qty.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">{d.current_stock}</TableCell>
                      <TableCell>
                        {d.shortage > 0 ? (
                          <span className="font-mono font-semibold text-red-500">⚠ {d.shortage.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">{t('demand.noShortage')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* 明细编辑弹窗 */}
      <BomItemDialog
        open={itemDialogOpen}
        onOpenChange={open => {
          setItemDialogOpen(open)
          if (!open) setEditingItemIndex(null)
        }}
        editingItem={editingItemIndex !== null ? items[editingItemIndex] : null}
        onSave={handleItemSave}
      />
    </div>
  )
}
