'use client'

import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatAmount, toStorageAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { MaterialReferenceOption, WarehouseItem } from '@/lib/tauri'
import { createManualStockMovement, getMaterialReferenceOptions, getWarehouses } from '@/lib/tauri'

type MovementType = 'in' | 'out'

interface PreviewRowProps {
  label: string
  value: string
}

/**
 * 过账预览行
 * 用于在侧栏中展示当前表单已选择的关键业务字段。
 */
function PreviewRow({ label, value }: PreviewRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0 text-sm">{label}</span>
      <span className="text-right text-sm font-medium break-words">{value}</span>
    </div>
  )
}

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
  const selectedWarehouse = warehouses.find(w => String(w.id) === warehouseId)
  const isInbound = movementType === 'in'
  const previewQuantity = quantity ? `${quantity} ${selectedMaterial?.unitName ?? ''}`.trim() : t('notEntered')
  const previewUnitCost =
    isInbound && unitCost && Number.isFinite(Number(unitCost)) ? formatAmount(toStorageAmount(Number(unitCost), 'USD'), 'USD') : t('notEntered')
  const requiredChecks = [
    { label: t('material'), done: Boolean(materialId) },
    { label: t('warehouse'), done: Boolean(warehouseId) },
    { label: t('movementDate'), done: Boolean(movementDate) },
    { label: t('quantity'), done: Number(quantity) > 0 },
    ...(isInbound ? [{ label: t('unitCostUsd'), done: Number(unitCost) >= 0 && unitCost !== '' }] : []),
  ]

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
      toast.error(getErrorMessage(error, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <Badge variant={isInbound ? 'default' : 'secondary'}>{isInbound ? t('inbound') : t('outbound')}</Badge>
      </div>

      <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="min-h-full">
          <CardHeader className="border-b">
            <CardTitle>{t('formTitle')}</CardTitle>
            <CardDescription>{t('formDescription')}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-6">
            <FieldGroup className="grid gap-5 lg:grid-cols-4">
              <Field className="lg:col-span-2">
                <FieldLabel>{t('movementType')}</FieldLabel>
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
              </Field>

              <Field className="lg:col-span-2">
                <FieldLabel>{t('movementDate')}</FieldLabel>
                <Input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} />
              </Field>

              <Field className="lg:col-span-2">
                <FieldLabel>{t('material')}</FieldLabel>
                <Select value={materialId} onValueChange={v => setMaterialId(v ?? '')} items={materialItems}>
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
              </Field>

              <Field>
                <FieldLabel>{t('warehouse')}</FieldLabel>
                <Select value={warehouseId} onValueChange={v => setWarehouseId(v ?? '')} items={warehouseItems}>
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
              </Field>

              <Field>
                <FieldLabel>{t('quantity')}</FieldLabel>
                <Input type="number" min={0} step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
              </Field>

              <Field>
                <FieldLabel>{t('unit')}</FieldLabel>
                <Input value={selectedMaterial?.unitName || ''} readOnly placeholder={t('autoUnit')} />
              </Field>

              {isInbound && (
                <>
                  <Field>
                    <FieldLabel>{t('unitCostUsd')}</FieldLabel>
                    <Input type="number" min={0} step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" />
                  </Field>

                  <Field>
                    <FieldLabel>{t('lotNo')}</FieldLabel>
                    <Input value={lotNo} onChange={e => setLotNo(e.target.value)} placeholder={t('autoLotNo')} />
                  </Field>

                  <Field>
                    <FieldLabel>{t('supplierBatchNo')}</FieldLabel>
                    <Input value={supplierBatchNo} onChange={e => setSupplierBatchNo(e.target.value)} placeholder={t('optional')} />
                  </Field>
                </>
              )}

              <Separator className="lg:col-span-4" />

              <Field className="lg:col-span-4">
                <FieldLabel>{t('remark')}</FieldLabel>
                <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('remarkPlaceholder')} />
              </Field>
            </FieldGroup>
          </CardContent>

          <CardFooter className="justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw data-icon="inline-start" />
              {tc('reset')}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? tc('loading') : t('submit')}
            </Button>
          </CardFooter>
        </Card>

        <div className="grid gap-6 xl:grid-rows-[auto_1fr]">
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t('previewTitle')}</CardTitle>
              <CardDescription>{t('previewDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PreviewRow label={t('movementType')} value={isInbound ? t('inbound') : t('outbound')} />
              <PreviewRow label={t('material')} value={selectedMaterial ? `${selectedMaterial.code} - ${selectedMaterial.name}` : t('notSelected')} />
              <PreviewRow label={t('warehouse')} value={selectedWarehouse?.name ?? t('notSelected')} />
              <PreviewRow label={t('movementDate')} value={movementDate || t('notSelected')} />
              <PreviewRow label={t('quantity')} value={previewQuantity} />
              {isInbound && <PreviewRow label={t('unitCostUsd')} value={previewUnitCost} />}
            </CardContent>
          </Card>

          <Card size="sm" className="min-h-0">
            <CardHeader>
              <CardTitle>{t('requiredTitle')}</CardTitle>
              <CardDescription>{t('requiredDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {requiredChecks.map(item => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{item.label}</span>
                  <Badge variant={item.done ? 'secondary' : 'outline'}>{item.done ? t('ready') : t('pending')}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
