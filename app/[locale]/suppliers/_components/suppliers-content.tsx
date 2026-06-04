'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/lib/error'
import type { SupplierFilter, SupplierListItem } from '@/lib/tauri'
import { deleteSupplier, getSupplierCategories, getSuppliers, toggleSupplierStatus } from '@/lib/tauri'
import { SupplierDetailDialog } from './supplier-detail-dialog'
import { SupplierDialog } from './supplier-dialog'
import { buildToggleSupplierStatusArgs } from './supplier-helpers'
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

const DEFAULT_PAGE_SIZE = 50

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
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [categories, setCategories] = useState<string[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null)
  const [detailSupplierId, setDetailSupplierId] = useState<number | null>(null)

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<SupplierListItem | null>(null)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSuppliers({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载供应商失败', error)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, t])

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

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
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftCountry('all')
    setDraftCategory('all')
    setDraftGrade('all')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
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
      await toggleSupplierStatus(args.id, args.isEnabled)
      toast.success(t('statusChangeSuccess'))
      await loadSuppliers()
    } catch (error) {
      console.error('切换供应商状态失败', error)
      toast.error(getErrorMessage(error, t('saveError')))
    }
  }

  const handleDelete = (supplier: SupplierListItem) => {
    setDeleteTarget(supplier)
  }

  /** 删除供应商（确认后执行） */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteSupplier(deleteTarget.id)
      toast.success(t('deleteSuccess'))
      setDeleteTarget(null)
      await loadSuppliers()
      await loadCategories()
    } catch (error) {
      console.error('删除供应商失败', error)
      toast.error(getErrorMessage(error, t('deleteError')))
      throw error
    }
  }

  const handleSaved = async (options?: { close?: boolean }) => {
    if (options?.close !== false) {
      setDialogOpen(false)
    }
    await loadSuppliers()
    await loadCategories()
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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

      <div className="min-h-0 flex-1">
        <SupplierTable
          suppliers={items}
          loading={loading}
          total={total}
          page={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={s => {
            setPageSize(s)
            setCurrentPage(1)
          }}
          onEdit={handleEdit}
          onView={handleView}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
        />
      </div>

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplierId={editingSupplierId} onSaved={handleSaved} />
      <SupplierDetailDialog open={detailOpen} onOpenChange={setDetailOpen} supplierId={detailSupplierId} />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('deleteConfirm')}
        confirmText={tc('delete')}
        cancelText={tc('cancel')}
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
