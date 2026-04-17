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
import { generateWarehouseCode, getWarehouseById, saveWarehouse } from '@/lib/tauri'

/** 仓库类型选项 */
const WAREHOUSE_TYPE_OPTIONS = [
  { value: 'raw', labelKey: 'typeOptions.raw' },
  { value: 'semi', labelKey: 'typeOptions.semi' },
  { value: 'finished', labelKey: 'typeOptions.finished' },
  { value: 'return', labelKey: 'typeOptions.return' },
] as const

/** 表单数据类型 */
interface FormData {
  code: string
  name: string
  warehouseType: string
  manager: string
  phone: string
  address: string
  remark: string
  isEnabled: boolean
}

/** 空表单默认值 */
const EMPTY_FORM: FormData = {
  code: '',
  name: '',
  warehouseType: 'raw',
  manager: '',
  phone: '',
  address: '',
  remark: '',
  isEnabled: true,
}

interface WarehouseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouseId: number | null
  onSuccess: () => void
}

/** 仓库新增/编辑弹窗 */
export function WarehouseDialog({ open, onOpenChange, warehouseId, onSuccess }: WarehouseDialogProps) {
  const t = useTranslations('warehouses')
  const tc = useTranslations('common')

  const isEditing = warehouseId !== null

  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Select items（含翻译）
  const typeItems = useMemo(() => WAREHOUSE_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) })), [t])

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
    if (warehouseId) {
      try {
        const wh = await getWarehouseById(warehouseId)
        setForm({
          code: wh.code,
          name: wh.name,
          warehouseType: wh.warehouse_type,
          manager: wh.manager ?? '',
          phone: wh.phone ?? '',
          address: wh.address ?? '',
          remark: wh.remark ?? '',
          isEnabled: wh.is_enabled,
        })
      } catch (e) {
        toast.error(String(e))
      }
    } else {
      setForm(EMPTY_FORM)
      // 自动生成编码
      try {
        const code = await generateWarehouseCode('raw')
        setForm(prev => ({ ...prev, code }))
      } catch {
        // 忽略编码生成失败
      }
    }
  }, [warehouseId])

  useEffect(() => {
    if (open) {
      void initForm()
    }
  }, [open, initForm])

  /** 仓库类型变更时重新生成编码（仅新增模式） */
  const handleTypeChange = async (newType: string | null) => {
    if (!newType) return
    updateField('warehouseType', newType)
    if (!isEditing) {
      try {
        const code = await generateWarehouseCode(newType)
        updateField('code', code)
      } catch {
        // 忽略编码生成失败
      }
    }
  }

  /** 提交保存 */
  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) {
      newErrors.name = t('validation.nameRequired')
    }
    if (!form.code.trim()) {
      newErrors.code = t('validation.codeRequired')
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      await saveWarehouse({
        id: warehouseId,
        code: form.code.trim(),
        name: form.name.trim(),
        warehouse_type: form.warehouseType,
        manager: form.manager.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        remark: form.remark.trim() || null,
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editWarehouse') : t('addWarehouse')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              {/* 仓库类型 */}
              <Field>
                <FieldLabel>
                  {t('type')} <span className="text-destructive">*</span>
                </FieldLabel>
                {isEditing ? (
                  <>
                    <Input value={typeItems.find(i => i.value === form.warehouseType)?.label ?? form.warehouseType} disabled className="bg-muted" />
                    <p className="text-muted-foreground mt-1 text-xs">{t('typeNotEditable')}</p>
                  </>
                ) : (
                  <Select value={form.warehouseType} onValueChange={handleTypeChange} items={typeItems}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WAREHOUSE_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {/* 仓库编码 */}
              <Field data-invalid={!!errors.code || undefined}>
                <FieldLabel>
                  {t('code')} <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  value={form.code}
                  onChange={e => updateField('code', e.target.value)}
                  disabled={isEditing}
                  className={isEditing ? 'bg-muted font-mono' : 'font-mono'}
                  placeholder="WH-RAW-001"
                />
                <FieldError>{errors.code}</FieldError>
              </Field>

              {/* 仓库名称 */}
              <Field data-invalid={!!errors.name || undefined} className="col-span-2">
                <FieldLabel>
                  {t('name')} <span className="text-destructive">*</span>
                </FieldLabel>
                <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder={t('validation.nameRequired')} />
                <FieldError>{errors.name}</FieldError>
              </Field>

              {/* 负责人 */}
              <Field>
                <FieldLabel>{t('manager')}</FieldLabel>
                <Input value={form.manager} onChange={e => updateField('manager', e.target.value)} />
              </Field>

              {/* 联系电话 */}
              <Field>
                <FieldLabel>{t('phone')}</FieldLabel>
                <Input value={form.phone} onChange={e => updateField('phone', e.target.value)} />
              </Field>

              {/* 地址 */}
              <Field className="col-span-2">
                <FieldLabel>{t('address')}</FieldLabel>
                <Input value={form.address} onChange={e => updateField('address', e.target.value)} />
              </Field>

              {/* 备注 */}
              <Field className="col-span-2">
                <FieldLabel>{t('remark')}</FieldLabel>
                <Input value={form.remark} onChange={e => updateField('remark', e.target.value)} />
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
