'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invoke, isTauriEnv } from '@/lib/tauri'

import type { BomItemRow } from './bom-edit-page'
import { isPresetProcessStep, normalizeProcessStep, PRESET_PROCESS_STEP_KEYS, translateProcessStep } from './process-steps'

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

interface ChildMaterialOption {
  id: number
  code: string
  name: string
  nameVi: string | null
  spec: string | null
  materialType: string
  unitName: string | null
  refCostPrice: number
}

/* ------------------------------------------------------------------ */
/*  Mock 数据                                                          */
/* ------------------------------------------------------------------ */

const MOCK_CHILD_MATERIALS: ChildMaterialOption[] = [
  {
    id: 1,
    code: 'M-0001',
    name: '白橡实木板',
    nameVi: 'Gỗ sồi trắng',
    spec: '2440×1220',
    materialType: 'raw',
    unitName: '张',
    refCostPrice: 28000,
  },
  { id: 2, code: 'M-0002', name: '不锈钢铰链', nameVi: 'Bản lề inox', spec: '40mm', materialType: 'raw', unitName: '个', refCostPrice: 48 },
  { id: 7, code: 'M-0007', name: '木方', nameVi: 'Thanh gỗ', spec: '40×40', materialType: 'raw', unitName: '根', refCostPrice: 1200 },
  { id: 8, code: 'M-0008', name: '不锈钢腿', nameVi: 'Chân inox', spec: '710mm', materialType: 'raw', unitName: '个', refCostPrice: 3500 },
  { id: 9, code: 'M-0009', name: '螺丝M6', nameVi: 'Ốc vít M6', spec: '30mm', materialType: 'raw', unitName: '个', refCostPrice: 15 },
  { id: 10, code: 'M-0010', name: '木蜡油', nameVi: 'Dầu sáp gỗ', spec: null, materialType: 'raw', unitName: '千克', refCostPrice: 6800 },
  { id: 11, code: 'M-0011', name: '包装纸箱', nameVi: 'Thùng carton', spec: '特大', materialType: 'raw', unitName: '个', refCostPrice: 2200 },
]

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

interface BomItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: BomItemRow | null
  onSave: (item: BomItemRow) => void
  /** 当前 BOM 明细中已使用的工序值集合，用于联想去重 */
  usedProcessSteps?: string[]
}

/**
 * BOM 明细编辑弹窗：添加或编辑一行 BOM 明细
 */
export function BomItemDialog({ open, onOpenChange, editingItem, onSave, usedProcessSteps = [] }: BomItemDialogProps) {
  const t = useTranslations('bom')
  const isEdit = editingItem !== null

  // 物料搜索
  const [searchKeyword, setSearchKeyword] = useState('')
  const [materialOptions, setMaterialOptions] = useState<ChildMaterialOption[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<ChildMaterialOption | null>(null)
  const searchRequestIdRef = useRef(0)

  // 表单字段
  const [standardQty, setStandardQty] = useState('1')
  const [wastageRate, setWastageRate] = useState('0')
  const [processStep, setProcessStep] = useState<string>('')
  const [isKeyPart, setIsKeyPart] = useState(false)
  const [itemRemark, setItemRemark] = useState('')

  // 工序输入焦点状态，控制建议下拉显隐
  const [processStepFocused, setProcessStepFocused] = useState(false)
  const processStepRef = useRef<HTMLDivElement>(null)

  /**
   * 工序建议列表：预设工序 + 已用工序（去重），按输入关键词过滤。
   * 输入框中始终展示 label，保存时由 normalizeProcessStep 归一为存储 key。
   */
  const processStepSuggestions = useMemo(() => {
    // 构建预设工序选项（key → i18n 翻译 label）
    const presetOptions = PRESET_PROCESS_STEP_KEYS.map(key => ({
      key,
      label: translateProcessStep(key, t),
    }))
    const presetLabels = new Set(presetOptions.map(opt => opt.label))

    // 已用工序中的自定义值（排除预设 key 及与预设 label 重复的字面文本）
    const customUsed = usedProcessSteps.filter(v => v && !isPresetProcessStep(v) && !presetLabels.has(v)).map(v => ({ key: v, label: v }))

    const all = [...presetOptions, ...customUsed]

    // 按输入关键词过滤
    const kw = processStep.trim().toLowerCase()
    if (!kw) return all
    return all.filter(opt => opt.key.toLowerCase().includes(kw) || opt.label.toLowerCase().includes(kw))
  }, [t, usedProcessSteps, processStep])

  /** 搜索物料 */
  const fetchMaterials = useCallback(async (keyword: string) => {
    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    const normalizedKeyword = keyword.trim()

    if (!isTauriEnv()) {
      let filtered = MOCK_CHILD_MATERIALS
      if (normalizedKeyword) {
        const kw = normalizedKeyword.toLowerCase()
        filtered = filtered.filter(m => m.code.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw))
      }
      if (requestId === searchRequestIdRef.current) {
        setMaterialOptions(filtered)
      }
      return
    }
    try {
      const res = await invoke<ChildMaterialOption[]>('get_bom_child_materials', {
        keyword: normalizedKeyword || null,
      })
      if (requestId === searchRequestIdRef.current) {
        setMaterialOptions(res)
      }
    } catch (e) {
      console.error('搜索物料失败', e)
    }
  }, [])

  // 弹窗打开时初始化
  useEffect(() => {
    if (!open) return
    if (editingItem) {
      setSelectedMaterial({
        id: editingItem.child_material_id,
        code: editingItem.materialCode ?? '',
        name: editingItem.materialName ?? '',
        nameVi: editingItem.materialNameVi ?? null,
        spec: editingItem.material_spec ?? null,
        materialType: 'raw',
        unitName: editingItem.unitName ?? null,
        refCostPrice: editingItem.ref_cost_price ?? 0,
      })
      setStandardQty(editingItem.standard_qty.toString())
      setWastageRate(editingItem.wastage_rate.toString())
      // 预设 key 转为当前语言 label 展示，保存时再归一回 key
      setProcessStep(editingItem.process_step ? translateProcessStep(editingItem.process_step, t) : '')
      setIsKeyPart(editingItem.is_key_part)
      setItemRemark(editingItem.remark ?? '')
      setMaterialOptions([])
    } else {
      setSelectedMaterial(null)
      setStandardQty('1')
      setWastageRate('0')
      setProcessStep('')
      setIsKeyPart(false)
      setItemRemark('')
      setSearchKeyword('')
      setMaterialOptions([])
    }
  }, [open, editingItem, t])

  // 搜索词变化只刷新候选项，不重新初始化表单。
  useEffect(() => {
    if (!open || isEdit || selectedMaterial) return
    void fetchMaterials(searchKeyword)
  }, [fetchMaterials, isEdit, open, searchKeyword, selectedMaterial])

  // 点击工序建议区域外时关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (processStepRef.current && !processStepRef.current.contains(e.target as Node)) {
        setProcessStepFocused(false)
      }
    }
    if (processStepFocused) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [processStepFocused])

  const handleSave = () => {
    if (!selectedMaterial) return
    const qty = parseFloat(standardQty) || 0
    const wastage = parseFloat(wastageRate) || 0
    const actualQty = qty * (1 + wastage / 100)

    onSave({
      child_material_id: selectedMaterial.id,
      materialCode: selectedMaterial.code,
      materialName: selectedMaterial.name,
      materialNameVi: selectedMaterial.nameVi,
      material_spec: selectedMaterial.spec,
      unitName: selectedMaterial.unitName,
      ref_cost_price: selectedMaterial.refCostPrice,
      standard_qty: qty,
      wastage_rate: wastage,
      actual_qty: actualQty,
      process_step: normalizeProcessStep(processStep, t) || null,
      is_key_part: isKeyPart,
      substitute_id: null,
      substitute_name: null,
      remark: itemRemark || null,
      sort_order: 0,
      // 编辑时保留已有开料明细，新增行为空
      cutting_details: editingItem?.cutting_details ?? [],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[35rem]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('actions.edit') : t('actions.addMaterial')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 物料选择 */}
          {!isEdit && (
            <div className="grid gap-2">
              <Label>{t('items.materialName')} *</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-3 size-[1.125rem]" />
                <Input
                  className="pl-10"
                  placeholder={t('form.searchMaterial')}
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                />
              </div>
              {materialOptions.length > 0 && !selectedMaterial && (
                <div className="border-border max-h-[12.5rem] overflow-y-auto rounded-md border">
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
                      <span className="font-medium">
                        {m.name}
                        {m.nameVi && <span className="text-muted-foreground ml-1.5 text-xs font-normal">({m.nameVi})</span>}
                      </span>
                      <span className="text-muted-foreground text-xs">{m.code}</span>
                      {m.spec && <span className="text-muted-foreground text-xs">({m.spec})</span>}
                      <span className="text-muted-foreground ml-auto text-xs">{m.unitName}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedMaterial && (
                <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2">
                  <span className="text-sm font-medium">
                    {selectedMaterial.name}
                    {selectedMaterial.nameVi && ` (${selectedMaterial.nameVi})`}
                    {` (${selectedMaterial.code})`}
                    {selectedMaterial.spec && ` — ${selectedMaterial.spec}`}
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
                {selectedMaterial.name}
                {selectedMaterial.nameVi && ` (${selectedMaterial.nameVi})`}
                {` (${selectedMaterial.code})`}
                {selectedMaterial.spec && ` — ${selectedMaterial.spec}`}
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
            {/* 工序选择：自由输入 + 预设/已用工序联想 */}
            <div className="relative grid gap-2" ref={processStepRef}>
              <Label>{t('items.processStep')}</Label>
              <Input
                value={processStep}
                onChange={e => setProcessStep(e.target.value)}
                onFocus={() => setProcessStepFocused(true)}
                placeholder={t('form.processStepPlaceholder')}
              />
              {processStepFocused && processStepSuggestions.length > 0 && (
                <div className="border-border bg-popover absolute top-[calc(100%+0.25rem)] right-0 left-0 z-50 max-h-[12.5rem] overflow-y-auto rounded-md border shadow-md">
                  {processStepSuggestions.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                      onMouseDown={e => {
                        // 用 mousedown 而非 click，防止 input blur 先关闭下拉
                        e.preventDefault()
                        setProcessStep(opt.label)
                        setProcessStepFocused(false)
                      }}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
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
