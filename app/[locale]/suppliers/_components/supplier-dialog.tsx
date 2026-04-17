'use client'

import { Building2, CreditCard, Info, MapPin, Package, Plus, Trash2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatAmount } from '@/lib/currency'
import type { MaterialReferenceOption, SaveSupplierMaterialParams, SaveSupplierParams, SupplierMaterialItem } from '@/lib/tauri'
import {
  deleteSupplierMaterial,
  generateSupplierCode,
  getMaterialReferenceOptions,
  getSupplierDetail,
  saveSupplier,
  saveSupplierMaterial,
} from '@/lib/tauri'
import { validateSupplierForm } from './supplier-helpers'
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, GRADE_OPTIONS, SETTLEMENT_TYPE_OPTIONS } from './suppliers-content'

interface FormData {
  code: string
  name: string
  shortName: string
  country: string
  contactPerson: string
  contactPhone: string
  email: string
  businessCategory: string
  province: string
  city: string
  address: string
  bankName: string
  bankAccount: string
  taxId: string
  currency: string
  settlementType: string
  creditDays: number
  grade: string
  remark: string
  isEnabled: boolean
}

interface MaterialFormData {
  id: number | null
  materialId: string
  supplyPrice: string
  currency: 'VND' | 'CNY' | 'USD'
  leadDays: string
  minOrderQty: string
  validFrom: string
  validTo: string
  isPreferred: boolean
  remark: string
}

const EMPTY_FORM: FormData = {
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

const EMPTY_MATERIAL_FORM: MaterialFormData = {
  id: null,
  materialId: '',
  supplyPrice: '',
  currency: 'USD',
  leadDays: '7',
  minOrderQty: '',
  validFrom: '',
  validTo: '',
  isPreferred: false,
  remark: '',
}

function paramsToForm(params: SaveSupplierParams): FormData {
  return {
    code: params.code,
    name: params.name,
    shortName: params.shortName ?? '',
    country: params.country,
    contactPerson: params.contactPerson ?? '',
    contactPhone: params.contactPhone ?? '',
    email: params.email ?? '',
    businessCategory: params.businessCategory ?? '',
    province: params.province ?? '',
    city: params.city ?? '',
    address: params.address ?? '',
    bankName: params.bankName ?? '',
    bankAccount: params.bankAccount ?? '',
    taxId: params.taxId ?? '',
    currency: params.currency,
    settlementType: params.settlementType,
    creditDays: params.creditDays,
    grade: params.grade,
    remark: params.remark ?? '',
    isEnabled: params.isEnabled,
  }
}

function formToParams(form: FormData, id: number | null): SaveSupplierParams {
  return {
    id: id ?? undefined,
    code: form.code,
    name: form.name,
    shortName: form.shortName || null,
    country: form.country,
    contactPerson: form.contactPerson || null,
    contactPhone: form.contactPhone || null,
    email: form.email || null,
    businessCategory: form.businessCategory || null,
    province: form.province || null,
    city: form.city || null,
    address: form.address || null,
    bankName: form.bankName || null,
    bankAccount: form.bankAccount || null,
    taxId: form.taxId || null,
    currency: form.currency,
    settlementType: form.settlementType,
    creditDays: form.creditDays,
    grade: form.grade,
    remark: form.remark || null,
    isEnabled: form.isEnabled,
  }
}

function materialToForm(material: SupplierMaterialItem): MaterialFormData {
  return {
    id: material.id,
    materialId: material.materialId.toString(),
    supplyPrice: material.supplyPrice?.toString() ?? '',
    currency: material.currency,
    leadDays: material.leadDays.toString(),
    minOrderQty: material.minOrderQty?.toString() ?? '',
    validFrom: material.validFrom ?? '',
    validTo: material.validTo ?? '',
    isPreferred: material.isPreferred,
    remark: material.remark ?? '',
  }
}

function materialFormToParams(form: MaterialFormData, supplierId: number): SaveSupplierMaterialParams {
  return {
    id: form.id ?? undefined,
    supplierId,
    materialId: Number(form.materialId),
    supplyPrice: Number(form.supplyPrice),
    currency: form.currency,
    leadDays: Number(form.leadDays || '0'),
    minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    isPreferred: form.isPreferred,
    remark: form.remark || null,
  }
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
      <Icon className="text-primary size-4" />
      {title}
    </h3>
  )
}

function formatQuotedAmount(amount: number | null, currency: 'VND' | 'CNY' | 'USD') {
  if (amount === null) return '—'
  return formatAmount(amount, currency)
}

interface SupplierSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: number | null
  onSaved: (options?: { close?: boolean }) => void | Promise<void>
}

export function SupplierDialog({ open, onOpenChange, supplierId, onSaved }: SupplierSheetProps) {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  const [createdSupplierId, setCreatedSupplierId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('basic')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [materials, setMaterials] = useState<SupplierMaterialItem[]>([])
  const [materialOptions, setMaterialOptions] = useState<MaterialReferenceOption[]>([])
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [materialForm, setMaterialForm] = useState<MaterialFormData>(EMPTY_MATERIAL_FORM)
  const [materialSaving, setMaterialSaving] = useState(false)
  const effectiveSupplierId = supplierId ?? createdSupplierId
  const isEdit = effectiveSupplierId !== null

  const countryItems = useMemo(() => COUNTRY_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const gradeItems = useMemo(() => GRADE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const currencyItems = useMemo(() => CURRENCY_OPTIONS.map(option => ({ ...option })), [])
  const settlementItems = useMemo(() => SETTLEMENT_TYPE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) })), [t])
  const materialItems = useMemo(
    () =>
      materialOptions.map(option => ({
        value: option.id.toString(),
        label: `${option.code} · ${option.name}`,
      })),
    [materialOptions],
  )

  const resetMaterialDialog = useCallback(() => {
    setMaterialForm(EMPTY_MATERIAL_FORM)
    setMaterialDialogOpen(false)
  }, [])

  const initForm = useCallback(async () => {
    setActiveTab('basic')
    setErrors({})
    setLoadingDetail(true)

    try {
      const [options, codeOrDetail] = await Promise.all([
        getMaterialReferenceOptions(),
        supplierId === null ? generateSupplierCode() : getSupplierDetail(supplierId),
      ])

      setMaterialOptions(options)

      if (supplierId === null) {
        setForm({ ...EMPTY_FORM, code: codeOrDetail as string })
        setMaterials([])
      } else {
        const detail = codeOrDetail as Awaited<ReturnType<typeof getSupplierDetail>>
        setForm(paramsToForm(detail.supplier))
        setMaterials(detail.supplyMaterials)
      }
    } catch (error) {
      console.error('初始化供应商弹窗失败', error)
      toast.error(t('loadError'))
    } finally {
      setLoadingDetail(false)
    }
  }, [supplierId, t])

  useEffect(() => {
    if (open) {
      setCreatedSupplierId(null)
      void initForm()
    } else {
      setCreatedSupplierId(null)
      resetMaterialDialog()
    }
  }, [open, initForm, resetMaterialDialog])

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleSubmit = async () => {
    const result = validateSupplierForm({
      name: form.name,
      contactPerson: form.contactPerson,
      contactPhone: form.contactPhone,
      email: form.email,
      taxId: form.taxId,
      bankAccount: form.bankAccount,
    })

    if (Object.keys(result).length > 0) {
      setErrors(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, t(`validation.${value}`)])))
      return
    }

    setSaving(true)
    try {
      const savedId = await saveSupplier(formToParams(form, effectiveSupplierId))
      if (effectiveSupplierId === null) {
        setCreatedSupplierId(savedId)
        const detail = await getSupplierDetail(savedId)
        setForm(paramsToForm(detail.supplier))
        setMaterials(detail.supplyMaterials)
        setActiveTab('materials')
        await onSaved({ close: false })
      } else {
        await onSaved()
      }
      toast.success(t('saveSuccess'))
    } catch (error) {
      console.error('保存供应商失败', error)
      toast.error(typeof error === 'string' ? error : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const openCreateMaterial = () => {
    if (!effectiveSupplierId) {
      toast.error(t('saveSupplierBeforeMaterials'))
      return
    }
    setMaterialForm(EMPTY_MATERIAL_FORM)
    setMaterialDialogOpen(true)
  }

  const openEditMaterial = (item: SupplierMaterialItem) => {
    setMaterialForm(materialToForm(item))
    setMaterialDialogOpen(true)
  }

  const handleMaterialSubmit = async () => {
    if (!effectiveSupplierId) {
      return
    }

    if (!materialForm.materialId || !materialForm.supplyPrice.trim()) {
      toast.error(t('materialValidationRequired'))
      return
    }

    setMaterialSaving(true)
    try {
      await saveSupplierMaterial(materialFormToParams(materialForm, effectiveSupplierId))
      const detail = await getSupplierDetail(effectiveSupplierId)
      setMaterials(detail.supplyMaterials)
      toast.success(t('materialSaveSuccess'))
      resetMaterialDialog()
    } catch (error) {
      console.error('保存供应物料失败', error)
      toast.error(typeof error === 'string' ? error : t('materialSaveError'))
    } finally {
      setMaterialSaving(false)
    }
  }

  const handleDeleteMaterial = async (id: number) => {
    try {
      await deleteSupplierMaterial(id)
      if (effectiveSupplierId) {
        const detail = await getSupplierDetail(effectiveSupplierId)
        setMaterials(detail.supplyMaterials)
      } else {
        setMaterials(prev => prev.filter(item => item.id !== id))
      }
      toast.success(t('materialDeleteSuccess'))
    } catch (error) {
      console.error('删除供应物料失败', error)
      toast.error(typeof error === 'string' ? error : t('materialDeleteError'))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle>{isEdit ? t('editSupplier') : t('addSupplier')}</DialogTitle>
            <DialogDescription>{isEdit ? t('editDescription') : t('addDescription')}</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList variant="line" className="px-6">
              <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
              <TabsTrigger value="materials">{t('supplyMaterials')}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="flex-1 overflow-y-auto px-6 py-4">
              {loadingDetail ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <SectionTitle icon={Building2} title={t('basicInfo')} />
                    <FieldGroup>
                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel>{t('code')}</FieldLabel>
                          <Input value={form.code} readOnly className="bg-muted font-mono" />
                        </Field>
                        <Field data-invalid={!!errors.name || undefined}>
                          <FieldLabel>
                            {t('name')} <span className="text-destructive">*</span>
                          </FieldLabel>
                          <Input value={form.name} onChange={event => updateField('name', event.target.value)} />
                          <FieldError>{errors.name}</FieldError>
                        </Field>
                        <Field>
                          <FieldLabel>{t('shortName')}</FieldLabel>
                          <Input value={form.shortName} onChange={event => updateField('shortName', event.target.value)} />
                        </Field>
                        <Field>
                          <FieldLabel>{t('country')}</FieldLabel>
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
                        <Field>
                          <FieldLabel>{t('businessCategory')}</FieldLabel>
                          <Input value={form.businessCategory} onChange={event => updateField('businessCategory', event.target.value)} />
                        </Field>
                        <Field data-invalid={!!errors.contactPerson || undefined}>
                          <FieldLabel>
                            {t('contactPerson')} <span className="text-destructive">*</span>
                          </FieldLabel>
                          <Input value={form.contactPerson} onChange={event => updateField('contactPerson', event.target.value)} />
                          <FieldError>{errors.contactPerson}</FieldError>
                        </Field>
                        <Field data-invalid={!!errors.contactPhone || undefined}>
                          <FieldLabel>
                            {t('contactPhone')} <span className="text-destructive">*</span>
                          </FieldLabel>
                          <Input value={form.contactPhone} onChange={event => updateField('contactPhone', event.target.value)} />
                          <FieldError>{errors.contactPhone}</FieldError>
                        </Field>
                        <Field data-invalid={!!errors.email || undefined}>
                          <FieldLabel>{t('email')}</FieldLabel>
                          <Input type="email" value={form.email} onChange={event => updateField('email', event.target.value)} />
                          <FieldError>{errors.email}</FieldError>
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>

                  <div className="flex flex-col gap-4">
                    <SectionTitle icon={CreditCard} title={t('settlementInfo')} />
                    <FieldGroup>
                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel>{t('grade')}</FieldLabel>
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
                        <Field>
                          <FieldLabel>{t('currency')}</FieldLabel>
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
                        <Field>
                          <FieldLabel>{t('settlementType')}</FieldLabel>
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
                        <Field>
                          <FieldLabel>{t('creditDays')}</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            value={form.creditDays}
                            onChange={event => updateField('creditDays', Number(event.target.value) || 0)}
                          />
                        </Field>
                        <Field data-invalid={!!errors.taxId || undefined}>
                          <FieldLabel>{t('taxId')}</FieldLabel>
                          <Input value={form.taxId} onChange={event => updateField('taxId', event.target.value)} />
                          <FieldError>{errors.taxId}</FieldError>
                        </Field>
                        <Field data-invalid={!!errors.bankAccount || undefined}>
                          <FieldLabel>{t('bankAccount')}</FieldLabel>
                          <Input value={form.bankAccount} onChange={event => updateField('bankAccount', event.target.value)} />
                          <FieldError>{errors.bankAccount}</FieldError>
                        </Field>
                        <Field>
                          <FieldLabel>{t('bankName')}</FieldLabel>
                          <Input value={form.bankName} onChange={event => updateField('bankName', event.target.value)} />
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>

                  <div className="flex flex-col gap-4">
                    <SectionTitle icon={MapPin} title={t('addressInfo')} />
                    <FieldGroup>
                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel>{t('province')}</FieldLabel>
                          <Input value={form.province} onChange={event => updateField('province', event.target.value)} />
                        </Field>
                        <Field>
                          <FieldLabel>{t('city')}</FieldLabel>
                          <Input value={form.city} onChange={event => updateField('city', event.target.value)} />
                        </Field>
                        <Field className="col-span-2">
                          <FieldLabel>{t('address')}</FieldLabel>
                          <Input value={form.address} onChange={event => updateField('address', event.target.value)} />
                        </Field>
                        <Field className="col-span-2">
                          <FieldLabel>{t('remark')}</FieldLabel>
                          <Input value={form.remark} onChange={event => updateField('remark', event.target.value)} />
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Info className="size-3.5" />
                      {t('requiredHint')}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{t('isEnabled')}</span>
                      <Switch checked={form.isEnabled} onCheckedChange={value => updateField('isEnabled', value)} />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="materials" className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <SectionTitle icon={Package} title={t('supplyMaterials')} />
                  <Button size="sm" onClick={openCreateMaterial}>
                    <Plus data-icon="inline-start" />
                    {t('addMaterial')}
                  </Button>
                </div>

                {materials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                    <Package className="text-muted-foreground size-8" />
                    <p className="text-muted-foreground max-w-sm text-sm">{t('noMaterials')}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('materialName')}</TableHead>
                          <TableHead>{t('quotePrice')}</TableHead>
                          <TableHead>{t('leadDays')}</TableHead>
                          <TableHead>{t('minOrderQty')}</TableHead>
                          <TableHead>{t('preferredSupplier')}</TableHead>
                          <TableHead className="text-right">{tc('actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materials.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.materialName}</div>
                              <div className="text-muted-foreground text-xs">
                                {item.materialCode}
                                {item.materialSpec ? ` · ${item.materialSpec}` : ''}
                              </div>
                            </TableCell>
                            <TableCell>{formatQuotedAmount(item.supplyPrice, item.currency)}</TableCell>
                            <TableCell>{item.leadDays}</TableCell>
                            <TableCell>{item.minOrderQty ?? '—'}</TableCell>
                            <TableCell>{item.isPreferred ? t('yes') : t('no')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openEditMaterial(item)}>
                                  {tc('edit')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteMaterial(item.id)}>
                                  <Trash2 data-icon="inline-start" />
                                  {tc('delete')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={saving || loadingDetail}>
              {t('confirmSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{materialForm.id ? t('editMaterial') : t('addMaterial')}</DialogTitle>
            <DialogDescription>{t('materialDialogDescription')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>{t('materialName')}</FieldLabel>
                <Select
                  value={materialForm.materialId}
                  onValueChange={value => value && setMaterialForm(prev => ({ ...prev, materialId: value }))}
                  items={materialItems}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('materialPlaceholder')} />
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
                <FieldLabel>{t('quotePrice')}</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={materialForm.supplyPrice}
                  onChange={event => setMaterialForm(prev => ({ ...prev, supplyPrice: event.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>{t('currency')}</FieldLabel>
                <Select
                  value={materialForm.currency}
                  onValueChange={value => value && setMaterialForm(prev => ({ ...prev, currency: value as 'VND' | 'CNY' | 'USD' }))}
                  items={currencyItems}
                >
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
              <Field>
                <FieldLabel>{t('leadDays')}</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={materialForm.leadDays}
                  onChange={event => setMaterialForm(prev => ({ ...prev, leadDays: event.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>{t('minOrderQty')}</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={materialForm.minOrderQty}
                  onChange={event => setMaterialForm(prev => ({ ...prev, minOrderQty: event.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>{t('preferredSupplier')}</FieldLabel>
                <div className="flex h-8 items-center">
                  <Switch checked={materialForm.isPreferred} onCheckedChange={value => setMaterialForm(prev => ({ ...prev, isPreferred: value }))} />
                </div>
              </Field>
              <Field>
                <FieldLabel>{t('validFrom')}</FieldLabel>
                <Input
                  type="date"
                  value={materialForm.validFrom}
                  onChange={event => setMaterialForm(prev => ({ ...prev, validFrom: event.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>{t('validTo')}</FieldLabel>
                <Input
                  type="date"
                  value={materialForm.validTo}
                  onChange={event => setMaterialForm(prev => ({ ...prev, validTo: event.target.value }))}
                />
              </Field>
              <Field className="col-span-2">
                <FieldLabel>{t('remark')}</FieldLabel>
                <Input value={materialForm.remark} onChange={event => setMaterialForm(prev => ({ ...prev, remark: event.target.value }))} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={resetMaterialDialog}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleMaterialSubmit} disabled={materialSaving}>
              {t('confirmSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
