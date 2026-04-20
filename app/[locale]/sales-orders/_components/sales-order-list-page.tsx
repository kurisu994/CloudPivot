'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CustomerListItem, WarehouseItem } from '@/lib/tauri'
import { getCustomers, getWarehouses, invoke } from '@/lib/tauri'
import { type SalesOrderListItem, SalesOrderTable } from './sales-order-table'

/** 销售单状态选项 */
const STATUS_OPTIONS = [
  { value: 'draft', labelKey: 'statusDraft' },
  { value: 'approved', labelKey: 'statusApproved' },
  { value: 'partial_out', labelKey: 'statusPartialOut' },
  { value: 'completed', labelKey: 'statusCompleted' },
  { value: 'cancelled', labelKey: 'statusCancelled' },
] as const

/** 销售单列表筛选参数 */
interface SalesOrderFilter {
  keyword?: string
  customerId?: number
  status?: string
  warehouseId?: number
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 10

interface SalesOrderListPageProps {
  onEdit: (id: number) => void
  onNew: () => void
}

export function SalesOrderListPage({ onEdit, onNew }: SalesOrderListPageProps) {
  const t = useTranslations('sales')
  const tc = useTranslations('common')

  const [items, setItems] = useState<SalesOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 草稿筛选状态（用户输入但未提交）
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [draftCustomerId, setDraftCustomerId] = useState('all')
  const [draftWarehouseId, setDraftWarehouseId] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  // 已提交的筛选条件
  const [filters, setFilters] = useState<SalesOrderFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // 下拉选项数据
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  /** 加载销售单列表 */
  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<{ total: number; items: SalesOrderListItem[]; page: number; page_size: number }>('get_sales_orders', {
        filter: { ...filters, page: currentPage, pageSize },
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载销售单失败', error)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, t])

  /** 加载筛选下拉选项 */
  const loadOptions = useCallback(async () => {
    try {
      const [customerResult, warehouseResult] = await Promise.all([getCustomers({ page: 1, pageSize: 999 }), getWarehouses(false)])
      setCustomers(customerResult.items)
      setWarehouses(warehouseResult)
    } catch (error) {
      console.error('加载筛选选项失败', error)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])
  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 下拉选项列表
  const customerItems = useMemo(
    () => [{ value: 'all', label: t('allCustomers') }, ...customers.map(c => ({ value: String(c.id), label: c.name }))],
    [t, customers],
  )
  const warehouseItems = useMemo(
    () => [{ value: 'all', label: t('allWarehouses') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [t, warehouses],
  )
  const statusItems = useMemo(
    () => [{ value: 'all', label: t('allStatuses') }, ...STATUS_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }))],
    [t],
  )

  /** 执行搜索 */
  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      status: draftStatus !== 'all' ? draftStatus : undefined,
      customerId: draftCustomerId !== 'all' ? Number(draftCustomerId) : undefined,
      warehouseId: draftWarehouseId !== 'all' ? Number(draftWarehouseId) : undefined,
      dateFrom: draftDateFrom || undefined,
      dateTo: draftDateTo || undefined,
      page: 1,
      pageSize,
    })
  }

  /** 重置筛选 */
  const handleReset = () => {
    setDraftKeyword('')
    setDraftStatus('all')
    setDraftCustomerId('all')
    setDraftWarehouseId('all')
    setDraftDateFrom('')
    setDraftDateTo('')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  /** 审核销售单 */
  const handleApprove = async (order: SalesOrderListItem) => {
    if (!window.confirm(t('approveConfirm'))) return
    try {
      await invoke<void>('approve_sales_order', { id: order.id })
      toast.success(t('approveSuccess'))
      await loadOrders()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('approveError'))
    }
  }

  /** 作废销售单 */
  const handleCancel = async (order: SalesOrderListItem) => {
    if (!window.confirm(t('cancelConfirm'))) return
    try {
      await invoke<void>('cancel_sales_order', { id: order.id })
      toast.success(t('cancelSuccess'))
      await loadOrders()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('cancelError'))
    }
  }

  /** 删除销售单 */
  const handleDelete = async (order: SalesOrderListItem) => {
    if (!window.confirm(t('deleteConfirm'))) return
    try {
      await invoke<void>('delete_sales_order', { id: order.id })
      toast.success(t('deleteSuccess'))
      await loadOrders()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('deleteError'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          {/* 关键词搜索 */}
          <div className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={draftKeyword}
                onChange={e => setDraftKeyword(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          {/* 客户筛选 */}
          <div className="w-[180px]">
            <Select value={draftCustomerId} onValueChange={v => v && setDraftCustomerId(v)} items={customerItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 状态筛选 */}
          <div className="w-[140px]">
            <Select value={draftStatus} onValueChange={v => v && setDraftStatus(v)} items={statusItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 仓库筛选 */}
          <div className="w-[160px]">
            <Select value={draftWarehouseId} onValueChange={v => v && setDraftWarehouseId(v)} items={warehouseItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouseItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 日期范围 */}
          <div className="flex items-center gap-2">
            <Input type="date" value={draftDateFrom} onChange={e => setDraftDateFrom(e.target.value)} className="w-[140px]" />
            <span className="text-muted-foreground text-sm">~</span>
            <Input type="date" value={draftDateTo} onChange={e => setDraftDateTo(e.target.value)} className="w-[140px]" />
          </div>
          {/* 操作按钮 */}
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
        <Button onClick={onNew}>
          <Plus data-icon="inline-start" />
          {t('addOrder')}
        </Button>
        <Button variant="outline" onClick={() => toast.info(t('exportComingSoon'))}>
          <Download data-icon="inline-start" />
          {t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <SalesOrderTable
        orders={items}
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
        onEdit={order => onEdit(order.id)}
        onApprove={handleApprove}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />
    </div>
  )
}
