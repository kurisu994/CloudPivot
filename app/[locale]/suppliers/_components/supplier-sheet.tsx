'use client'

import { Building2, CreditCard, Info, MapPin, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Supplier, SupplierFormData } from './suppliers-content'
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, GRADE_OPTIONS, SETTLEMENT_TYPE_OPTIONS } from './suppliers-content'

// ================================================================
// 空表单默认值
// ================================================================

const EMPTY_FORM: SupplierFormData = {
  code: '',
  name: '',
  shortName: '',
  country: 'VN',
  contactPerson: '',
  contactPhone: '',
  email: '',
  businessCategory: '',
  province: '',
  city: '',
  address: '',
  bankName: '',
  bankAccount: '',
  taxId: '',
  currency: 'USD',
  settlementType: 'cash',
  creditDays: 0,
  grade: 'B',
  remark: '',
  isEnabled: true,
}

/** 从 Supplier 实体构建表单数据 */
function supplierToForm(s: Supplier): SupplierFormData {
  return {
    code: s.code,
    name: s.name,
    shortName: s.shortName,
    country: s.country,
    contactPerson: s.contactPerson,
    contactPhone: s.contactPhone,
    email: s.email,
    businessCategory: s.businessCategory,
    province: s.province,
    city: s.city,
    address: s.address,
    bankName: s.bankName,
    bankAccount: s.bankAccount,
    taxId: s.taxId,
    currency: s.currency,
    settlementType: s.settlementType,
    creditDays: s.creditDays,
    grade: s.grade,
    remark: s.remark,
    isEnabled: s.isEnabled,
  }
}

// ================================================================
// 子组件
// ================================================================

/** 表单分区标题 */
function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
      <Icon className="text-primary size-4" />
      {title}
    </h3>
  )
}

/** 表单字段容器 */
function FormField({ label, required, children, fullWidth }: { label: string; required?: boolean; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <Label className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ================================================================
// 主组件
// ================================================================

interface SupplierSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑模式时传入现有供应商，新增模式传 null */
  supplier: Supplier | null
  onSave: (data: SupplierFormData) => void
}

/** 供应商新增/编辑抽屉面板 */
export function SupplierSheet({ open, onOpenChange, supplier, onSave }: SupplierSheetProps) {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')
  const isEdit = !!supplier

  const [form, setForm] = useState<SupplierFormData>(EMPTY_FORM)
  const [activeTab, setActiveTab] = useState<string>('basic')

  // 打开时初始化表单数据
  useEffect(() => {
    if (open) {
      setForm(supplier ? supplierToForm(supplier) : { ...EMPTY_FORM, code: generateCode() })
      setActiveTab('basic')
    }
  }, [open, supplier])

  const updateField = <K extends keyof SupplierFormData>(key: K, value: SupplierFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    // 简单的必填校验
    if (!form.name.trim()) return
    onSave(form)
  }

  // 构建 Select 的 items 数组
  const countryItems = useMemo(() => COUNTRY_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })), [t])
  const gradeItems = useMemo(() => GRADE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })), [t])
  const currencyItems = useMemo(() => CURRENCY_OPTIONS.map(o => ({ ...o })), [])
  const settlementItems = useMemo(() => SETTLEMENT_TYPE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })), [t])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-2xl" showCloseButton>
        {/* 头部 */}
        <SheetHeader>
          <SheetTitle>{isEdit ? t('editSupplier') : t('addSupplier')}</SheetTitle>
          <SheetDescription>{isEdit ? t('editDescription') : t('addDescription')}</SheetDescription>
        </SheetHeader>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={val => val && setActiveTab(val as string)} className="flex min-h-0 flex-1 flex-col">
          <TabsList variant="line" className="shrink-0 px-4">
            <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
            <TabsTrigger value="materials">{t('supplyMaterials')}</TabsTrigger>
          </TabsList>

          {/* 基本信息 Tab */}
          <TabsContent value="basic" className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-6 pt-4">
              {/* 基本信息 */}
              <div className="space-y-4">
                <SectionTitle icon={Building2} title={t('basicInfo')} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('code')} required>
                    <Input value={form.code} readOnly className="bg-muted font-mono text-sm" />
                  </FormField>
                  <FormField label={t('name')} required>
                    <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder={t('namePlaceholder')} />
                  </FormField>
                  <FormField label={t('shortName')}>
                    <Input value={form.shortName} onChange={e => updateField('shortName', e.target.value)} placeholder={t('shortNamePlaceholder')} />
                  </FormField>
                  <FormField label={t('country')} required>
                    <Select value={form.country} onValueChange={val => val && updateField('country', val)} items={countryItems}>
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
                  </FormField>
                  <FormField label={t('businessCategory')}>
                    <Input
                      value={form.businessCategory}
                      onChange={e => updateField('businessCategory', e.target.value)}
                      placeholder={t('categoryPlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('contactPerson')}>
                    <Input
                      value={form.contactPerson}
                      onChange={e => updateField('contactPerson', e.target.value)}
                      placeholder={t('contactPersonPlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('contactPhone')}>
                    <Input
                      value={form.contactPhone}
                      onChange={e => updateField('contactPhone', e.target.value)}
                      placeholder={t('contactPhonePlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('email')}>
                    <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder={t('emailPlaceholder')} />
                  </FormField>
                </div>
              </div>

              {/* 结算信息 */}
              <div className="space-y-4">
                <SectionTitle icon={CreditCard} title={t('settlementInfo')} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('grade')}>
                    <Select value={form.grade} onValueChange={val => val && updateField('grade', val)} items={gradeItems}>
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
                  </FormField>
                  <FormField label={t('currency')} required>
                    <Select value={form.currency} onValueChange={val => val && updateField('currency', val)} items={currencyItems}>
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
                  </FormField>
                  <FormField label={t('settlementType')}>
                    <Select value={form.settlementType} onValueChange={val => val && updateField('settlementType', val)} items={settlementItems}>
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
                  </FormField>
                  <FormField label={t('creditDays')}>
                    <Input
                      type="number"
                      min={0}
                      value={form.creditDays}
                      onChange={e => updateField('creditDays', Number.parseInt(e.target.value) || 0)}
                      placeholder={t('creditDaysPlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('taxId')} fullWidth>
                    <Input value={form.taxId} onChange={e => updateField('taxId', e.target.value)} placeholder={t('taxIdPlaceholder')} />
                  </FormField>
                </div>
              </div>

              {/* 地址信息 */}
              <div className="space-y-4">
                <SectionTitle icon={MapPin} title={t('addressInfo')} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('province')}>
                    <Input value={form.province} onChange={e => updateField('province', e.target.value)} placeholder={t('provincePlaceholder')} />
                  </FormField>
                  <FormField label={t('city')}>
                    <Input value={form.city} onChange={e => updateField('city', e.target.value)} placeholder={t('cityPlaceholder')} />
                  </FormField>
                  <FormField label={t('address')} fullWidth>
                    <Input value={form.address} onChange={e => updateField('address', e.target.value)} placeholder={t('addressPlaceholder')} />
                  </FormField>
                </div>
              </div>

              {/* 银行信息 */}
              <div className="space-y-4">
                <SectionTitle icon={CreditCard} title={t('bankInfo')} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('bankName')}>
                    <Input value={form.bankName} onChange={e => updateField('bankName', e.target.value)} placeholder={t('bankNamePlaceholder')} />
                  </FormField>
                  <FormField label={t('bankAccount')}>
                    <Input
                      value={form.bankAccount}
                      onChange={e => updateField('bankAccount', e.target.value)}
                      placeholder={t('bankAccountPlaceholder')}
                    />
                  </FormField>
                </div>
              </div>

              {/* 其他信息 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('remark')} fullWidth>
                    <Input value={form.remark} onChange={e => updateField('remark', e.target.value)} placeholder={t('remarkPlaceholder')} />
                  </FormField>
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <Label className="text-sm font-medium">{t('isEnabled')}</Label>
                    <Switch checked={form.isEnabled} onCheckedChange={val => updateField('isEnabled', !!val)} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 供应物料 Tab */}
          <TabsContent value="materials" className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Package className="text-muted-foreground size-8" />
              </div>
              <p className="text-muted-foreground max-w-sm text-center text-sm">{t('noMaterials')}</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部操作栏 */}
        <SheetFooter className="border-t border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Info className="size-3.5" />
              {t('requiredHint')}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tc('cancel')}
              </Button>
              <Button onClick={handleSubmit}>{t('confirmSave')}</Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ================================================================
// 工具函数
// ================================================================

/** 生成供应商编码（mock 用，将来由后端生成） */
function generateCode(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `SUP-${year}-${seq}`
}
