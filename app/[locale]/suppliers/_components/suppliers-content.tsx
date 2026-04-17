'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SupplierFilter, SupplierListItem } from '@/lib/tauri'
import { deleteSupplier, getSupplierCategories, getSuppliers, toggleSupplierStatus } from '@/lib/tauri'
import { SupplierDetailDialog } from './supplier-detail-dialog'
import { buildToggleSupplierStatusArgs } from './supplier-helpers'
import { SupplierDialog } from './supplier-dialog'
import { SupplierTable } from './supplier-table'

export const COUNTRY_OPTIONS = [
  { value: 'VN', labelKey: 'countryVN' },
  { value: 'CN', labelKey: 'countryCN' },
  { value: 'MY', labelKey: 'countryMY' },
  { value: 'ID', labelKey: 'countryID' },
  { value: 'TH', labelKey: 'countryTH' },
  { value: 'US', labelKey: 'countryUS' },
  { value: 'EU', labelKey: 'countryEU' },
  { value: 'OTHER', labelKey: 'countryOTHER' },
] as const

export const GRADE_OPTIONS = [
  { value: 'A', labelKey: 'gradeA' },
  { value: 'B', labelKey: 'gradeB' },
  { value: 'C', labelKey: 'gradeC' },
  { value: 'D', labelKey: 'gradeD' },
] as const

export const SETTLEMENT_TYPE_OPTIONS = [
  { value: 'cash', labelKey: 'cash' },
  { value: 'monthly', labelKey: 'monthly' },
  { value: 'quarterly', labelKey: 'quarterly' },
] as const

export const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'USD', label: 'USD ($)' },
] as const

const PAGE_SIZE = 10

export function SuppliersContent() {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  const [items, setItems] = useState<SupplierListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftCountry, setDraftCountry] = useState('all')
  const [draftCategory, setDraftCategory] = useState('all')
  const [draftGrade, setDraftGrade] = useState('all')

  const [filters, setFilters] = useState<SupplierFilter>({
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [categories, setCategories] = useState<string[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null)
  const [detailSupplierId, setDetailSupplierId] = useState<number | null>(null)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSuppliers({ ...filters, page: currentPage, pageSize: PAGE_SIZE })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载供应商失败', error)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, t])

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getSupplierCategories())
    } catch (error) {
      console.error('加载经营类别失败', error)
    }
  }, [])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const countryItems = useMemo(
    () => [{ value: 'all', label: t('allCountries') }, ...COUNTRY_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) }))],
    [t],
  )
  const categoryItems = useMemo(
    () => [{ value: 'all', label: t('allCategories') }, ...categories.map(category => ({ value: category, label: category }))],
    [t, categories],
  )
  const gradeItems = useMemo(
    () => [{ value: 'all', label: t('allGrades') }, ...GRADE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) }))],
    [t],
  )

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      country: draftCountry !== 'all' ? draftCountry : undefined,
      businessCategory: draftCategory !== 'all' ? draftCategory : undefined,
      grade: draftGrade !== 'all' ? draftGrade : undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    })
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftCountry('all')
    setDraftCategory('all')
    setDraftGrade('all')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize: PAGE_SIZE })
  }

  const handleAdd = () => {
    setEditingSupplierId(null)
    setDialogOpen(true)
  }

  const handleEdit = (supplier: SupplierListItem) => {
    setEditingSupplierId(supplier.id)
    setDialogOpen(true)
  }

  const handleView = (supplier: SupplierListItem) => {
    setDetailSupplierId(supplier.id)
    setDetailOpen(true)
  }

  const handleToggleStatus = async (supplier: SupplierListItem) => {
    try {
      const args = buildToggleSupplierStatusArgs(supplier.id, supplier.isEnabled)
      await toggleSupplierStatus(args.id, args.is_enabled)
      toast.success(t('statusChangeSuccess'))
      await loadSuppliers()
    } catch (error) {
      console.error('切换供应商状态失败', error)
      toast.error(typeof error === 'string' ? error : t('saveError'))
    }
  }

  const handleDelete = async (supplier: SupplierListItem) => {
    const confirmed = window.confirm(t('deleteConfirm'))
    if (!confirmed) return

    try {
      await deleteSupplier(supplier.id)
      toast.success(t('deleteSuccess'))
      await loadSuppliers()
      await loadCategories()
    } catch (error) {
      console.error('删除供应商失败', error)
      toast.error(typeof error === 'string' ? error : t('deleteError'))
    }
  }

  const handleSaved = async (options?: { close?: boolean }) => {
    if (options?.close !== false) {
      setDialogOpen(false)
    }
    await loadSuppliers()
    await loadCategories()
  }

  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let index = start; index <= end; index += 1) {
      pages.push(index)
    }
    return pages
  }, [currentPage, totalPages])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={draftKeyword}
                onChange={event => setDraftKeyword(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-[160px]">
            <Select value={draftCountry} onValueChange={value => value && setDraftCountry(value)} items={countryItems}>
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
          </div>

          <div className="w-[160px]">
            <Select value={draftCategory} onValueChange={value => value && setDraftCategory(value)} items={categoryItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[140px]">
            <Select value={draftGrade} onValueChange={value => value && setDraftGrade(value)} items={gradeItems}>
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
          </div>

          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />
            {tc('reset')}
          </Button>
          <Button size="sm" onClick={handleSearch}>
            <Search data-icon="inline-start" />
            {tc('search')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleAdd}>
          <Plus data-icon="inline-start" />
          {t('addSupplier')}
        </Button>
        <Button variant="outline" onClick={() => toast.info(t('exportComingSoon'))}>
          <Download data-icon="inline-start" />
          {t('exportData')}
        </Button>
      </div>

      <SupplierTable
        suppliers={items}
        loading={loading}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{t('totalRecords', { count: total })}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(page => page - 1)}>
              <span className="text-xs">‹</span>
            </Button>
            {pageNumbers.map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => setCurrentPage(page)}
                className="min-w-8"
              >
                {page}
              </Button>
            ))}
            <Button variant="outline" size="icon-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(page => page + 1)}>
              <span className="text-xs">›</span>
            </Button>
          </div>
        </div>
      )}

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplierId={editingSupplierId} onSaved={handleSaved} />
      <SupplierDetailDialog open={detailOpen} onOpenChange={setDetailOpen} supplierId={detailSupplierId} />
    </div>
  )
}
