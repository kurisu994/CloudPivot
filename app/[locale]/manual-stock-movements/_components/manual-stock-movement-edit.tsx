'use client'

import { AlertTriangle, ArrowLeft, CheckSquare, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount, toDisplayAmount, toStorageAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { ManualMovementItemData, MaterialReferenceOption, SaveManualMovementItemParams, WarehouseItem } from '@/lib/tauri'
import {
  confirmManualStockMovement,
  getManualStockMovementDetail,
  getMaterialReferenceOptions,
  getWarehouses,
  saveManualStockMovement,
} from '@/lib/tauri'

// 业务类型常量
const INBOUND_TYPES = ['manual_purchase_in', 'borrowed_material_in', 'lent_material_return_in', 'adjustment_in', 'other_in']

const OUTBOUND_TYPES = [
  'manual_production_out',
  'borrowed_material_return_out',
  'lent_material_out',
  'scrap_out',
  'sample_out',
  'adjustment_out',
  'other_out',
]

// 借料类类型（往来对象必填）
const COUNTERPARTY_REQUIRED_TYPES = ['borrowed_material_in', 'lent_material_return_in', 'borrowed_material_return_out', 'lent_material_out']

// 备注必填类型（备注必填）
const REMARK_REQUIRED_TYPES = ['other_in', 'other_out']

interface ManualStockMovementEditProps {
  movementId?: number
  onBack: () => void
}

export function ManualStockMovementEdit({ movementId, onBack }: ManualStockMovementEditProps) {
  const t = useTranslations()
  const tc = useTranslations('common')

  // 1. 单头状态
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [businessType, setBusinessType] = useState<string>('manual_purchase_in')
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [movementDate, setMovementDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [counterpartyName, setCounterpartyName] = useState<string>('')
  const [remark, setRemark] = useState<string>('')
  const [status, setStatus] = useState<'draft' | 'confirmed'>('draft')
  const [movementNo, setMovementNo] = useState<string>('')
  const [createdByName, setCreatedByName] = useState<string>('')
  const [confirmedByName, setConfirmedByName] = useState<string>('')
  const [confirmedAt, setConfirmedAt] = useState<string>('')

  // 2. 明细列表状态
  const [items, setItems] = useState<ManualMovementItemData[]>([])

  // 3. 快速添加明细状态
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [addQty, setAddQty] = useState<string>('1')
  const [addUnitCost, setAddUnitCost] = useState<string>('0')
  const [addLotNo, setAddLotNo] = useState<string>('')
  const [addSupplierBatchNo, setAddSupplierBatchNo] = useState<string>('')

  // 4. 字典数据
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [materials, setMaterials] = useState<MaterialReferenceOption[]>([])

  // 5. 控制类 UI 状态
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [tempDirection, setTempDirection] = useState<'in' | 'out' | null>(null)
  const [switchDirectionDialogOpen, setSwitchDirectionDialogOpen] = useState(false)

  // 6. 风控过账确认二次弹窗状态
  const [confirmRiskDialogOpen, setConfirmRiskDialogOpen] = useState(false)
  const [riskType, setRiskType] = useState<'qty' | 'amount' | 'both' | null>(null)
  const [riskQty, setRiskQty] = useState(0)
  const [riskAmount, setRiskAmount] = useState(0)

  // 7. 库存不足预检弹窗状态
  const [insufficientItems, setInsufficientItems] = useState<
    {
      sortOrder: number
      materialId: number
      materialCode: string
      materialName: string
      requiredQty: number
      availableQty: number
      unitName: string
    }[]
  >([])
  const [insufficientDialogOpen, setInsufficientDialogOpen] = useState(false)

  const isReadOnly = status === 'confirmed'
  const isInbound = direction === 'in'

  // 加载字典数据和已有详情
  useEffect(() => {
    const loadData = async () => {
      try {
        const [warehouseItems, materialItems] = await Promise.all([getWarehouses(false), getMaterialReferenceOptions()])
        setWarehouses(warehouseItems)
        setMaterials(materialItems)

        // 若为编辑，加载单据详情
        if (movementId) {
          const detail = await getManualStockMovementDetail(movementId)
          setDirection(detail.direction)
          setBusinessType(detail.businessType)
          setWarehouseId(String(detail.warehouseId))
          setMovementDate(detail.movementDate)
          setCounterpartyName(detail.counterpartyName || '')
          setRemark(detail.remark || '')
          setStatus(detail.status)
          setMovementNo(detail.movementNo)
          setCreatedByName(detail.createdByName || '')
          setConfirmedByName(detail.confirmedByName || '')
          setConfirmedAt(detail.confirmedAt || '')

          // 对入库明细将 cents 转化为 USD 元进行显示
          const formattedItems = detail.items.map(item => ({
            ...item,
            unitCostUsd: item.unitCostUsd !== null && item.unitCostUsd !== undefined ? toDisplayAmount(item.unitCostUsd, 'USD') : null,
          }))
          setItems(formattedItems)
        }
      } catch (err) {
        toast.error(getErrorMessage(err, t('manualStockMovements.loadFailed')))
      }
    }
    loadData()
  }, [movementId, t])

  // 处理方向切换的确认逻辑
  const handleDirectionChange = (newDir: 'in' | 'out') => {
    if (newDir === direction) return
    if (items.length > 0) {
      setTempDirection(newDir)
      setSwitchDirectionDialogOpen(true)
    } else {
      executeDirectionChange(newDir)
    }
  }

  const executeDirectionChange = (newDir: 'in' | 'out') => {
    setDirection(newDir)
    setItems([])
    // 切换业务默认值
    setBusinessType(newDir === 'in' ? 'manual_purchase_in' : 'manual_production_out')
    setTempDirection(null)
    setSwitchDirectionDialogOpen(false)

    // 重置快速添加字段
    setAddQty('1')
    setAddUnitCost('0')
    setAddLotNo('')
    setAddSupplierBatchNo('')
  }

  // 往来对象与备注必填性探测
  const isCounterpartyRequired = COUNTERPARTY_REQUIRED_TYPES.includes(businessType)
  const isRemarkRequired = REMARK_REQUIRED_TYPES.includes(businessType)

  // 切换业务类型：新类型非借料类时自动清空往来对象（设计 §10.3）
  const handleBusinessTypeChange = (val: string) => {
    setBusinessType(val)
    if (!COUNTERPARTY_REQUIRED_TYPES.includes(val)) {
      setCounterpartyName('')
    }
  }

  // 物料候选项：编码 + 名称 + 规格拼入 label，供可搜索下拉按文本即时过滤
  const materialOptions = useMemo(() => {
    return materials.map(m => {
      const spec = m.spec ? ` / ${m.spec}` : ''
      const unit = m.unitName ? ` (${m.unitName})` : ''
      return {
        value: String(m.id),
        label: m.code ? `${m.code} - ${m.name}${spec}${unit}` : `${m.name}${spec}${unit}`,
      }
    })
  }, [materials])

  // 选择快速添加物料时的事件
  const handleMaterialSelect = (matId: string) => {
    setSelectedMaterialId(matId)
  }

  // 获取业务类型翻译标签
  const getBusinessTypeLabel = (type: string) => {
    return t(
      `manualStockMovements.type${type
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')}`,
    )
  }

  // 1. 明细行合并并加入明细
  const handleAddItem = () => {
    if (!selectedMaterialId) {
      toast.error(t('manualStockMovements.selectMaterial'))
      return
    }
    const qty = Number(addQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('manualStockMovements.quantityInvalid'))
      return
    }

    const material = materials.find(m => String(m.id) === selectedMaterialId)
    if (!material) return

    const costVal = Number(addUnitCost)
    if (isInbound && (isNaN(costVal) || costVal < 0)) {
      toast.error(t('manualStockMovements.unitCostInvalid'))
      return
    }

    if (items.length >= 100) {
      toast.error(t('manualStockMovements.maxItemsExceeded'))
      return
    }

    const targetLotNo = addLotNo.trim() || null
    const targetSupplierBatchNo = addSupplierBatchNo.trim() || null
    const inputCost = isInbound ? costVal : null

    // 检查重复添加与合并
    let mergedIndex = -1
    if (isInbound) {
      // 入库合并规则：物料 ID、成本单价、批次号、供应商批次都相同，进行合并
      mergedIndex = items.findIndex(
        item =>
          item.materialId === material.id &&
          item.unitCostUsd === inputCost &&
          item.lotNo === targetLotNo &&
          item.supplierBatchNo === targetSupplierBatchNo,
      )
    } else {
      // 出库合并规则：物料 ID 相同就合并
      mergedIndex = items.findIndex(item => item.materialId === material.id)
    }

    if (mergedIndex !== -1) {
      const targetItem = items[mergedIndex]
      const oldQty = targetItem.quantity
      const newQty = oldQty + qty

      const updatedItems = [...items]
      updatedItems[mergedIndex] = {
        ...targetItem,
        quantity: newQty,
      }
      setItems(updatedItems)

      toast.success(
        t('manualStockMovements.mergedToast', {
          name: material.name,
          row: mergedIndex + 1,
          before: oldQty,
          added: qty,
          after: newQty,
        }),
      )
    } else {
      // 新加入明细
      const newItem: ManualMovementItemData = {
        id: null,
        sortOrder: items.length + 1,
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        spec: material.spec,
        unitName: material.unitName,
        quantity: qty,
        unitCostUsd: inputCost,
        lotNo: targetLotNo,
        supplierBatchNo: targetSupplierBatchNo,
      }
      setItems([...items, newItem])
    }

    // 重置快速添加域
    setSelectedMaterialId('')
    setAddQty('1')
    setAddUnitCost('0')
    setAddLotNo('')
    setAddSupplierBatchNo('')
  }

  // 2. 行内字段的修改
  const handleItemFieldChange = (index: number, field: keyof ManualMovementItemData, val: any) => {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      [field]: val,
    }
    setItems(updated)
  }

  // 3. 移除明细
  const handleRemoveItem = (index: number) => {
    const updated = items
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({
        ...item,
        sortOrder: idx + 1,
      }))
    setItems(updated)
  }

  // 4. 汇总信息计算
  const summary = useMemo(() => {
    let totalQty = 0
    let totalAmount = 0
    items.forEach(item => {
      totalQty += item.quantity
      if (isInbound && item.unitCostUsd) {
        totalAmount += item.quantity * item.unitCostUsd
      }
    })
    return {
      rowCount: items.length,
      totalQty,
      totalAmount,
    }
  }, [items, isInbound])

  // 5. 保存草稿底层逻辑
  // silent: 静默保存（确认过账流程内部调用时不提示"草稿已保存"）
  const executeSave = async (options?: { silent?: boolean }): Promise<number | null> => {
    const silent = options?.silent ?? false

    if (!warehouseId) {
      toast.error(t('manualStockMovements.selectWarehouse'))
      return null
    }
    if (!movementDate) {
      toast.error(t('manualStockMovements.selectDate'))
      return null
    }
    if (items.length === 0) {
      toast.error(t('manualStockMovements.noItems'))
      return null
    }

    // 往来对象、备注为「确认前补齐」字段，草稿阶段允许暂缺（设计 §5.1），由后端 confirm 强制校验

    // 明细行校验并转 cents
    const saveItems: SaveManualMovementItemParams[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.quantity <= 0) {
        toast.error(`第 ${i + 1} 行：${t('manualStockMovements.quantityInvalid')}`)
        return null
      }
      if (isInbound) {
        const cost = Number(item.unitCostUsd)
        if (isNaN(cost) || cost < 0) {
          toast.error(`第 ${i + 1} 行：${t('manualStockMovements.unitCostInvalid')}`)
          return null
        }
      }
      saveItems.push({
        materialId: item.materialId,
        sortOrder: item.sortOrder,
        quantity: item.quantity,
        // 对入库明细价格转化为 cents 存储于后端数据库
        unitCostUsd: isInbound && item.unitCostUsd !== null ? toStorageAmount(Number(item.unitCostUsd), 'USD') : null,
        lotNo: item.lotNo || undefined,
        supplierBatchNo: item.supplierBatchNo || undefined,
      })
    }

    setSaving(true)
    try {
      const savedId = await saveManualStockMovement({
        id: movementId || null,
        direction,
        businessType,
        warehouseId: Number(warehouseId),
        movementDate,
        counterpartyName: counterpartyName.trim() || null,
        remark: remark.trim() || null,
        items: saveItems,
      })

      if (!silent) {
        toast.success(
          t('manualStockMovements.draftSaved', {
            movementNo: movementNo || '草稿',
          }),
        )
      }
      return savedId
    } catch (err) {
      toast.error(getErrorMessage(err, t('manualStockMovements.saveFailed')))
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    const savedId = await executeSave()
    if (savedId) {
      onBack()
    }
  }

  // 6. 确认过账逻辑（包含风控多维拦截）
  const handleConfirmPost = async (riskConfirmed = false) => {
    // A. 必须先保存最新更改（静默，不提示"草稿已保存"）
    const savedId = await executeSave({ silent: true })
    if (!savedId) return

    setPosting(true)
    try {
      const finalNo = await confirmManualStockMovement({
        id: savedId,
        riskConfirmed,
      })
      toast.success(t('manualStockMovements.confirmSuccess', { movementNo: finalNo }))
      setConfirmRiskDialogOpen(false)
      onBack()
    } catch (err: any) {
      const errStr = getErrorMessage(err, '')
      if (errStr.startsWith('INSUFFICIENT_STOCK:')) {
        // 库存不足预检结果：解析 JSON payload 并弹出 Dialog
        try {
          const json = errStr.slice('INSUFFICIENT_STOCK:'.length)
          const items = JSON.parse(json)
          setInsufficientItems(items)
          setInsufficientDialogOpen(true)
        } catch {
          toast.error(getErrorMessage(err, t('manualStockMovements.confirmFailed')))
        }
      } else if (errStr.startsWith('RISK_LIMIT_EXCEEDED:')) {
        // 后端拦截了风控并返回提示：RISK_LIMIT_EXCEEDED:both:qty=1200.0,amount=1500000
        const parts = errStr.split(':')
        const type = parts[1] as 'qty' | 'amount' | 'both'

        let qtyVal = 0
        let amountVal = 0

        const metrics = parts[2].split(',')
        metrics.forEach(m => {
          if (m.startsWith('qty=')) {
            qtyVal = parseFloat(m.replace('qty=', ''))
          } else if (m.startsWith('amount=')) {
            amountVal = parseInt(m.replace('amount=', ''), 10) / 100 // 转为 USD
          }
        })

        setRiskType(type)
        setRiskQty(qtyVal)
        setRiskAmount(amountVal)
        setConfirmRiskDialogOpen(true)
      } else {
        toast.error(getErrorMessage(err, t('manualStockMovements.confirmFailed')))
      }
    } finally {
      setPosting(false)
    }
  }

  // 下拉过滤数组
  const warehouseOptions = warehouses.map(w => ({ value: String(w.id), label: w.name }))
  const businessTypeOptions = (isInbound ? INBOUND_TYPES : OUTBOUND_TYPES).map(type => ({
    value: type,
    label: getBusinessTypeLabel(type),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* 头部面板 */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={saving || posting}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {movementId
              ? isReadOnly
                ? t('manualStockMovements.viewDetail')
                : t('manualStockMovements.editDraft')
              : t('manualStockMovements.newMovement')}
          </h1>
          <p className="text-sm text-muted-foreground">{movementNo ? `${t('manualStockMovements.movementNo')}: ${movementNo}` : '新建出入库草稿'}</p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'confirmed' && (
            <Badge variant="default" className="py-1 px-2.5">
              {t('manualStockMovements.statusConfirmed')}
            </Badge>
          )}
          {status === 'draft' && (
            <Badge variant="outline" className="py-1 px-2.5">
              {t('manualStockMovements.statusDraft')}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {/* 1. 单头表单 */}
          <Card size="sm" className="border-muted bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t('manualStockMovements.headerInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* 方向 */}
              <div className="flex flex-col gap-1.5">
                <Label>{t('manualStockMovements.direction')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={direction === 'in' ? 'default' : 'outline'}
                    onClick={() => handleDirectionChange('in')}
                    disabled={isReadOnly}
                    className="w-full"
                  >
                    {t('manualStockMovements.directionIn')}
                  </Button>
                  <Button
                    type="button"
                    variant={direction === 'out' ? 'default' : 'outline'}
                    onClick={() => handleDirectionChange('out')}
                    disabled={isReadOnly}
                    className="w-full"
                  >
                    {t('manualStockMovements.directionOut')}
                  </Button>
                </div>
              </div>

              {/* 业务类型 */}
              <div className="flex flex-col gap-1.5">
                <Label>{t('manualStockMovements.businessType')}</Label>
                <Select
                  value={businessType}
                  onValueChange={val => handleBusinessTypeChange(val || 'manual_purchase_in')}
                  disabled={isReadOnly}
                  items={businessTypeOptions}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 仓库 */}
              <div className="flex flex-col gap-1.5">
                <Label>{t('manualStockMovements.warehouse')}</Label>
                <Select value={warehouseId} onValueChange={val => setWarehouseId(val || '')} disabled={isReadOnly} items={warehouseOptions}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('manualStockMovements.selectWarehouse')} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 变动日期 */}
              <div className="flex flex-col gap-1.5">
                <Label>{t('manualStockMovements.movementDate')}</Label>
                <DatePicker value={movementDate} onChange={setMovementDate} disabled={isReadOnly} />
              </div>

              {/* 往来对象：仅借料类业务（必填）时显示，其余类型隐藏以压缩表单空间 */}
              {isCounterpartyRequired && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="flex items-center gap-1">
                    {t('manualStockMovements.counterpartyName')}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder={t('manualStockMovements.counterpartyPlaceholder')}
                    value={counterpartyName}
                    onChange={e => setCounterpartyName(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              )}

              {/* 备注 (其他类型必填) */}
              <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-2">
                <Label className="flex items-center gap-1">
                  {t('manualStockMovements.remark')}
                  {isRemarkRequired && <span className="text-red-500">*</span>}
                </Label>
                <textarea
                  placeholder={t('manualStockMovements.remarkPlaceholder')}
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  disabled={isReadOnly}
                  rows={1}
                  className="flex min-h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* 快速添加明细：整合进单据信息卡片，只读时隐藏 */}
              {!isReadOnly && (
                <div className="flex flex-col gap-3 border-t pt-3 sm:col-span-2 xl:col-span-4">
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(12rem,2fr)_minmax(6rem,0.75fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto]">
                    {/* 物料：可搜索下拉，输入编码/名称/规格即时过滤 */}
                    <div className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-1">
                      <Label>{t('manualStockMovements.material')}</Label>
                      <Combobox
                        items={materialOptions}
                        value={selectedMaterialId || null}
                        onValueChange={val => handleMaterialSelect(val || '')}
                        placeholder={t('manualStockMovements.selectMaterial')}
                      />
                    </div>

                    {/* 数量 */}
                    <div className="flex flex-col gap-1.5">
                      <Label>{t('manualStockMovements.quantity')}</Label>
                      <Input type="number" min="0.001" step="any" value={addQty} onChange={e => setAddQty(e.target.value)} />
                    </div>

                    {/* 入库专用：批次号 */}
                    {isInbound && (
                      <div className="flex flex-col gap-1.5">
                        <Label className="flex items-center gap-1">
                          {t('manualStockMovements.lotNo')}
                          <span className="text-xs text-muted-foreground">({t('manualStockMovements.autoLotNo')})</span>
                        </Label>
                        <Input placeholder="选填" value={addLotNo} onChange={e => setAddLotNo(e.target.value)} />
                      </div>
                    )}

                    {/* 入库专用：供应商批次 */}
                    {isInbound && (
                      <div className="flex flex-col gap-1.5">
                        <Label>{t('manualStockMovements.supplierBatchNo')}</Label>
                        <Input placeholder="选填" value={addSupplierBatchNo} onChange={e => setAddSupplierBatchNo(e.target.value)} />
                      </div>
                    )}

                    <div className="flex justify-end sm:col-span-2 md:col-span-3 xl:col-span-1 xl:items-end">
                      <Button type="button" onClick={handleAddItem}>
                        <Plus data-icon="inline-start" />
                        {t('manualStockMovements.addItem')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. 明细展示表格 */}
          <Card className="border-muted bg-card shadow-sm flex-1">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-base font-semibold">{t('manualStockMovements.detailTable')}</CardTitle>
              </div>
              <Badge variant="secondary">{summary.rowCount} / 100 行</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="w-[120px]">{t('manualStockMovements.colMaterialCode')}</TableHead>
                    <TableHead className="w-[180px]">{t('manualStockMovements.colMaterialName')}</TableHead>
                    <TableHead className="w-[100px]">{t('manualStockMovements.colSpec')}</TableHead>
                    <TableHead className="w-[60px]">{t('manualStockMovements.colUnit')}</TableHead>
                    <TableHead className="w-[100px] text-right">{t('manualStockMovements.colQuantity')}</TableHead>
                    {isInbound && <TableHead className="w-[120px]">{t('manualStockMovements.colLotNo')}</TableHead>}
                    {isInbound && <TableHead className="w-[120px]">{t('manualStockMovements.colSupplierBatch')}</TableHead>}
                    {!isReadOnly && <TableHead className="w-[60px] text-center">{tc('actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(isInbound ? 8 : 6) + (isReadOnly ? 0 : 1)} className="h-24 text-center text-muted-foreground">
                        {t('manualStockMovements.noItems')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center text-muted-foreground">{item.sortOrder}</TableCell>
                        <TableCell className="font-semibold">{item.materialCode}</TableCell>
                        <TableCell>{item.materialName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.spec || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{item.unitName || '-'}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantity}
                              onChange={e => handleItemFieldChange(idx, 'quantity', Number(e.target.value))}
                              disabled={isReadOnly}
                              className="h-8 max-w-[100px] py-1 text-right font-medium"
                            />
                          </div>
                        </TableCell>
                        {isInbound && (
                          <TableCell>
                            <Input
                              placeholder="自动生成"
                              value={item.lotNo || ''}
                              onChange={e => handleItemFieldChange(idx, 'lotNo', e.target.value)}
                              disabled={isReadOnly}
                              className="h-8 py-1 max-w-[120px]"
                            />
                          </TableCell>
                        )}
                        {isInbound && (
                          <TableCell>
                            <Input
                              placeholder="选填"
                              value={item.supplierBatchNo || ''}
                              onChange={e => handleItemFieldChange(idx, 'supplierBatchNo', e.target.value)}
                              disabled={isReadOnly}
                              className="h-8 py-1 max-w-[120px]"
                            />
                          </TableCell>
                        )}
                        {!isReadOnly && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 右侧面板 (汇总面板) */}
        <div className="flex flex-col gap-6">
          <Card className="border-muted bg-card shadow-sm sticky top-6">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">{t('manualStockMovements.summary')}</CardTitle>
              <CardDescription>单据数据即时汇总</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* 明细行数 */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('manualStockMovements.itemRows')}</span>
                <span className="font-semibold text-foreground">{summary.rowCount}</span>
              </div>

              {/* 数量合计 */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('manualStockMovements.totalQty')}</span>
                <span className="font-bold text-indigo-600">{summary.totalQty.toFixed(3)}</span>
              </div>

              {/* 入库金额合计 */}
              {isInbound && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('manualStockMovements.totalAmount')}</span>
                  <span className="font-bold text-emerald-600">
                    ${summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* 创建与确认历史痕迹 */}
              {(createdByName || confirmedByName) && (
                <>
                  <Separator className="my-2" />
                  <div className="space-y-2 text-xs text-muted-foreground pt-1">
                    {createdByName && (
                      <p>
                        {t('manualStockMovements.createdBy')}: <span className="font-medium text-foreground">{createdByName}</span>
                      </p>
                    )}
                    {confirmedByName && (
                      <p>
                        {t('manualStockMovements.confirmedBy')}: <span className="font-medium text-foreground">{confirmedByName}</span>
                      </p>
                    )}
                    {confirmedAt && (
                      <p>
                        {t('manualStockMovements.confirmedAt')}: <span className="font-medium text-foreground">{confirmedAt}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* 操作控制纽 (草稿状态可见) */}
              {!isReadOnly && (
                <div className="flex flex-col gap-2.5 pt-4">
                  <Button onClick={handleSaveDraft} variant="outline" className="w-full" disabled={saving || posting}>
                    <Save className="mr-2 h-4 w-4" />
                    {t('manualStockMovements.saveDraft')}
                  </Button>
                  <Button onClick={() => handleConfirmPost(false)} className="w-full shadow-sm" disabled={saving || posting}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {posting ? '过账中...' : t('manualStockMovements.confirmMovement')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 切换变动方向二次确认 Dialog */}
      <Dialog open={switchDirectionDialogOpen} onOpenChange={setSwitchDirectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>切换变动方向</DialogTitle>
            <DialogDescription>{t('manualStockMovements.switchDirectionConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchDirectionDialogOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={() => tempDirection && executeDirectionChange(tempDirection)}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 高风险记账风控二次确认 Dialog */}
      <Dialog open={confirmRiskDialogOpen} onOpenChange={open => !open && !posting && setConfirmRiskDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">{t('manualStockMovements.riskConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground pt-2">
            {riskType === 'qty' && <p>{t('manualStockMovements.riskConfirmQty', { total: riskQty })}</p>}
            {riskType === 'amount' && <p>{t('manualStockMovements.riskConfirmAmount', { total: riskAmount.toLocaleString() })}</p>}
            {riskType === 'both' && (
              <p>
                {t('manualStockMovements.riskConfirmBoth', {
                  qty: riskQty,
                  amount: riskAmount.toLocaleString(),
                })}
              </p>
            )}
            <p className="text-xs text-muted-foreground font-semibold">* 该操作会触发大量库存记账，请确认您已获得授权，是否继续？</p>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmRiskDialogOpen(false)} disabled={posting}>
              {t('manualStockMovements.riskConfirmCancel')}
            </Button>
            <Button variant="destructive" onClick={() => handleConfirmPost(true)} disabled={posting}>
              {posting ? '过账中...' : t('manualStockMovements.riskConfirmProceed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 库存不足预检 Dialog */}
      <Dialog open={insufficientDialogOpen} onOpenChange={setInsufficientDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {t('manualStockMovements.insufficientStockTitle')}
            </DialogTitle>
            <DialogDescription>{t('manualStockMovements.insufficientStockDescription')}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>{t('manualStockMovements.colMaterialCode')}</TableHead>
                  <TableHead>{t('manualStockMovements.colMaterialName')}</TableHead>
                  <TableHead className="text-right">{t('manualStockMovements.requiredQty')}</TableHead>
                  <TableHead className="text-right">{t('manualStockMovements.availableQty')}</TableHead>
                  <TableHead className="text-right">{t('manualStockMovements.shortage')}</TableHead>
                  <TableHead className="w-16">{t('manualStockMovements.colUnit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insufficientItems.map(item => (
                  <TableRow key={item.materialId} className={item.availableQty === 0 ? 'bg-destructive/10' : ''}>
                    <TableCell className="text-center text-muted-foreground">{item.sortOrder}</TableCell>
                    <TableCell className="font-mono text-sm">{item.materialCode}</TableCell>
                    <TableCell>{item.materialName}</TableCell>
                    <TableCell className="text-right">{item.requiredQty}</TableCell>
                    <TableCell className="text-right">{item.availableQty}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{(item.availableQty - item.requiredQty).toFixed(2)}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setInsufficientDialogOpen(false)}>{t('manualStockMovements.insufficientStockConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
