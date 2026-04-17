'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getUnitById, saveUnit } from '@/lib/tauri'

/** 小数位选项 */
const DECIMAL_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
]

/** 表单数据类型 */
interface FormData {
  name: string
  nameEn: string
  nameVi: string
  symbol: string
  decimalPlaces: string
  sortOrder: string
  isEnabled: boolean
}

/** 空表单默认值 */
const EMPTY_FORM: FormData = {
  name: '',
  nameEn: '',
  nameVi: '',
  symbol: '',
  decimalPlaces: '0',
  sortOrder: '0',
  isEnabled: true,
}

interface UnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unitId: number | null
  onSuccess: () => void
}

/** 单位新增/编辑弹窗 */
export function UnitDialog({ open, onOpenChange, unitId, onSuccess }: UnitDialogProps) {
  const t = useTranslations('units')
  const tc = useTranslations('common')

  const isEditing = unitId !== null

  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const decimalItems = useMemo(() => DECIMAL_OPTIONS.map(o => ({ value: o.value, label: o.label })), [])

  /** 更新单个字段并清除该字段的校验错误 */
  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 初始化表单 */
  const initForm = useCallback(async () => {
    setErrors({})
    if (unitId) {
      try {
        const unit = await getUnitById(unitId)
        setForm({
          name: unit.name,
          nameEn: unit.name_en ?? '',
          nameVi: unit.name_vi ?? '',
          symbol: unit.symbol ?? '',
          decimalPlaces: String(unit.decimal_places),
          sortOrder: String(unit.sort_order),
          isEnabled: unit.is_enabled,
        })
      } catch (e) {
        toast.error(String(e))
      }
    } else {
      setForm(EMPTY_FORM)
    }
  }, [unitId])

  useEffect(() => {
    if (open) {
      void initForm()
    }
  }, [open, initForm])

  /** 提交保存 */
  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) {
      newErrors.name = t('validation.nameRequired')
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      await saveUnit({
        id: unitId,
        name: form.name.trim(),
        name_en: form.nameEn.trim() || null,
        name_vi: form.nameVi.trim() || null,
        symbol: form.symbol.trim() || null,
        decimal_places: Number(form.decimalPlaces),
        sort_order: Number(form.sortOrder) || 0,
        is_enabled: form.isEnabled,
      })
      onSuccess()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editUnit') : t('addUnit')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              {/* 名称(中) */}
              <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel>
                  {t('name')} <span className="text-destructive">*</span>
                </FieldLabel>
                <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder={t('validation.nameRequired')} />
                <FieldError>{errors.name}</FieldError>
              </Field>

              {/* 英文名称 */}
              <Field>
                <FieldLabel>{t('nameEn')}</FieldLabel>
                <Input value={form.nameEn} onChange={e => updateField('nameEn', e.target.value)} />
              </Field>

              {/* 越南语名称 */}
              <Field>
                <FieldLabel>{t('nameVi')}</FieldLabel>
                <Input value={form.nameVi} onChange={e => updateField('nameVi', e.target.value)} />
              </Field>

              {/* 符号 */}
              <Field>
                <FieldLabel>{t('symbol')}</FieldLabel>
                <Input value={form.symbol} onChange={e => updateField('symbol', e.target.value)} />
              </Field>

              {/* 小数位 */}
              <Field>
                <FieldLabel>
                  {t('decimalPlaces')} <span className="text-destructive">*</span>
                </FieldLabel>
                <Select value={form.decimalPlaces} onValueChange={val => val && updateField('decimalPlaces', val)} items={decimalItems}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECIMAL_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* 排序序号 */}
              <Field>
                <FieldLabel>{t('sortOrder')}</FieldLabel>
                <Input type="number" value={form.sortOrder} onChange={e => updateField('sortOrder', e.target.value)} />
              </Field>
            </div>
          </FieldGroup>

          {/* 启用状态 */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <span className="text-sm">{t('status')}</span>
            <Switch checked={form.isEnabled} onCheckedChange={val => updateField('isEnabled', val)} />
            <span className="text-muted-foreground text-sm">{form.isEnabled ? t('enabled') : t('disabled')}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
