'use client'

import { Building2, CreditCard, Info, MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import type { SaveCustomerParams } from '@/lib/tauri'
import { generateCustomerCode, getCustomerById, saveCustomer } from '@/lib/tauri'
import { validateCustomerForm } from './customer-helpers'
import { COUNTRY_OPTIONS, CUSTOMER_TYPE_OPTIONS, GRADE_OPTIONS } from './customers-content'

/** 结算币种选项 */
const CURRENCY_OPTIONS = [
  { value: 'VND', labelKey: 'currency.VND' },
  { value: 'CNY', labelKey: 'currency.CNY' },
  { value: 'USD', labelKey: 'currency.USD' },
] as const

/** 结算方式选项 */
const SETTLEMENT_TYPE_OPTIONS = [
  { value: 'cash', labelKey: 'settlementType.cash' },
  { value: 'monthly', labelKey: 'settlementType.monthly' },
  { value: 'quarterly', labelKey: 'settlementType.quarterly' },
] as const

/** 表单数据类型 */
interface FormData {
  code: string
  name: string
  customerType: string
  country: string
  contactPerson: string
  contactPhone: string
  email: string
  shippingAddress: string
  currency: string
  creditLimit: number
  settlementType: string
  creditDays: number
  grade: string
  defaultDiscount: number
  remark: string
  isEnabled: boolean
}

/** 空表单默认值 */
const EMPTY_FORM: FormData = {
  code: '',
  name: '',
  customerType: 'dealer',
  country: 'VN',
  contactPerson: '',
  contactPhone: '',
  email: '',
  shippingAddress: '',
  currency: 'VND',
  creditLimit: 0,
  settlementType: 'cash',
  creditDays: 0,
  grade: 'normal',
  defaultDiscount: 0,
  remark: '',
  isEnabled: true,
}

/** 将后端返回的 SaveCustomerParams 转为表单数据 */
function paramsToForm(params: SaveCustomerParams): FormData {
  return {
    code: params.code,
    name: params.name,
    customerType: params.customerType,
    country: params.country,
    contactPerson: params.contactPerson ?? '',
    contactPhone: params.contactPhone ?? '',
    email: params.email ?? '',
    shippingAddress: params.shippingAddress ?? '',
    currency: params.currency,
    creditLimit: params.creditLimit,
    settlementType: params.settlementType,
    creditDays: params.creditDays,
    grade: params.grade,
    defaultDiscount: params.defaultDiscount,
    remark: params.remark ?? '',
    isEnabled: params.isEnabled,
  }
}

/** 将表单数据转为后端保存参数 */
function formToParams(form: FormData, id: number | null): SaveCustomerParams {
  return {
    id: id ?? undefined,
    code: form.code,
    name: form.name,
    customerType: form.customerType,
    country: form.country,
    contactPerson: form.contactPerson || null,
    contactPhone: form.contactPhone || null,
    email: form.email || null,
    shippingAddress: form.shippingAddress || null,
    currency: form.currency,
    creditLimit: form.creditLimit,
    settlementType: form.settlementType,
    creditDays: form.creditDays,
    grade: form.grade,
    defaultDiscount: form.defaultDiscount,
    remark: form.remark || null,
    isEnabled: form.isEnabled,
  }
}

/** 分区标题组件 */
function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
      <Icon className="text-primary size-4" />
      {title}
    </h3>
  )
}

interface CustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number | null
  onSaved: () => void
}

export function CustomerDialog({ open, onOpenChange, customerId, onSaved }: CustomerDialogProps) {
  const t = useTranslations('customers')
  const tc = useTranslations('common')

  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEdit = customerId !== null

  /* ---- Select items（含翻译） ---- */
  const customerTypeItems = useMemo(() => CUSTOMER_TYPE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const countryItems = useMemo(() => COUNTRY_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const currencyItems = useMemo(() => CURRENCY_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const settlementItems = useMemo(() => SETTLEMENT_TYPE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const gradeItems = useMemo(() => GRADE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])

  /** 初始化表单：新增模式生成编码，编辑模式加载数据 */
  const initForm = useCallback(async () => {
    setErrors({})
    setLoadingDetail(true)

    try {
      if (customerId === null) {
        const code = await generateCustomerCode()
        setForm({ ...EMPTY_FORM, code })
      } else {
        const data = await getCustomerById(customerId)
        setForm(paramsToForm(data))
      }
    } catch (error) {
      console.error('初始化客户弹窗失败', error)
      toast.error(t('toast.loadError'))
    } finally {
      setLoadingDetail(false)
    }
  }, [customerId, t])

  useEffect(() => {
    if (open) {
      void initForm()
    }
  }, [open, initForm])

  /** 更新单个字段并清除该字段的校验错误 */
  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 提交表单 */
  const handleSubmit = async () => {
    const result = validateCustomerForm({
      name: form.name,
      contactPerson: form.contactPerson,
      contactPhone: form.contactPhone,
      email: form.email,
    })

    if (Object.keys(result).length > 0) {
      setErrors(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, t(`validation.${value}`)])))
      return
    }

    setSaving(true)
    try {
      await saveCustomer(formToParams(form, customerId))
      toast.success(t('toast.saveSuccess'))
      onSaved()
    } catch (error) {
      console.error('保存客户失败', error)
      toast.error(typeof error === 'string' ? error : t('toast.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>{isEdit ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
          <DialogDescription>{isEdit ? t('dialog.editDescription') : t('dialog.addDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingDetail ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* 基本信息区 */}
              <div className="flex flex-col gap-4">
                <SectionTitle icon={Building2} title={t('section.basicInfo')} />
                <FieldGroup>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 客户编码 */}
                    <Field>
                      <FieldLabel>{t('form.code')}</FieldLabel>
                      <Input value={form.code} readOnly className="bg-muted font-mono" placeholder={t('placeholder.code')} />
                    </Field>
                    {/* 客户名称 */}
                    <Field data-invalid={!!errors.name || undefined}>
                      <FieldLabel>
                        {t('form.name')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input value={form.name} onChange={event => updateField('name', event.target.value)} placeholder={t('placeholder.name')} />
                      <FieldError>{errors.name}</FieldError>
                    </Field>
                    {/* 客户类型 */}
                    <Field>
                      <FieldLabel>
                        {t('form.customerType')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        value={form.customerType}
                        onValueChange={value => value && updateField('customerType', value)}
                        items={customerTypeItems}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customerTypeItems.map(item => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {/* 国家/地区 */}
                    <Field>
                      <FieldLabel>
                        {t('form.country')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select value={form.country} onValueChange={value => value && updateField('country', value)} items={countryItems}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countryItems.map(item => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {/* 联系人 */}
                    <Field data-invalid={!!errors.contactPerson || undefined}>
                      <FieldLabel>
                        {t('form.contactPerson')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        value={form.contactPerson}
                        onChange={event => updateField('contactPerson', event.target.value)}
                        placeholder={t('placeholder.contactPerson')}
                      />
                      <FieldError>{errors.contactPerson}</FieldError>
                    </Field>
                    {/* 联系电话 */}
                    <Field data-invalid={!!errors.contactPhone || undefined}>
                      <FieldLabel>
                        {t('form.contactPhone')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        value={form.contactPhone}
                        onChange={event => updateField('contactPhone', event.target.value)}
                        placeholder={t('placeholder.contactPhone')}
                      />
                      <FieldError>{errors.contactPhone}</FieldError>
                    </Field>
                    {/* 电子邮箱 */}
                    <Field data-invalid={!!errors.email || undefined}>
                      <FieldLabel>{t('form.email')}</FieldLabel>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={event => updateField('email', event.target.value)}
                        placeholder={t('placeholder.email')}
                      />
                      <FieldError>{errors.email}</FieldError>
                    </Field>
                    {/* 默认收货地址 */}
                    <Field>
                      <FieldLabel>{t('form.shippingAddress')}</FieldLabel>
                      <Input
                        value={form.shippingAddress}
                        onChange={event => updateField('shippingAddress', event.target.value)}
                        placeholder={t('placeholder.shippingAddress')}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </div>

              {/* 结算信息区 */}
              <div className="flex flex-col gap-4">
                <SectionTitle icon={CreditCard} title={t('section.settlementInfo')} />
                <FieldGroup>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 结算币种 */}
                    <Field>
                      <FieldLabel>
                        {t('form.currency')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select value={form.currency} onValueChange={value => value && updateField('currency', value)} items={currencyItems}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyItems.map(item => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {/* 信用额度 */}
                    <Field>
                      <FieldLabel>{t('form.creditLimit')}</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        value={form.creditLimit}
                        onChange={event => updateField('creditLimit', Number(event.target.value) || 0)}
                        placeholder={t('placeholder.creditLimit')}
                      />
                    </Field>
                    {/* 结算方式 */}
                    <Field>
                      <FieldLabel>
                        {t('form.settlementType')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        value={form.settlementType}
                        onValueChange={value => value && updateField('settlementType', value)}
                        items={settlementItems}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {settlementItems.map(item => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {/* 账期天数 */}
                    <Field>
                      <FieldLabel>{t('form.creditDays')}</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        value={form.creditDays}
                        onChange={event => updateField('creditDays', Number(event.target.value) || 0)}
                        placeholder={t('placeholder.creditDays')}
                      />
                    </Field>
                    {/* 客户等级 */}
                    <Field>
                      <FieldLabel>
                        {t('form.grade')} <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select value={form.grade} onValueChange={value => value && updateField('grade', value)} items={gradeItems}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeItems.map(item => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {/* 默认折扣 */}
                    <Field>
                      <FieldLabel>{t('form.defaultDiscount')}</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.defaultDiscount}
                        onChange={event => updateField('defaultDiscount', Number(event.target.value) || 0)}
                        placeholder={t('placeholder.defaultDiscount')}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </div>

              {/* 其他信息区 */}
              <div className="flex flex-col gap-4">
                <SectionTitle icon={MessageSquare} title={t('section.otherInfo')} />
                <FieldGroup>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 备注 */}
                    <Field className="col-span-2">
                      <FieldLabel>{t('form.remark')}</FieldLabel>
                      <Input
                        value={form.remark}
                        onChange={event => updateField('remark', event.target.value)}
                        placeholder={t('placeholder.remark')}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </div>

              {/* 底部提示 + 启用状态 */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Info className="size-3.5" />
                  {t('requiredHint')}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{t('form.isEnabled')}</span>
                  <Switch checked={form.isEnabled} onCheckedChange={value => updateField('isEnabled', value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || loadingDetail}>
            {t('action.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
