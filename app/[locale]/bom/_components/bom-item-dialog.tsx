'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invoke, isTauriEnv } from '@/lib/tauri'

import type { BomItemRow } from './bom-edit-page'

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

interface ChildMaterialOption {
  id: number
  code: string
  name: string
  spec: string | null
  material_type: string
  unit_name: string | null
  ref_cost_price: number
}

/* ------------------------------------------------------------------ */
/*  Mock 数据                                                          */
/* ------------------------------------------------------------------ */

const MOCK_CHILD_MATERIALS: ChildMaterialOption[] = [
  { id: 1, code: 'M-0001', name: '白橡实木板', spec: '2440×1220', material_type: 'raw', unit_name: '张', ref_cost_price: 28000 },
  { id: 2, code: 'M-0002', name: '不锈钢铰链', spec: '40mm', material_type: 'raw', unit_name: '个', ref_cost_price: 48 },
  { id: 7, code: 'M-0007', name: '木方', spec: '40×40', material_type: 'raw', unit_name: '根', ref_cost_price: 1200 },
  { id: 8, code: 'M-0008', name: '不锈钢腿', spec: '710mm', material_type: 'raw', unit_name: '个', ref_cost_price: 3500 },
  { id: 9, code: 'M-0009', name: '螺丝M6', spec: '30mm', material_type: 'raw', unit_name: '个', ref_cost_price: 15 },
  { id: 10, code: 'M-0010', name: '木蜡油', spec: null, material_type: 'raw', unit_name: '千克', ref_cost_price: 6800 },
  { id: 11, code: 'M-0011', name: '包装纸箱', spec: '特大', material_type: 'raw', unit_name: '个', ref_cost_price: 2200 },
]

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

interface BomItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: BomItemRow | null
  onSave: (item: BomItemRow) => void
}

/**
 * BOM 明细编辑弹窗：添加或编辑一行 BOM 明细
 */
export function BomItemDialog({ open, onOpenChange, editingItem, onSave }: BomItemDialogProps) {
  const t = useTranslations('bom')
  const isEdit = editingItem !== null

  // 物料搜索
  const [searchKeyword, setSearchKeyword] = useState('')
  const [materialOptions, setMaterialOptions] = useState<ChildMaterialOption[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<ChildMaterialOption | null>(null)

  // 表单字段
  const [standardQty, setStandardQty] = useState('1')
  const [wastageRate, setWastageRate] = useState('0')
  const [processStep, setProcessStep] = useState<string>('')
  const [isKeyPart, setIsKeyPart] = useState(false)
  const [itemRemark, setItemRemark] = useState('')

  const processStepItems = useMemo(
    () => [
      { value: '', label: '—' },
      { value: 'cutting', label: t('form.processSteps.cutting') },
      { value: 'assembly', label: t('form.processSteps.assembly') },
      { value: 'painting', label: t('form.processSteps.painting') },
      { value: 'packaging', label: t('form.processSteps.packaging') },
    ],
    [t],
  )

  /** 搜索物料 */
  const fetchMaterials = useCallback(async () => {
    if (!isTauriEnv()) {
      let filtered = MOCK_CHILD_MATERIALS
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase()
        filtered = filtered.filter(m => m.code.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw))
      }
      setMaterialOptions(filtered)
      return
    }
    try {
      const res = await invoke<ChildMaterialOption[]>('get_bom_child_materials', {
        keyword: searchKeyword.trim() || null,
      })
      setMaterialOptions(res)
    } catch (e) {
      console.error('搜索物料失败', e)
    }
  }, [searchKeyword])

  // 弹窗打开时初始化
  useEffect(() => {
    if (!open) return
    fetchMaterials()
    if (editingItem) {
      setSelectedMaterial({
        id: editingItem.child_material_id,
        code: editingItem.material_code ?? '',
        name: editingItem.material_name ?? '',
        spec: editingItem.material_spec ?? null,
        material_type: 'raw',
        unit_name: editingItem.unit_name ?? null,
        ref_cost_price: editingItem.ref_cost_price ?? 0,
      })
      setStandardQty(editingItem.standard_qty.toString())
      setWastageRate(editingItem.wastage_rate.toString())
      setProcessStep(editingItem.process_step ?? '')
      setIsKeyPart(editingItem.is_key_part)
      setItemRemark(editingItem.remark ?? '')
    } else {
      setSelectedMaterial(null)
      setStandardQty('1')
      setWastageRate('0')
      setProcessStep('')
      setIsKeyPart(false)
      setItemRemark('')
      setSearchKeyword('')
    }
  }, [open, editingItem, fetchMaterials])

  const handleSave = () => {
    if (!selectedMaterial) return
    const qty = parseFloat(standardQty) || 0
    const wastage = parseFloat(wastageRate) || 0
    const actualQty = qty * (1 + wastage / 100)

    onSave({
      child_material_id: selectedMaterial.id,
      material_code: selectedMaterial.code,
      material_name: selectedMaterial.name,
      material_spec: selectedMaterial.spec,
      unit_name: selectedMaterial.unit_name,
      ref_cost_price: selectedMaterial.ref_cost_price,
      standard_qty: qty,
      wastage_rate: wastage,
      actual_qty: actualQty,
      process_step: processStep || null,
      is_key_part: isKeyPart,
      substitute_id: null,
      substitute_name: null,
      remark: itemRemark || null,
      sort_order: 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('actions.edit') : t('actions.addMaterial')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 物料选择 */}
          {!isEdit && (
            <div className="grid gap-2">
              <Label>{t('items.materialName')} *</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-3 size-[18px]" />
                <Input
                  className="pl-10"
                  placeholder={t('form.searchMaterial')}
                  value={searchKeyword}
                  onChange={e => {
                    setSearchKeyword(e.target.value)
                    fetchMaterials()
                  }}
                />
              </div>
              {materialOptions.length > 0 && !selectedMaterial && (
                <div className="border-border max-h-[200px] overflow-y-auto rounded-md border">
                  {materialOptions.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                      onClick={() => {
                        setSelectedMaterial(m)
                        setSearchKeyword('')
                      }}
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground text-xs">{m.code}</span>
                      {m.spec && <span className="text-muted-foreground text-xs">({m.spec})</span>}
                      <span className="text-muted-foreground ml-auto text-xs">{m.unit_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedMaterial && (
                <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2">
                  <span className="text-sm font-medium">
                    {selectedMaterial.name} ({selectedMaterial.code}){selectedMaterial.spec && ` — ${selectedMaterial.spec}`}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMaterial(null)}>
                    ✕
                  </Button>
                </div>
              )}
            </div>
          )}

          {isEdit && selectedMaterial && (
            <div className="grid gap-2">
              <Label>{t('items.materialName')}</Label>
              <div className="bg-muted rounded-md px-3 py-2 text-sm">
                {selectedMaterial.name} ({selectedMaterial.code}){selectedMaterial.spec && ` — ${selectedMaterial.spec}`}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('items.standardQty')} *</Label>
              <Input type="number" value={standardQty} onChange={e => setStandardQty(e.target.value)} min={0} step={0.01} />
            </div>
            <div className="grid gap-2">
              <Label>{t('items.wastageRate')}</Label>
              <Input type="number" value={wastageRate} onChange={e => setWastageRate(e.target.value)} min={0} max={100} step={0.1} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('items.processStep')}</Label>
              <Select value={processStep} onValueChange={v => setProcessStep(v ?? '')} items={processStepItems}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {processStepItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox id="is-key-part" checked={isKeyPart} onCheckedChange={v => setIsKeyPart(v === true)} />
              <Label htmlFor="is-key-part" className="cursor-pointer">
                {t('items.isKeyPart')}
              </Label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t('items.remark')}</Label>
            <Input value={itemRemark} onChange={e => setItemRemark(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!selectedMaterial}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
