'use client'

import { Plus, Search, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatAmount } from '@/lib/currency'
import type { SupplierMaterialForPurchase } from '@/lib/tauri'

export interface PurchaseMaterialPickerDraft {
  materialId: number
  materialCode: string
  materialName: string
  spec: string
  unitId: number
  unitName: string
  conversionRate: number
  quantity: string
  unitPrice: string
  amount: number
  remark: string
}

interface DraftLine extends PurchaseMaterialPickerDraft {
  key: string
}

interface PurchaseMaterialPickerDialogProps {
  open: boolean
  supplierSelected: boolean
  materials: SupplierMaterialForPurchase[]
  currency: 'VND' | 'CNY' | 'USD'
  existingMaterialIds: number[]
  onOpenChange: (open: boolean) => void
  onConfirm: (items: PurchaseMaterialPickerDraft[]) => void
}

function calculateLineAmount(quantity: string, unitPrice: string) {
  const qty = parseFloat(quantity) || 0
  const price = parseInt(unitPrice) || 0
  return Math.round(qty * price)
}

function createDraft(material: SupplierMaterialForPurchase): DraftLine {
  const unitPrice = String(material.unitPrice || 0)
  return {
    key: `draft-${material.materialId}-${Date.now()}`,
    materialId: material.materialId,
    materialCode: material.materialCode,
    materialName: material.materialName,
    spec: material.spec ?? '',
    unitId: material.unitId,
    unitName: material.unitName ?? '',
    conversionRate: material.conversionRate || 1,
    quantity: '1',
    unitPrice,
    amount: calculateLineAmount('1', unitPrice),
    remark: '',
  }
}

export function PurchaseMaterialPickerDialog({
  open,
  supplierSelected,
  materials,
  currency,
  existingMaterialIds,
  onOpenChange,
  onConfirm,
}: PurchaseMaterialPickerDialogProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')
  const [drafts, setDrafts] = useState<DraftLine[]>([])
  const [keyword, setKeyword] = useState('')

  const existingSet = useMemo(() => new Set(existingMaterialIds), [existingMaterialIds])
  const draftSet = useMemo(() => new Set(drafts.map(item => item.materialId)), [drafts])

  useEffect(() => {
    if (!open) return
    setKeyword('')
    setDrafts([])
  }, [open])

  const filteredMaterials = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return materials
    return materials.filter(item =>
      [item.materialCode, item.materialName, item.spec ?? '', item.unitName ?? ''].some(value => value.toLowerCase().includes(normalized)),
    )
  }, [materials, keyword])

  const addMaterial = (material: SupplierMaterialForPurchase) => {
    if (existingSet.has(material.materialId) || draftSet.has(material.materialId)) return
    setDrafts(prev => [...prev, createDraft(material)])
  }

  const updateDraft = (key: string, field: 'quantity' | 'unitPrice' | 'remark', value: string) => {
    setDrafts(prev =>
      prev.map(item => {
        if (item.key !== key) return item
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = calculateLineAmount(updated.quantity, updated.unitPrice)
        }
        return updated
      }),
    )
  }

  const removeDraft = (key: string) => {
    setDrafts(prev => prev.filter(item => item.key !== key))
  }

  const handleConfirm = () => {
    const invalid = drafts.find(item => (parseFloat(item.quantity) || 0) <= 0 || (parseInt(item.unitPrice) || 0) < 0)
    if (invalid) {
      toast.error(t('materialDraftInvalid'))
      return
    }

    onConfirm(drafts.map(({ key: _key, ...item }) => item))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t('addMaterialDialogTitle')}</DialogTitle>
          <DialogDescription>{t('addMaterialDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                placeholder={t('searchSupplierMaterialPlaceholder')}
                disabled={!supplierSelected}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
              {!supplierSelected ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">{t('pleaseSelectSupplierFirst')}</div>
              ) : filteredMaterials.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">{t('noMaterialMatches')}</div>
              ) : (
                <div className="divide-y">
                  {filteredMaterials.map(material => {
                    const disabled = existingSet.has(material.materialId) || draftSet.has(material.materialId)
                    return (
                      <div key={material.materialId} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{material.materialCode}</span>
                            <span className="truncate font-medium">{material.materialName}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{material.spec || '—'}</span>
                            <span>{material.unitName || '—'}</span>
                            <span>
                              {t('unitPrice')}: {formatAmount(material.unitPrice, currency)}
                            </span>
                            {material.leadDays !== null && (
                              <span>
                                {t('leadDays')}: {material.leadDays}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant={disabled ? 'secondary' : 'outline'} disabled={disabled} onClick={() => addMaterial(material)}>
                          {existingSet.has(material.materialId) ? t('alreadyAdded') : draftSet.has(material.materialId) ? t('selected') : t('add')}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="font-medium">{t('pendingMaterials')}</h3>
              <span className="text-xs text-muted-foreground">{t('selectedCount', { count: drafts.length })}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {drafts.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">{t('noPendingMaterials')}</div>
              ) : (
                <div className="divide-y">
                  {drafts.map(item => (
                    <div key={item.key} className="grid gap-3 px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{item.materialName}</div>
                          <div className="font-mono text-xs text-muted-foreground">{item.materialCode}</div>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeDraft(item.key)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">{t('purchaseQuantity')}</Label>
                          <Input
                            className="h-8 text-right font-mono"
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.quantity}
                            onChange={event => updateDraft(item.key, 'quantity', event.target.value)}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">{t('unitPrice')}</Label>
                          <Input
                            className="h-8 text-right font-mono"
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={event => updateDraft(item.key, 'unitPrice', event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">{t('remark')}</Label>
                        <Input className="h-8" value={item.remark} onChange={event => updateDraft(item.key, 'remark', event.target.value)} />
                      </div>

                      <div className="text-right text-sm font-medium">{formatAmount(item.amount, currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button disabled={drafts.length === 0} onClick={handleConfirm}>
            <Plus className="size-4" />
            {t('confirmAddMaterials')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
