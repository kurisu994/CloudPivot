'use client'

import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toStorageAmount } from '@/lib/currency'
import type { MaterialReferenceOption, WarehouseItem } from '@/lib/tauri'
import { createManualStockMovement, getMaterialReferenceOptions, getWarehouses } from '@/lib/tauri'

type MovementType = 'in' | 'out'

/**
 * 自由出入库表单
 * 用于未启用采购单、销售单等完整业务流程时快速调整实际库存。
 */
export function ManualStockMovementContent() {
  const t = useTranslations('manualStockMovements')
  const tc = useTranslations('common')

  const [movementType, setMovementType] = useState<MovementType>('in')
  const [materialId, setMaterialId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0])
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [supplierBatchNo, setSupplierBatchNo] = useState('')
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [materials, setMaterials] = useState<MaterialReferenceOption[]>([])

  useEffect(() => {
    void Promise.all([getWarehouses(false), getMaterialReferenceOptions()])
      .then(([warehouseItems, materialItems]) => {
        setWarehouses(warehouseItems)
        setMaterials(materialItems)
      })
      .catch(() => {
        toast.error(t('loadOptionsFailed'))
      })
  }, [t])

  const warehouseItems = useMemo(() => warehouses.map(w => ({ value: String(w.id), label: w.name })), [warehouses])
  const materialItems = useMemo(() => materials.map(m => ({ value: String(m.id), label: `${m.code} - ${m.name}` })), [materials])
  const selectedMaterial = materials.find(m => String(m.id) === materialId)
  const isInbound = movementType === 'in'

  /** 重置表单 */
  const handleReset = () => {
    setMovementType('in')
    setMaterialId('')
    setWarehouseId('')
    setMovementDate(new Date().toISOString().split('T')[0])
    setQuantity('')
    setUnitCost('')
    setLotNo('')
    setSupplierBatchNo('')
    setRemark('')
  }

  /** 提交自由出入库 */
  const handleSubmit = async () => {
    const parsedQuantity = Number(quantity)
    const parsedUnitCost = Number(unitCost)
    if (!materialId) {
      toast.error(t('selectMaterial'))
      return
    }
    if (!warehouseId) {
      toast.error(t('selectWarehouse'))
      return
    }
    if (!movementDate) {
      toast.error(t('selectDate'))
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error(t('quantityInvalid'))
      return
    }
    if (isInbound && (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)) {
      toast.error(t('unitCostInvalid'))
      return
    }

    setSaving(true)
    try {
      const movementNo = await createManualStockMovement({
        movementType,
        materialId: Number(materialId),
        warehouseId: Number(warehouseId),
        movementDate,
        quantity: parsedQuantity,
        unitCostUsd: isInbound ? toStorageAmount(parsedUnitCost, 'USD') : null,
        lotNo: lotNo.trim() || null,
        supplierBatchNo: supplierBatchNo.trim() || null,
        remark: remark.trim() || null,
      })
      toast.success(t('saveSuccess', { movementNo }))
      handleReset()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('movementType')}</label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={isInbound ? 'default' : 'outline'} onClick={() => setMovementType('in')}>
                <ArrowDownToLine data-icon="inline-start" />
                {t('inbound')}
              </Button>
              <Button type="button" variant={!isInbound ? 'default' : 'outline'} onClick={() => setMovementType('out')}>
                <ArrowUpFromLine data-icon="inline-start" />
                {t('outbound')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('material')}</label>
            <Select value={materialId} onValueChange={v => v && setMaterialId(v)} items={materialItems}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectMaterial')} />
              </SelectTrigger>
              <SelectContent>
                {materialItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('warehouse')}</label>
            <Select value={warehouseId} onValueChange={v => v && setWarehouseId(v)} items={warehouseItems}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectWarehouse')} />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('movementDate')}</label>
            <Input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('quantity')}</label>
            <Input type="number" min={0} step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('unit')}</label>
            <Input value={selectedMaterial?.unitName || ''} readOnly placeholder={t('autoUnit')} />
          </div>

          {isInbound && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('unitCostUsd')}</label>
                <Input type="number" min={0} step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('lotNo')}</label>
                <Input value={lotNo} onChange={e => setLotNo(e.target.value)} placeholder={t('autoLotNo')} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('supplierBatchNo')}</label>
                <Input value={supplierBatchNo} onChange={e => setSupplierBatchNo(e.target.value)} placeholder={t('optional')} />
              </div>
            </>
          )}

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">{t('remark')}</label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('remarkPlaceholder')} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />
            {tc('reset')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            <Save data-icon="inline-start" />
            {saving ? tc('loading') : t('submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
