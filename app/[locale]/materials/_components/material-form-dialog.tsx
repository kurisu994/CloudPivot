'use client'

import { Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Currency, getCurrencyConfig, toDisplayAmount, toStorageAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import { invoke, isTauriEnv } from '@/lib/tauri'
import type { CategoryOption, UnitOption } from './materials-client-page'

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

/** 系统本位币（与系统设置一致） */
const BASE_CURRENCY: Currency = 'USD'

interface MaterialFormData {
  id: number | null
  code: string
  name: string
  materialType: string
  categoryId: number | null
  spec: string
  baseUnitId: number | null
  auxUnitId: number | null
  conversionRate: number | null
  refCostPrice: number
  salePrice: number
  safetyStock: number
  maxStock: number
  lotTrackingMode: string
  texture: string
  color: string
  surfaceCraft: string
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  barcode: string
  remark: string
}

const EMPTY_FORM: MaterialFormData = {
  id: null,
  code: '',
  name: '',
  materialType: 'raw',
  categoryId: null,
  spec: '',
  baseUnitId: null,
  auxUnitId: null,
  conversionRate: null,
  refCostPrice: 0,
  salePrice: 0,
  safetyStock: 0,
  maxStock: 0,
  lotTrackingMode: 'none',
  texture: '',
  color: '',
  surfaceCraft: '',
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  barcode: '',
  remark: '',
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MaterialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materialId: number | null
  categories: CategoryOption[]
  units: UnitOption[]
  onSuccess: () => void
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function MaterialFormDialog({ open, onOpenChange, materialId, categories, units, onSuccess }: MaterialFormDialogProps) {
  const t = useTranslations('materials')
  const [form, setForm] = useState<MaterialFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)

  /* 构建 Select items — 按树形深度优先排序并加缩进 */
  const categoryItems = useMemo(() => {
    // 深度优先排序
    const childrenMap = new Map<number | null, CategoryOption[]>()
    for (const cat of categories) {
      const pid = cat.parentId ?? null
      if (!childrenMap.has(pid)) childrenMap.set(pid, [])
      childrenMap.get(pid)!.push(cat)
    }
    const sorted: CategoryOption[] = []
    const traverse = (parentId: number | null) => {
      const children = childrenMap.get(parentId)
      if (!children) return
      for (const child of children) {
        sorted.push(child)
        traverse(child.id)
      }
    }
    traverse(null)
    return sorted.map(c => ({
      value: c.id.toString(),
      label: `${'　'.repeat(c.level - 1)}${c.name}`,
    }))
  }, [categories])

  const unitItems = useMemo(() => units.map(u => ({ value: u.id.toString(), label: u.name })), [units])

  const auxUnitItems = useMemo(
    () => [{ value: 'none', label: t('form.noAuxUnit') }, ...units.map(u => ({ value: u.id.toString(), label: u.name }))],
    [units, t],
  )

  /** 更新单个字段 */
  const setField = useCallback(<K extends keyof MaterialFormData>(key: K, value: MaterialFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  /** 打开弹窗时加载数据 */
  useEffect(() => {
    if (!open) return

    if (materialId) {
      setInitializing(true)
      if (!isTauriEnv()) {
        // Mock 模式
        setForm({
          ...EMPTY_FORM,
          id: materialId,
          code: 'M-0001',
          name: '测试物料',
          materialType: 'raw',
        })
        setInitializing(false)
        return
      }
      invoke<MaterialFormData>('get_material_by_id', { id: materialId })
        .then(detail => {
          setForm({
            ...detail,
            code: detail.code ?? '',
            spec: detail.spec ?? '',
            texture: detail.texture ?? '',
            color: detail.color ?? '',
            surfaceCraft: detail.surfaceCraft ?? '',
            barcode: detail.barcode ?? '',
            remark: detail.remark ?? '',
            lotTrackingMode: detail.lotTrackingMode ?? 'none',
          })
        })
        .catch(e => {
          toast.error(t('notifications.loadDetailFailed'))
          console.error(e)
          onOpenChange(false)
        })
        .finally(() => setInitializing(false))
    } else {
      setForm(EMPTY_FORM)
      setErrors({})
      if (!isTauriEnv()) {
        setForm({ ...EMPTY_FORM, code: 'M-0003' })
        return
      }

      setInitializing(true)
      invoke<string>('generate_material_code')
        .then(code => {
          setForm(prev => ({ ...prev, code }))
        })
        .catch(e => {
          toast.error(getErrorMessage(e, t('notifications.generateCodeFailed')))
          console.error(e)
        })
        .finally(() => setInitializing(false))
    }
  }, [open, materialId, onOpenChange, t])

  /** 校验 */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = t('validation.nameRequired')
    if (!form.materialType) errs.materialType = t('validation.typeRequired')
    if (!form.categoryId) errs.categoryId = t('validation.categoryRequired')
    if (!form.baseUnitId) errs.baseUnitId = t('validation.baseUnitRequired')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /** 提交 */
  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)

    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 500))
      toast.success(materialId ? t('notifications.updateSuccess') : t('notifications.createSuccess'))
      onSuccess()
      setLoading(false)
      return
    }

    try {
      await invoke('save_material', { params: form })
      toast.success(materialId ? t('notifications.updateSuccess') : t('notifications.createSuccess'))
      onSuccess()
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.saveFailed')))
    } finally {
      setLoading(false)
    }
  }

  const isEdit = !!materialId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[67rem]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Package className="text-primary size-5" />
            </div>
            <div>
              <DialogTitle>{isEdit ? t('form.editTitle') : t('form.addTitle')}</DialogTitle>
              <DialogDescription>{t('description')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {initializing ? (
            <div className="text-muted-foreground flex items-center justify-center py-16">Loading...</div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* ━━━ 基本信息 ━━━ */}
              <SectionTitle title={t('form.sectionBasic')} />
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  {/* 物料编码 */}
                  <Field>
                    <FieldLabel htmlFor="code">{t('form.code')}</FieldLabel>
                    <Input id="code" placeholder={t('form.codePlaceholder')} value={form.code} onChange={e => setField('code', e.target.value)} />
                  </Field>

                  {/* 物料名称 * */}
                  <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">
                      {t('form.name')} <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      placeholder={t('form.namePlaceholder')}
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      aria-invalid={!!errors.name || undefined}
                    />
                    {errors.name && <FieldError>{errors.name}</FieldError>}
                  </Field>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {/* 物料类型 * */}
                  <Field data-invalid={!!errors.materialType || undefined}>
                    <FieldLabel>
                      {t('form.type')} <span className="text-destructive">*</span>
                    </FieldLabel>
                    <RadioGroup value={form.materialType} onValueChange={v => setField('materialType', v)} className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="raw" />
                        {t('filters.type.raw')}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="semi" />
                        {t('filters.type.semi')}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="finished" />
                        {t('filters.type.finished')}
                      </label>
                    </RadioGroup>
                  </Field>

                  {/* 所属分类 * */}
                  <Field data-invalid={!!errors.categoryId || undefined}>
                    <FieldLabel>
                      {t('form.category')} <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={form.categoryId?.toString() ?? ''}
                      onValueChange={v => setField('categoryId', v ? parseInt(v) : null)}
                      items={categoryItems}
                    >
                      <SelectTrigger aria-invalid={!!errors.categoryId || undefined}>
                        <SelectValue placeholder={t('form.categoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryItems.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.categoryId && <FieldError>{errors.categoryId}</FieldError>}
                  </Field>

                  {/* 规格型号 */}
                  <Field>
                    <FieldLabel htmlFor="spec">{t('form.spec')}</FieldLabel>
                    <Input id="spec" placeholder={t('form.specPlaceholder')} value={form.spec} onChange={e => setField('spec', e.target.value)} />
                  </Field>

                  {/* 计量单位 * */}
                  <Field data-invalid={!!errors.baseUnitId || undefined}>
                    <FieldLabel>
                      {t('form.baseUnit')} <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={form.baseUnitId?.toString() ?? ''}
                      onValueChange={v => setField('baseUnitId', v ? parseInt(v) : null)}
                      items={unitItems}
                    >
                      <SelectTrigger aria-invalid={!!errors.baseUnitId || undefined}>
                        <SelectValue placeholder={t('form.baseUnitPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.baseUnitId && <FieldError>{errors.baseUnitId}</FieldError>}
                  </Field>
                </div>
              </FieldGroup>

              {/* ━━━ 库存设置 ━━━ */}
              <SectionTitle title={t('form.sectionStock')} />
              <FieldGroup className="mt-3">
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="safety_stock">{t('form.safetyStock')}</FieldLabel>
                    <Input
                      id="safety_stock"
                      type="number"
                      placeholder={t('form.safetyStockPlaceholder')}
                      value={form.safetyStock || ''}
                      onChange={e => setField('safetyStock', parseFloat(e.target.value) || 0)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="max_stock">{t('form.maxStock')}</FieldLabel>
                    <Input
                      id="max_stock"
                      type="number"
                      placeholder={t('form.maxStockPlaceholder')}
                      value={form.maxStock || ''}
                      onChange={e => setField('maxStock', parseFloat(e.target.value) || 0)}
                    />
                  </Field>
                </div>
              </FieldGroup>

              {/* ━━━ 计量与追踪 ━━━ */}
              <SectionTitle title={t('form.sectionTracking')} />
              <FieldGroup>
                <div className="grid grid-cols-3 gap-4">
                  {/* 辅助单位 */}
                  <Field>
                    <FieldLabel>{t('form.auxUnit')}</FieldLabel>
                    <Select
                      defaultValue="none"
                      value={form.auxUnitId?.toString() ?? 'none'}
                      onValueChange={v => setField('auxUnitId', !v || v === 'none' ? null : parseInt(v))}
                      items={auxUnitItems}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('form.noAuxUnit')}</SelectItem>
                        {units.map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* 换算比例 */}
                  <Field>
                    <FieldLabel htmlFor="conversion">{t('form.conversionRate')}</FieldLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm whitespace-nowrap">{t('form.auxUnitPrefix')}</span>
                      <Input
                        id="conversion"
                        type="number"
                        step="0.01"
                        placeholder={t('form.conversionRatePlaceholder')}
                        value={form.conversionRate ?? ''}
                        onChange={e => setField('conversionRate', parseFloat(e.target.value) || null)}
                      />
                      <span className="text-muted-foreground text-sm whitespace-nowrap">{t('form.baseUnitLabel')}</span>
                    </div>
                  </Field>

                  {/* 批次追踪 */}
                  <Field>
                    <FieldLabel>{t('form.lotTrackingMode')}</FieldLabel>
                    <RadioGroup value={form.lotTrackingMode} onValueChange={v => setField('lotTrackingMode', v)} className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="none" />
                        {t('form.lotTrackingModes.none')}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="optional" />
                        {t('form.lotTrackingModes.optional')}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="required" />
                        {t('form.lotTrackingModes.required')}
                      </label>
                    </RadioGroup>
                  </Field>
                </div>
              </FieldGroup>

              {/* ━━━ 家具属性 ━━━ */}
              <div className="bg-muted/40 rounded-lg p-5">
                <SectionTitle title={t('form.sectionFurniture')} accent />
                <FieldGroup className="mt-3">
                  <div className="grid grid-cols-3 gap-4">
                    <Field>
                      <FieldLabel htmlFor="texture">{t('form.texture')}</FieldLabel>
                      <Input
                        id="texture"
                        placeholder={t('form.texturePlaceholder')}
                        value={form.texture}
                        onChange={e => setField('texture', e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="color">{t('form.color')}</FieldLabel>
                      <Input
                        id="color"
                        placeholder={t('form.colorPlaceholder')}
                        value={form.color}
                        onChange={e => setField('color', e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="surface">{t('form.surfaceCraft')}</FieldLabel>
                      <Input
                        id="surface"
                        placeholder={t('form.surfaceCraftPlaceholder')}
                        value={form.surfaceCraft}
                        onChange={e => setField('surfaceCraft', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>{t('form.dimensions')}</FieldLabel>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.lengthMm ?? ''}
                          onChange={e => setField('lengthMm', parseFloat(e.target.value) || null)}
                          placeholder="0"
                        />
                        <span className="text-muted-foreground absolute top-2.5 right-3 text-xs">{t('form.labelL')}</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.widthMm ?? ''}
                          onChange={e => setField('widthMm', parseFloat(e.target.value) || null)}
                          placeholder="0"
                        />
                        <span className="text-muted-foreground absolute top-2.5 right-3 text-xs">{t('form.labelW')}</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.heightMm ?? ''}
                          onChange={e => setField('heightMm', parseFloat(e.target.value) || null)}
                          placeholder="0"
                        />
                        <span className="text-muted-foreground absolute top-2.5 right-3 text-xs">{t('form.labelH')}</span>
                      </div>
                    </div>
                  </Field>
                </FieldGroup>
              </div>

              {/* ━━━ 其他信息 ━━━ */}
              <SectionTitle title={t('form.sectionOther')} />
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="barcode">{t('form.barcode')}</FieldLabel>
                    <Input id="barcode" value={form.barcode} onChange={e => setField('barcode', e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="remark">{t('form.remark')}</FieldLabel>
                    <Input id="remark" value={form.remark} onChange={e => setField('remark', e.target.value)} />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 flex items-center justify-between rounded-b-xl border-t bg-slate-50/50 px-6 py-4 sm:justify-between dark:bg-slate-900/50">
          <p className="text-muted-foreground text-xs">ℹ {t('form.requiredHint')}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? '...' : t('actions.confirm')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  分组标题 — 对应设计稿中带竖线的蓝色分组名                            */
/* ------------------------------------------------------------------ */

function SectionTitle({ title, accent }: { title: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-1 rounded-full ${accent ? 'bg-amber-500' : 'bg-primary'}`} />
      <span className={`text-sm font-bold ${accent ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>{title}</span>
    </div>
  )
}
