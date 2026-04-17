'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CustomerFilter, CustomerListItem } from '@/lib/tauri'
import { deleteCustomer, getCustomers, toggleCustomerStatus } from '@/lib/tauri'
import { CustomerDetailDialog } from './customer-detail-dialog'
import { CustomerDialog } from './customer-dialog'
import { buildToggleCustomerStatusArgs } from './customer-helpers'
import { CustomerTable } from './customer-table'

/** 客户类型选项 */
export const CUSTOMER_TYPE_OPTIONS = [
  { value: 'dealer', labelKey: 'customerType.dealer' },
  { value: 'retail', labelKey: 'customerType.retail' },
  { value: 'project', labelKey: 'customerType.project' },
  { value: 'export', labelKey: 'customerType.export' },
] as const

/** 客户等级选项 */
export const GRADE_OPTIONS = [
  { value: 'vip', labelKey: 'grade.vip' },
  { value: 'normal', labelKey: 'grade.normal' },
  { value: 'new', labelKey: 'grade.new' },
] as const

/** 国家/地区选项 */
export const COUNTRY_OPTIONS = [
  { value: 'VN', labelKey: 'country.VN' },
  { value: 'CN', labelKey: 'country.CN' },
  { value: 'US', labelKey: 'country.US' },
  { value: 'EU', labelKey: 'country.EU' },
  { value: 'OTHER', labelKey: 'country.OTHER' },
] as const

const PAGE_SIZE = 10

export function CustomersContent() {
  const t = useTranslations('customers')
  const tc = useTranslations('common')

  // 列表数据
  const [items, setItems] = useState<CustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 草稿筛选状态（用户输入但未提交）
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftCustomerType, setDraftCustomerType] = useState('all')
  const [draftGrade, setDraftGrade] = useState('all')
  const [draftCountry, setDraftCountry] = useState('all')

  // 已提交的筛选条件
  const [filters, setFilters] = useState<CustomerFilter>({
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const [currentPage, setCurrentPage] = useState(1)

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)
  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null)

  /** 加载客户列表 */
  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getCustomers({ ...filters, page: currentPage, pageSize: PAGE_SIZE })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载客户失败', error)
      toast.error(t('toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, t])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Select 组件的 items（含"全部"选项）
  const customerTypeItems = useMemo(
    () => [{ value: 'all', label: t('allTypes') }, ...CUSTOMER_TYPE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) }))],
    [t],
  )
  const gradeItems = useMemo(
    () => [{ value: 'all', label: t('allGrades') }, ...GRADE_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) }))],
    [t],
  )
  const countryItems = useMemo(
    () => [{ value: 'all', label: t('allCountries') }, ...COUNTRY_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) }))],
    [t],
  )

  /** 执行搜索 */
  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      customerType: draftCustomerType !== 'all' ? draftCustomerType : undefined,
      grade: draftGrade !== 'all' ? draftGrade : undefined,
      country: draftCountry !== 'all' ? draftCountry : undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    })
  }

  /** 重置筛选 */
  const handleReset = () => {
    setDraftKeyword('')
    setDraftCustomerType('all')
    setDraftGrade('all')
    setDraftCountry('all')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize: PAGE_SIZE })
  }

  /** 新增客户 */
  const handleAdd = () => {
    setEditingCustomerId(null)
    setDialogOpen(true)
  }

  /** 编辑客户 */
  const handleEdit = (customer: CustomerListItem) => {
    setEditingCustomerId(customer.id)
    setDialogOpen(true)
  }

  /** 查看详情 */
  const handleView = (customer: CustomerListItem) => {
    setDetailCustomerId(customer.id)
    setDetailOpen(true)
  }

  /** 切换客户状态 */
  const handleToggleStatus = async (customer: CustomerListItem) => {
    try {
      const args = buildToggleCustomerStatusArgs(customer.id, customer.isEnabled)
      await toggleCustomerStatus(args.id, args.is_enabled)
      toast.success(t('toast.toggleSuccess'))
      await loadCustomers()
    } catch (error) {
      console.error('切换客户状态失败', error)
      toast.error(typeof error === 'string' ? error : t('toast.toggleError'))
    }
  }

  /** 删除客户 */
  const handleDelete = async (customer: CustomerListItem) => {
    const confirmed = window.confirm(t('delete.confirmDelete'))
    if (!confirmed) return

    try {
      await deleteCustomer(customer.id)
      toast.success(t('toast.deleteSuccess'))
      await loadCustomers()
    } catch (error) {
      console.error('删除客户失败', error)
      toast.error(typeof error === 'string' ? error : t('toast.deleteError'))
    }
  }

  /** 保存成功回调 */
  const handleSaved = async (options?: { close?: boolean }) => {
    if (options?.close !== false) {
      setDialogOpen(false)
    }
    await loadCustomers()
  }

  /** 分页页码列表 */
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
      {/* 页面标题 */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      {/* 搜索筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          {/* 关键词搜索 */}
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

          {/* 客户类型筛选 */}
          <div className="w-[160px]">
            <Select value={draftCustomerType} onValueChange={value => value && setDraftCustomerType(value)} items={customerTypeItems}>
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
          </div>

          {/* 客户等级筛选 */}
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

          {/* 国家/地区筛选 */}
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

          {/* 重置 & 搜索按钮 */}
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

      {/* 操作栏 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleAdd}>
          <Plus data-icon="inline-start" />
          {t('action.addCustomer')}
        </Button>
        <Button variant="outline" onClick={() => toast.info(t('toast.exportPlanned'))}>
          <Download data-icon="inline-start" />
          {t('action.export')}
        </Button>
      </div>

      {/* 客户表格 */}
      <CustomerTable
        customers={items}
        loading={loading}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />

      {/* 分页控件 */}
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

      {/* 客户编辑弹窗 */}
      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} customerId={editingCustomerId} onSaved={() => void handleSaved()} />

      {/* 客户详情弹窗 */}
      <CustomerDetailDialog open={detailOpen} onOpenChange={setDetailOpen} customerId={detailCustomerId} />
    </div>
  )
}
