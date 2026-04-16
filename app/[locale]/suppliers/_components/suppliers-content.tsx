'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SupplierListItem } from '@/lib/tauri'
import { getSupplierCategories, getSuppliers, toggleSupplierStatus } from '@/lib/tauri'
import { SupplierSheet } from './supplier-sheet'
import { SupplierTable } from './supplier-table'

// ================================================================
// 常量
// ================================================================

/** 国家选项 */
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

/** 等级选项 */
export const GRADE_OPTIONS = [
  { value: 'A', labelKey: 'gradeA' },
  { value: 'B', labelKey: 'gradeB' },
  { value: 'C', labelKey: 'gradeC' },
  { value: 'D', labelKey: 'gradeD' },
] as const

/** 结算方式选项 */
export const SETTLEMENT_TYPE_OPTIONS = [
  { value: 'cash', labelKey: 'cash' },
  { value: 'monthly', labelKey: 'monthly' },
  { value: 'quarterly', labelKey: 'quarterly' },
] as const

/** 币种选项 */
export const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'USD', label: 'USD ($)' },
] as const

// ================================================================
// 每页条数
// ================================================================

const PAGE_SIZE = 10

// ================================================================
// 主组件
// ================================================================

/** 供应商管理页面主容器 */
export function SuppliersContent() {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  // 列表数据（来自后端）
  const [items, setItems] = useState<SupplierListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)

  // 经营类别选项（从后端动态加载）
  const [categories, setCategories] = useState<string[]>([])

  // 抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null)

  // 加载供应商列表
  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSuppliers({
        keyword: keyword || undefined,
        country: countryFilter !== 'all' ? countryFilter : undefined,
        businessCategory: categoryFilter !== 'all' ? categoryFilter : undefined,
        grade: gradeFilter !== 'all' ? gradeFilter : undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      console.error('加载供应商失败', err)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [keyword, countryFilter, categoryFilter, gradeFilter, currentPage, t])

  // 加载经营类别列表
  const loadCategories = useCallback(async () => {
    try {
      const cats = await getSupplierCategories()
      setCategories(cats)
    } catch (err) {
      console.error('加载经营类别失败', err)
    }
  }, [])

  // 初始加载 + 筛选条件变化时重新加载
  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // 分页
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // 构建 Select 的 items（需要传给 Select 以确保 SelectValue 正确显示）
  const countrySelectItems = useMemo(
    () => [{ value: 'all', label: t('allCountries') }, ...COUNTRY_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))],
    [t],
  )

  const categorySelectItems = useMemo(
    () => [{ value: 'all', label: t('allCategories') }, ...categories.map(c => ({ value: c, label: c }))],
    [t, categories],
  )

  const gradeSelectItems = useMemo(
    () => [{ value: 'all', label: t('allGrades') }, ...GRADE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))],
    [t],
  )

  // 筛选条件变更时重置页码
  const handleFilterChange = <T,>(setter: (val: T) => void) => {
    return (val: T) => {
      setter(val)
      setCurrentPage(1)
    }
  }

  const handleReset = () => {
    setKeyword('')
    setCountryFilter('all')
    setCategoryFilter('all')
    setGradeFilter('all')
    setCurrentPage(1)
  }

  const handleAdd = () => {
    setEditingSupplierId(null)
    setSheetOpen(true)
  }

  const handleEdit = (supplier: SupplierListItem) => {
    setEditingSupplierId(supplier.id)
    setSheetOpen(true)
  }

  /** 切换供应商启用/禁用状态 */
  const handleToggleStatus = async (supplier: SupplierListItem) => {
    try {
      await toggleSupplierStatus(supplier.id, !supplier.isEnabled)
      toast.success(t('statusChangeSuccess'))
      loadSuppliers()
    } catch (err) {
      console.error('切换状态失败', err)
      toast.error(t('saveError'))
    }
  }

  /** 保存成功后刷新列表 */
  const handleSaved = () => {
    setSheetOpen(false)
    loadSuppliers()
    loadCategories()
  }

  // 生成分页按钮范围
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }, [currentPage, totalPages])

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      {/* 搜索与筛选栏 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          {/* 关键词搜索 */}
          <div className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={keyword}
                onChange={e => handleFilterChange(setKeyword)(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>

          {/* 国家筛选 */}
          <div className="w-[160px]">
            <Select value={countryFilter} onValueChange={val => val && handleFilterChange(setCountryFilter)(val)} items={countrySelectItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countrySelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 经营类别筛选 */}
          <div className="w-[160px]">
            <Select value={categoryFilter} onValueChange={val => val && handleFilterChange(setCategoryFilter)(val)} items={categorySelectItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorySelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 等级筛选 */}
          <div className="w-[140px]">
            <Select value={gradeFilter} onValueChange={val => val && handleFilterChange(setGradeFilter)(val)} items={gradeSelectItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gradeSelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 操作按钮 */}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4" />
            {tc('reset')}
          </Button>
        </div>
      </div>

      {/* 操作按钮栏 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleAdd} className="gap-1.5">
          <Plus className="size-4" />
          {t('addSupplier')}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => toast.info('导出功能即将上线')}>
          <Download className="size-4" />
          {t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <SupplierTable suppliers={items} loading={loading} onEdit={handleEdit} onToggleStatus={handleToggleStatus} />

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{t('totalRecords', { count: total })}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
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
            <Button variant="outline" size="icon-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <span className="text-xs">›</span>
            </Button>
          </div>
        </div>
      )}

      {/* 编辑/新增抽屉 */}
      <SupplierSheet open={sheetOpen} onOpenChange={setSheetOpen} supplierId={editingSupplierId} onSaved={handleSaved} />
    </div>
  )
}
