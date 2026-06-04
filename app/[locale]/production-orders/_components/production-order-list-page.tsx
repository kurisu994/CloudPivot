'use client'

import { Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PaginationControls } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/lib/error'
import { invoke } from '@/lib/tauri'
import { ProductionOrderTable } from './production-order-table'

/** 工单列表项 */
interface ProductionOrderListItem {
  id: number
  orderNo: string
  bomId: number
  customOrderId: number | null
  custom_order_no: string | null
  output_material_id: number
  output_material_name: string
  planned_qty: number
  completed_qty: number
  status: string
  planned_start_date: string | null
  planned_end_date: string | null
  actual_start_date: string | null
  created_at: string | null
}

interface Props {
  onEdit: (id: number) => void
  onNew: () => void
}

const PAGE_SIZE = 50

const STATUS_OPTIONS = ['all', 'draft', 'picking', 'producing', 'completed', 'cancelled'] as const

/**
 * 生产工单列表页
 * 筛选区 + BusinessListTableShell 表格 + 分页
 */
export function ProductionOrderListPage({ onEdit, onNew }: Props) {
  const t = useTranslations('productionOrders')

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 数据状态
  const [items, setItems] = useState<ProductionOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)

  /** 加载数据 */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<{
        items: ProductionOrderListItem[]
        total: number
        page: number
        pageSize: number
      }>('get_production_orders', {
        filter: {
          keyword: keyword || null,
          status: statusFilter || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          page,
          pageSize: pageSize,
        },
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [keyword, statusFilter, dateFrom, dateTo, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** 删除工单 */
  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_production_order', { id })
      toast.success(t('toast.deleteSuccess'))
      loadData()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  /** 状态选项列表 */
  const statusItems = STATUS_OPTIONS.map(s => ({
    value: s === 'all' ? '' : s,
    label: t(`statusOptions.${s}`),
  }))

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-end">
        <Button onClick={onNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('createOrder')}
        </Button>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t('filter.keyword')}
            value={keyword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v: string | null) => {
            setStatusFilter(v ?? '')
            setPage(1)
          }}
          items={statusItems}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('filter.status')} />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map(item => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker
          fromValue={dateFrom}
          toValue={dateTo}
          onChange={(from, to) => {
            setDateFrom(from)
            setDateTo(to)
            setPage(1)
          }}
          className="w-[280px]"
        />
      </div>

      {/* 表格 */}
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <ProductionOrderTable items={items} loading={loading} onEdit={onEdit} onDelete={handleDelete} />
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="shrink-0 pt-4">
          <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  )
}
