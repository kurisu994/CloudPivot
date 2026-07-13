'use client'

import { ArrowLeft, Calculator, Pencil, Plus, Scissors, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import { invoke, isTauriEnv } from '@/lib/tauri'
import { type BomDetailPageState, type BomDetailResponse, type BomItemPageRow, buildSaveBomArgs, normalizeBomDetail } from './bom-command-args'
import { BomCuttingDialog } from './bom-cutting-dialog'
import { BomItemDialog } from './bom-item-dialog'
import { compareProcessSteps, translateProcessStep } from './process-steps'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

type BomDetail = BomDetailPageState
export type BomItemRow = BomItemPageRow

interface ParentMaterialOption {
  id: number
  code: string
  name: string
  spec: string | null
  materialType: string
}

interface DemandItem {
  materialId: number
  materialCode: string | null
  materialName: string | null
  material_spec: string | null
  unitName: string | null
  single_qty: number
  total_qty: number
  current_stock: number
  shortage: number
}

/* ------------------------------------------------------------------ */
/*  Mock 数据                                                          */
/* ------------------------------------------------------------------ */

const MOCK_PARENT_MATERIALS: ParentMaterialOption[] = [
  { id: 4, code: 'FP-001', name: '实木餐椅', spec: '450×520×880mm', materialType: 'finished' },
  { id: 5, code: 'FP-002', name: '橡木茶几', spec: '1200×600×450mm', materialType: 'finished' },
  { id: 6, code: 'SP-001', name: '餐椅椅架', spec: null, materialType: 'semi' },
]

const MOCK_BOM_DETAIL: BomDetail = {
  id: 1,
  bom_code: 'BOM-20260401-001',
  materialId: 4,
  materialCode: 'FP-001',
  materialName: '实木餐椅',
  material_spec: '450×520×880mm',
  version: 'V2.0',
  status: 'active',
  effective_date: '2026-03-15',
  total_standard_cost: 4500,
  remark: null,
  container_qty: 95,
  items: [
    {
      child_material_id: 1,
      materialCode: 'M-0001',
      materialName: '白橡实木板',
      materialNameVi: 'Gỗ sồi trắng',
      material_spec: '2440×1220',
      unitName: '张',
      ref_cost_price: 28000,
      standard_qty: 2.5,
      wastage_rate: 5,
      actual_qty: 2.625,
      process_step: 'sewing',
      is_key_part: true,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 1,
      cutting_details: [],
    },
    {
      child_material_id: 7,
      materialCode: 'M-0007',
      materialName: '木方',
      materialNameVi: 'Thanh gỗ',
      material_spec: '40×40',
      unitName: '根',
      ref_cost_price: 1200,
      standard_qty: 4,
      wastage_rate: 3,
      actual_qty: 4.12,
      process_step: 'woodworking',
      is_key_part: false,
      substitute_id: null,
      substitute_name: null,
      remark: null,
      sort_order: 2,
      cutting_details: [
        { part_name: '背耳', length_mm: 110, width_mm: 30, height_mm: 20, qty: 12, spec: null, remark: null, sort_order: 1 },
        { part_name: '座框', length_mm: 420, width_mm: 40, height_mm: 40, qty: 4, spec: null, remark: null, sort_order: 2 },
      ],
    },
    {
      child_material_id: 8,
      materialCode: 'M-0008',
      materialName: '不锈钢腿',
      materialNameVi: 'Chân inox',
      material_spec: '710mm',
      unitName: '个',
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
      cutting_details: [],
    },
    {
      child_material_id: 9,
      materialCode: 'M-0009',
      materialName: '螺丝M6',
      materialNameVi: 'Ốc vít M6',
      material_spec: '30mm',
      unitName: '个',
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
      cutting_details: [],
    },
    {
      child_material_id: 10,
      materialCode: 'M-0010',
      materialName: '木蜡油',
      materialNameVi: 'Dầu sáp gỗ',
      material_spec: null,
      unitName: '千克',
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
      cutting_details: [],
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
  // 计算模式：按生产数量 / 按装柜件数（TC，对标 Excel 整柜用量列）
  const [demandMode, setDemandMode] = useState<'production' | 'container'>('production')
  // 当前结果对应的计算模式（切换下拉不影响已算出的结果表头）
  const [calculatedMode, setCalculatedMode] = useState<'production' | 'container'>('production')
  // 成品每柜件数（物料主数据），切换到 TC 模式时自动带入
  const [containerQty, setContainerQty] = useState<number | null>(null)

  // 开料明细弹窗对应的明细行索引
  const [cuttingItemIndex, setCuttingItemIndex] = useState<number | null>(null)

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

  /** 需求计算模式选项 */
  const demandModeItems = useMemo(
    () => [
      { value: 'production', label: t('demand.mode.production') },
      { value: 'container', label: t('demand.mode.container') },
    ],
    [t],
  )

  /** 提取当前明细中已用到的工序，用于联想 */
  const usedProcessSteps = useMemo(() => {
    const steps = items.map(item => item.process_step).filter((step): step is string => !!step)
    return Array.from(new Set(steps))
  }, [items])

  /** 将 BOM 明细按工序分组，以便在表格中以分组标题行展示 */
  const groupedItems = useMemo(() => {
    const groups: { [step: string]: { item: BomItemRow; originalIndex: number }[] } = {}
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const step = item.process_step || ''
      if (!groups[step]) {
        groups[step] = []
      }
      groups[step].push({ item, originalIndex: index })
    }

    // 按预设顺序对工序排序，未预设的自定义工序排在其后，最后是未分组
    const sortedSteps = Object.keys(groups).sort(compareProcessSteps)

    return sortedSteps.map(step => ({
      step,
      list: groups[step],
    }))
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
      setMaterialId(detail.materialId.toString())
      setVersion(detail.version)
      setEffectiveDate(detail.effective_date ?? '')
      setRemark(detail.remark ?? '')
      setBomCode(detail.bom_code)
      setStatus(detail.status)
      setItems(detail.items)
      setContainerQty(detail.container_qty)
      setLoading(false)
      return
    }
    try {
      const detail = normalizeBomDetail(await invoke<BomDetailResponse>('get_bom_detail', { id: bomId }))
      setMaterialId(detail.materialId.toString())
      setVersion(detail.version)
      setEffectiveDate(detail.effective_date ?? '')
      setRemark(detail.remark ?? '')
      setBomCode(detail.bom_code)
      setStatus(detail.status)
      setItems(detail.items)
      setContainerQty(detail.container_qty)
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.loadFailed')))
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
    const args = buildSaveBomArgs({ bomId, materialId, version, effectiveDate, status, isNew, remark, items })

    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 300))
      toast.success(t('notifications.saveBomSuccess'))
      setSaving(false)
      onBack()
      return
    }

    try {
      await invoke('save_bom', args)
      toast.success(t('notifications.saveBomSuccess'))
      onBack()
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.saveBomFailed')))
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

    setCalculatedMode(demandMode)
    setDemandLoading(true)

    if (!isTauriEnv() || !bomId) {
      // 本地计算
      await new Promise(r => setTimeout(r, 200))
      const results: DemandItem[] = items.map(item => {
        const singleQty = item.standard_qty * (1 + item.wastage_rate / 100)
        const totalQty = singleQty * qty
        const currentStock = 100 // mock
        return {
          materialId: item.child_material_id,
          materialCode: item.materialCode,
          materialName: item.materialName,
          material_spec: item.material_spec,
          unitName: item.unitName,
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
      toast.error(getErrorMessage(e, t('notifications.loadFailed')))
    } finally {
      setDemandLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground">{t('loading')}</span>
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
            <Label>{t('detail.standardCost')}</Label>
            <div className="text-foreground flex h-9 items-center rounded-md border px-3 font-mono text-lg font-semibold">
              {formatAmount(Math.round(totalStandardCost), 'USD')}
            </div>
          </div>
          <div className="col-span-2 grid gap-2 lg:col-span-4">
            <Label>{t('form.remark')}</Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('form.remarkPlaceholder')} />
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
          <Table className="min-w-[68.75rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[2.5rem]">#</TableHead>
                <TableHead className="w-[10rem]">{t('items.materialName')}</TableHead>
                <TableHead className="w-[6.25rem]">{t('items.spec')}</TableHead>
                <TableHead className="w-[3.75rem]">{t('items.unit')}</TableHead>
                <TableHead className="w-[5.625rem]">{t('items.standardQty')}</TableHead>
                <TableHead className="w-[5.625rem]">{t('items.wastageRate')}</TableHead>
                <TableHead className="w-[5.625rem]">{t('items.actualQty')}</TableHead>
                <TableHead className="w-[6.25rem]">{t('items.unitPrice')}</TableHead>
                <TableHead className="w-[6.25rem]">{t('items.cost')}</TableHead>
                <TableHead className="w-[5rem]">{t('items.processStep')}</TableHead>
                <TableHead className="w-[5rem]">{t('items.actions')}</TableHead>
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
                groupedItems.map(({ step, list }) => {
                  const stepLabel = step ? translateProcessStep(step, t) : t('items.ungrouped')
                  const countLabel = t('items.groupCount', { count: list.length })

                  return (
                    <Fragment key={step}>
                      {/* 分组标题行 */}
                      <TableRow className="bg-muted/40 hover:bg-muted/40 font-medium">
                        <TableCell colSpan={11} className="py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                              {stepLabel}
                            </Badge>
                            <span className="text-muted-foreground font-normal">({countLabel})</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* 明细行 */}
                      {list.map(({ item, originalIndex }) => {
                        const actualQty = item.standard_qty * (1 + item.wastage_rate / 100)
                        const cost = (item.ref_cost_price ?? 0) * actualQty
                        return (
                          <TableRow key={`${item.child_material_id}-${originalIndex}`} className="group">
                            <TableCell className="text-muted-foreground">{originalIndex + 1}</TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {item.materialName}
                                  {item.materialNameVi && (
                                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">({item.materialNameVi})</span>
                                  )}
                                </div>
                                <div className="text-muted-foreground truncate text-xs">{item.materialCode}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground truncate">{item.material_spec ?? '—'}</TableCell>
                            <TableCell>{item.unitName ?? '—'}</TableCell>
                            <TableCell className="font-mono">{item.standard_qty}</TableCell>
                            <TableCell className="font-mono">{item.wastage_rate}%</TableCell>
                            <TableCell className="font-mono">{actualQty.toFixed(2)}</TableCell>
                            <TableCell className="font-mono">{formatAmount(item.ref_cost_price ?? 0, 'USD')}</TableCell>
                            <TableCell className="font-mono font-semibold">{formatAmount(Math.round(cost), 'USD')}</TableCell>
                            <TableCell>
                              {item.process_step ? <Badge variant="outline">{translateProcessStep(item.process_step, t)}</Badge> : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingItemIndex(originalIndex)
                                    setItemDialogOpen(true)
                                  }}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCuttingItemIndex(originalIndex)}
                                  title={t('cutting.title')}
                                  className="relative"
                                >
                                  <Scissors className="size-3.5" />
                                  {item.cutting_details.length > 0 && (
                                    <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[0.5625rem] leading-none">
                                      {item.cutting_details.length}
                                    </span>
                                  )}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(originalIndex)}>
                                  <Trash2 className="text-destructive size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </Fragment>
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
            {/* 计算模式：按生产数量 / 按装柜件数（TC），切到 TC 时自动带入物料主数据的每柜件数 */}
            <Select
              value={demandMode}
              onValueChange={v => {
                const mode = v === 'container' ? 'container' : 'production'
                setDemandMode(mode)
                if (mode === 'container' && containerQty) {
                  setDemandQty(String(containerQty))
                }
              }}
              items={demandModeItems}
            >
              <SelectTrigger className="w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {demandModeItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" className="w-[7.5rem]" value={demandQty} onChange={e => setDemandQty(e.target.value)} min={1} />
            <span className="text-muted-foreground text-sm">{demandMode === 'container' ? t('demand.unitContainer') : t('demand.unit')}</span>
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
                    <TableHead>{calculatedMode === 'container' ? t('demand.totalQtyTc') : t('demand.totalQty')}</TableHead>
                    <TableHead>{t('demand.currentStock')}</TableHead>
                    <TableHead>{t('demand.shortage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demandResults.map(d => (
                    <TableRow key={d.materialId}>
                      <TableCell>
                        <span className="font-medium">{d.materialName}</span>
                        <span className="text-muted-foreground ml-1 text-xs">({d.materialCode})</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.material_spec ?? '—'}</TableCell>
                      <TableCell>{d.unitName ?? '—'}</TableCell>
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
        usedProcessSteps={usedProcessSteps}
      />

      {/* 开料明细弹窗 */}
      <BomCuttingDialog
        open={cuttingItemIndex !== null}
        onOpenChange={open => {
          if (!open) setCuttingItemIndex(null)
        }}
        materialLabel={cuttingItemIndex !== null ? (items[cuttingItemIndex]?.materialName ?? '') : ''}
        details={cuttingItemIndex !== null ? (items[cuttingItemIndex]?.cutting_details ?? []) : []}
        onSave={details => {
          if (cuttingItemIndex === null) return
          setItems(prev => prev.map((row, i) => (i === cuttingItemIndex ? { ...row, cutting_details: details } : row)))
          setCuttingItemIndex(null)
        }}
      />
    </div>
  )
}
