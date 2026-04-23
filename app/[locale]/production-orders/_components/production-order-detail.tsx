'use client'

import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BusinessListTableEmptyRow, BusinessListTableShell } from '@/components/common/business-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatAmount } from '@/lib/currency'
import { invoke } from '@/lib/tauri'

// ================================================================
// 类型定义
// ================================================================

interface ProductionMaterialItem {
  id: number
  material_id: number
  material_name: string
  material_code: string | null
  required_qty: number
  picked_qty: number
  returned_qty: number
  unit_name: string | null
  warehouse_id: number | null
}

interface ProductionCompletionItem {
  id: number
  completion_no: string
  quantity: number
  warehouse_id: number
  warehouse_name: string | null
  unit_cost: number
  remark: string | null
  completed_at: string | null
}

interface ProductionOrderDetail {
  id: number
  order_no: string
  bom_id: number
  bom_name: string
  custom_order_id: number | null
  custom_order_no: string | null
  output_material_id: number
  output_material_name: string
  planned_qty: number
  completed_qty: number
  status: string
  planned_start_date: string | null
  planned_end_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  remark: string | null
  created_at: string | null
  materials: ProductionMaterialItem[]
  completions: ProductionCompletionItem[]
}

interface BomOption {
  id: number
  parent_material_name: string
  version: string
}

interface WarehouseOption {
  id: number
  name: string
}

interface Props {
  orderId: number | null
  onBack: () => void
}

/** 状态 → Badge variant 映射 */
function getStatusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'outline', label: t('statusOptions.draft') },
    picking: { variant: 'secondary', label: t('statusOptions.picking') },
    producing: { variant: 'default', label: t('statusOptions.producing') },
    completed: { variant: 'default', label: t('statusOptions.completed') },
    cancelled: { variant: 'destructive', label: t('statusOptions.cancelled') },
  }
  const info = map[status] ?? { variant: 'outline' as const, label: status }
  return <Badge variant={info.variant}>{info.label}</Badge>
}

/** 领料状态 */
function getPickStatus(mat: ProductionMaterialItem, t: (key: string) => string) {
  const net = mat.picked_qty - mat.returned_qty
  if (net <= 0) return <Badge variant="outline">{t('picking.statusNone')}</Badge>
  if (net >= mat.required_qty) return <Badge variant="default">{t('picking.statusFull')}</Badge>
  return <Badge variant="secondary">{t('picking.statusPartial')}</Badge>
}

/**
 * 生产工单详情/执行页
 *
 * 新建模式：展示 BOM 选择 + 基本信息填写
 * 查看/执行模式：基本信息 + 领料清单 + 完工记录 + 操作按钮
 */
export function ProductionOrderDetailPage({ orderId, onBack }: Props) {
  const t = useTranslations('productionOrders')
  const tc = useTranslations('common')

  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // 新建/编辑模式的表单状态
  const [isCreateMode] = useState(orderId === null)
  const [bomList, setBomList] = useState<BomOption[]>([])
  const [warehouseList, setWarehouseList] = useState<WarehouseOption[]>([])
  const [formBomId, setFormBomId] = useState<string>('')
  const [formPlannedQty, setFormPlannedQty] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formRemark, setFormRemark] = useState('')
  const [saving, setSaving] = useState(false)

  // 弹窗状态
  const [pickDialogOpen, setPickDialogOpen] = useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [selectedMat, setSelectedMat] = useState<ProductionMaterialItem | null>(null)
  const [dialogQty, setDialogQty] = useState('')
  const [dialogWarehouseId, setDialogWarehouseId] = useState<string>('')
  const [dialogSubmitting, setDialogSubmitting] = useState(false)

  /** 加载工单详情 */
  const loadDetail = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const data = await invoke<ProductionOrderDetail>('get_production_order_detail', { id: orderId })
      setDetail(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  /** 加载 BOM 列表和仓库列表 */
  const loadOptions = useCallback(async () => {
    try {
      const [bomResult, whResult] = await Promise.all([
        invoke<{ items: BomOption[] }>('get_bom_list', {
          filter: { keyword: null, status: 'active', page: 1, page_size: 200 },
        }),
        invoke<WarehouseOption[]>('get_warehouses'),
      ])
      setBomList(bomResult.items)
      setWarehouseList(whResult)
    } catch {
      // 静默处理
    }
  }, [])

  useEffect(() => {
    if (orderId) {
      loadDetail()
    }
    loadOptions()
  }, [orderId, loadDetail, loadOptions])

  // 编辑模式回填
  useEffect(() => {
    if (detail && detail.status === 'draft') {
      setFormBomId(String(detail.bom_id))
      setFormPlannedQty(String(detail.planned_qty))
      setFormStartDate(detail.planned_start_date ?? '')
      setFormEndDate(detail.planned_end_date ?? '')
      setFormRemark(detail.remark ?? '')
    }
  }, [detail])

  // ================================================================
  // 保存工单
  // ================================================================
  const handleSave = async () => {
    if (!formBomId || !formPlannedQty) {
      toast.error(tc('fillRequiredBlock'))
      return
    }
    setSaving(true)
    try {
      await invoke('save_production_order', {
        input: {
          id: orderId,
          bom_id: Number(formBomId),
          custom_order_id: null,
          planned_qty: Number(formPlannedQty),
          planned_start_date: formStartDate || null,
          planned_end_date: formEndDate || null,
          remark: formRemark || null,
        },
      })
      toast.success(orderId ? t('toast.updateSuccess') : t('toast.createSuccess'))
      onBack()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ================================================================
  // 领料出库
  // ================================================================
  const handlePickConfirm = async () => {
    if (!selectedMat || !dialogQty || !dialogWarehouseId) return
    setDialogSubmitting(true)
    try {
      await invoke('pick_materials', {
        input: {
          production_order_id: orderId,
          items: [
            {
              material_id: selectedMat.material_id,
              quantity: Number(dialogQty),
              warehouse_id: Number(dialogWarehouseId),
            },
          ],
        },
      })
      toast.success(t('toast.pickSuccess'))
      setPickDialogOpen(false)
      loadDetail()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setDialogSubmitting(false)
    }
  }

  // ================================================================
  // 退料入库
  // ================================================================
  const handleReturnConfirm = async () => {
    if (!selectedMat || !dialogQty || !dialogWarehouseId) return
    setDialogSubmitting(true)
    try {
      await invoke('return_materials', {
        input: {
          production_order_id: orderId,
          items: [
            {
              material_id: selectedMat.material_id,
              quantity: Number(dialogQty),
              warehouse_id: Number(dialogWarehouseId),
            },
          ],
        },
      })
      toast.success(t('toast.returnSuccess'))
      setReturnDialogOpen(false)
      loadDetail()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setDialogSubmitting(false)
    }
  }

  // ================================================================
  // 完工入库
  // ================================================================
  const handleCompleteConfirm = async () => {
    if (!dialogQty || !dialogWarehouseId) return
    setDialogSubmitting(true)
    try {
      await invoke('complete_production', {
        input: {
          production_order_id: orderId,
          quantity: Number(dialogQty),
          warehouse_id: Number(dialogWarehouseId),
          remark: null,
        },
      })
      toast.success(t('toast.completeSuccess'))
      setCompleteDialogOpen(false)
      loadDetail()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setDialogSubmitting(false)
    }
  }

  // ================================================================
  // 状态操作
  // ================================================================
  const handleStartProduction = async () => {
    try {
      await invoke('start_production', { id: orderId })
      toast.success(t('toast.startSuccess'))
      loadDetail()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }

  const handleFinishOrder = async () => {
    try {
      await invoke('finish_production_order', { id: orderId })
      toast.success(t('toast.finishSuccess'))
      loadDetail()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }

  const handleCancelOrder = async () => {
    try {
      await invoke('cancel_production_order', { id: orderId })
      toast.success(t('toast.cancelSuccess'))
      loadDetail()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }

  /** 打开领料弹窗 */
  const openPickDialog = (mat: ProductionMaterialItem) => {
    setSelectedMat(mat)
    setDialogQty('')
    setDialogWarehouseId(mat.warehouse_id ? String(mat.warehouse_id) : '')
    setPickDialogOpen(true)
  }

  /** 打开退料弹窗 */
  const openReturnDialog = (mat: ProductionMaterialItem) => {
    setSelectedMat(mat)
    setDialogQty('')
    setDialogWarehouseId(mat.warehouse_id ? String(mat.warehouse_id) : '')
    setReturnDialogOpen(true)
  }

  /** 仓库选项列表 */
  const warehouseItems = warehouseList.map(w => ({
    value: String(w.id),
    label: w.name,
  }))

  // ================================================================
  // 新建/编辑模式渲染
  // ================================================================
  if (isCreateMode || (detail && detail.status === 'draft')) {
    const bomItems = bomList.map(b => ({
      value: String(b.id),
      label: `${b.parent_material_name} (${b.version})`,
    }))

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('backToList')}
          </Button>
          <h1 className="text-xl font-bold">{isCreateMode ? t('createOrder') : t('editOrder')}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('relatedBom')} *</Label>
              <Select value={formBomId} onValueChange={(v: string | null) => setFormBomId(v ?? '')} items={bomItems}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dialog.selectBom')} />
                </SelectTrigger>
                <SelectContent>
                  {bomItems.map(b => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('plannedQty')} *</Label>
              <Input
                type="number"
                value={formPlannedQty}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormPlannedQty(e.target.value)}
                placeholder={t('dialog.inputPlannedQty')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('plannedStartDate')}</Label>
              <Input type="date" value={formStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('plannedEndDate')}</Label>
              <Input type="date" value={formEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEndDate(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>{t('remark')}</Label>
              <Input value={formRemark} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormRemark(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onBack}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </div>
    )
  }

  // ================================================================
  // 详情/执行模式渲染
  // ================================================================
  if (loading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const isTerminal = detail.status === 'completed' || detail.status === 'cancelled'
  const canPick = detail.status === 'draft' || detail.status === 'picking'
  const canReturn = detail.status === 'picking' || detail.status === 'producing'
  const canStart = detail.status === 'picking'
  const canComplete = detail.status === 'producing'
  const canFinish = detail.status === 'producing' && detail.completed_qty > 0
  const canCancel = !isTerminal

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('backToList')}
          </Button>
          <h1 className="text-xl font-bold">{detail.order_no}</h1>
          {getStatusBadge(detail.status, t)}
        </div>
      </div>

      {/* 基本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
            <div>
              <span className="text-muted-foreground">{t('orderNo')}:</span> <span className="font-medium">{detail.order_no}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('relatedBom')}:</span> <span className="font-medium">{detail.bom_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('outputMaterial')}:</span> <span className="font-medium">{detail.output_material_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('plannedQty')}:</span> <span className="font-medium">{detail.planned_qty}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('completedQty')}:</span>{' '}
              <span className="font-medium">
                {detail.completed_qty} / {detail.planned_qty}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('relatedCustomOrder')}:</span>{' '}
              <span className="font-medium">{detail.custom_order_no ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('plannedStartDate')}:</span> <span>{detail.planned_start_date ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('plannedEndDate')}:</span> <span>{detail.planned_end_date ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('actualStartDate')}:</span> <span>{detail.actual_start_date ?? '—'}</span>
            </div>
            {detail.actual_end_date && (
              <div>
                <span className="text-muted-foreground">{t('actualEndDate')}:</span> <span>{detail.actual_end_date}</span>
              </div>
            )}
            {detail.remark && (
              <div className="col-span-full">
                <span className="text-muted-foreground">{t('remark')}:</span> <span>{detail.remark}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 领料清单 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('picking.title')}</CardTitle>
          <div className="flex gap-2">
            {canPick && (
              <Button size="sm" disabled={detail.materials.length === 0}>
                {t('picking.pickMaterial')}
              </Button>
            )}
            {canReturn && (
              <Button size="sm" variant="outline">
                {t('picking.returnMaterial')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <BusinessListTableShell tableClassName="min-w-[700px]">
            <thead>
              <tr className="border-b">
                <th className="bg-background sticky left-0 z-10 w-[140px] px-3 py-2 text-left text-xs font-medium">{t('picking.materialName')}</th>
                <th className="w-[80px] px-3 py-2 text-right text-xs font-medium">{t('picking.requiredQty')}</th>
                <th className="w-[80px] px-3 py-2 text-right text-xs font-medium">{t('picking.pickedQty')}</th>
                <th className="w-[80px] px-3 py-2 text-right text-xs font-medium">{t('picking.returnedQty')}</th>
                <th className="w-[80px] px-3 py-2 text-right text-xs font-medium">{t('picking.netPicked')}</th>
                <th className="w-[60px] px-3 py-2 text-center text-xs font-medium">{t('picking.unit')}</th>
                <th className="w-[70px] px-3 py-2 text-center text-xs font-medium">{t('picking.pickStatus')}</th>
                {!isTerminal && <th className="w-[100px] px-3 py-2 text-right text-xs font-medium">{t('actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {detail.materials.length === 0 ? (
                <BusinessListTableEmptyRow colSpan={isTerminal ? 7 : 8} message={t('noMaterials')} />
              ) : (
                detail.materials.map(mat => (
                  <tr key={mat.id} className="hover:bg-muted/50 border-b transition-colors">
                    <td className="bg-background sticky left-0 z-10 px-3 py-2 text-sm">
                      <div className="font-medium">{mat.material_name}</div>
                      {mat.material_code && <div className="text-muted-foreground text-xs">{mat.material_code}</div>}
                    </td>
                    <td className="px-3 py-2 text-right text-sm">{mat.required_qty}</td>
                    <td className="px-3 py-2 text-right text-sm">{mat.picked_qty}</td>
                    <td className="px-3 py-2 text-right text-sm">{mat.returned_qty}</td>
                    <td className="px-3 py-2 text-right text-sm font-medium">{(mat.picked_qty - mat.returned_qty).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-sm">{mat.unit_name ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-sm">{getPickStatus(mat, t)}</td>
                    {!isTerminal && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canPick && (
                            <Button variant="ghost" size="sm" onClick={() => openPickDialog(mat)}>
                              {t('picking.pickMaterial')}
                            </Button>
                          )}
                          {canReturn && mat.picked_qty - mat.returned_qty > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => openReturnDialog(mat)}>
                              {t('picking.returnMaterial')}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </BusinessListTableShell>
        </CardContent>
      </Card>

      {/* 完工记录 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('completion.title')}</CardTitle>
          {canComplete && (
            <Button
              size="sm"
              onClick={() => {
                setDialogQty('')
                setDialogWarehouseId('')
                setCompleteDialogOpen(true)
              }}
            >
              {t('completion.completeProduction')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <BusinessListTableShell tableClassName="min-w-[600px]">
            <thead>
              <tr className="border-b">
                <th className="w-[100px] px-3 py-2 text-left text-xs font-medium">{t('completion.batchNo')}</th>
                <th className="w-[100px] px-3 py-2 text-right text-xs font-medium">{t('completion.quantity')}</th>
                <th className="w-[120px] px-3 py-2 text-left text-xs font-medium">{t('completion.warehouse')}</th>
                <th className="w-[120px] px-3 py-2 text-right text-xs font-medium">{t('completion.unitCost')}</th>
                <th className="w-[120px] px-3 py-2 text-left text-xs font-medium">{t('completion.date')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.completions.length === 0 ? (
                <BusinessListTableEmptyRow colSpan={5} message={t('noCompletions')} />
              ) : (
                <>
                  {detail.completions.map(comp => (
                    <tr key={comp.id} className="hover:bg-muted/50 border-b transition-colors">
                      <td className="px-3 py-2 text-sm">{comp.completion_no}</td>
                      <td className="px-3 py-2 text-right text-sm">{comp.quantity}</td>
                      <td className="px-3 py-2 text-sm">{comp.warehouse_name ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-sm">{formatAmount(comp.unit_cost, 'VND')}</td>
                      <td className="px-3 py-2 text-sm">{comp.completed_at ?? '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-medium">
                    <td className="px-3 py-2 text-sm">{t('completion.total')}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {detail.completions.reduce((sum, c) => sum + c.quantity, 0)} / {detail.planned_qty}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </>
              )}
            </tbody>
          </BusinessListTableShell>
        </CardContent>
      </Card>

      {/* 操作按钮区 */}
      {!isTerminal && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-3">
            {canStart && <Button onClick={handleStartProduction}>{t('production.startProduction')}</Button>}
            {canFinish && <Button onClick={handleFinishOrder}>{t('production.finishOrder')}</Button>}
            {canCancel && (
              <Button variant="destructive" onClick={handleCancelOrder}>
                {t('production.cancelOrder')}
              </Button>
            )}
          </div>
        </>
      )}

      {/* 领料弹窗 */}
      <Dialog open={pickDialogOpen} onOpenChange={setPickDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('picking.pickMaterial')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t('picking.materialName')}</Label>
              <div className="text-sm font-medium">{selectedMat?.material_name}</div>
            </div>
            <div className="space-y-2">
              <Label>{t('picking.pickQuantity')}</Label>
              <Input type="number" value={dialogQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDialogQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('picking.warehouse')}</Label>
              <Select value={dialogWarehouseId} onValueChange={(v: string | null) => setDialogWarehouseId(v ?? '')} items={warehouseItems}>
                <SelectTrigger>
                  <SelectValue placeholder={t('picking.selectWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouseItems.map(w => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handlePickConfirm} disabled={dialogSubmitting || !dialogQty || !dialogWarehouseId}>
              {dialogSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('picking.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退料弹窗 */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('picking.returnMaterial')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t('picking.materialName')}</Label>
              <div className="text-sm font-medium">{selectedMat?.material_name}</div>
            </div>
            <div className="space-y-2">
              <Label>{t('picking.returnQuantity')}</Label>
              <Input type="number" value={dialogQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDialogQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('picking.warehouse')}</Label>
              <Select value={dialogWarehouseId} onValueChange={(v: string | null) => setDialogWarehouseId(v ?? '')} items={warehouseItems}>
                <SelectTrigger>
                  <SelectValue placeholder={t('picking.selectWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouseItems.map(w => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleReturnConfirm} disabled={dialogSubmitting || !dialogQty || !dialogWarehouseId}>
              {dialogSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('picking.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完工入库弹窗 */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('completion.completeProduction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('completion.quantity')}</Label>
              <Input
                type="number"
                value={dialogQty}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDialogQty(e.target.value)}
                placeholder={t('completion.inputQuantity')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('completion.warehouse')}</Label>
              <Select value={dialogWarehouseId} onValueChange={(v: string | null) => setDialogWarehouseId(v ?? '')} items={warehouseItems}>
                <SelectTrigger>
                  <SelectValue placeholder={t('completion.selectWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouseItems.map(w => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCompleteConfirm} disabled={dialogSubmitting || !dialogQty || !dialogWarehouseId}>
              {dialogSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('picking.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
