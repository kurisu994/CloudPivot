'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/lib/error'
import type { PurchaseOrderFilter, PurchaseOrderListItem, SupplierListItem, WarehouseItem } from '@/lib/tauri'
import { approvePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder, getPurchaseOrders, getSuppliers, getWarehouses } from '@/lib/tauri'
import { PurchaseOrderTable } from './purchase-order-table'

/** 采购单状态选项 */
const STATUS_OPTIONS = [
  { value: 'draft', labelKey: 'statusDraft' },
  { value: 'approved', labelKey: 'statusApproved' },
  { value: 'partial_in', labelKey: 'statusPartialIn' },
  { value: 'completed', labelKey: 'statusCompleted' },
  { value: 'cancelled', labelKey: 'statusCancelled' },
] as const

const DEFAULT_PAGE_SIZE = 50

interface PurchaseOrderListPageProps {
  onEdit: (id: number) => void
  onNew: () => void
}

export function PurchaseOrderListPage({ onEdit, onNew }: PurchaseOrderListPageProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')

  const [items, setItems] = useState<PurchaseOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('all')
  const [draftSupplierId, setDraftSupplierId] = useState('all')
  const [draftWarehouseId, setDraftWarehouseId] = useState('all')
  const [draftDateFrom, setDraftDateFrom] = useState('')
  const [draftDateTo, setDraftDateTo] = useState('')

  const [filters, setFilters] = useState<PurchaseOrderFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  // 确认对话框状态
  const [pendingAction, setPendingAction] = useState<{ type: 'approve' | 'cancel' | 'delete'; order: PurchaseOrderListItem } | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getPurchaseOrders({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载采购单失败', error)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, t])

  const loadOptions = useCallback(async () => {
    try {
      const [supplierResult, warehouseResult] = await Promise.all([getSuppliers({ page: 1, pageSize: 999 }), getWarehouses(false)])
      setSuppliers(supplierResult.items)
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

  const supplierItems = useMemo(
    () => [{ value: 'all', label: t('allSuppliers') }, ...suppliers.map(s => ({ value: String(s.id), label: s.name }))],
    [t, suppliers],
  )
  const warehouseItems = useMemo(
    () => [{ value: 'all', label: t('allWarehouses') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [t, warehouses],
  )
  const statusItems = useMemo(
    () => [{ value: 'all', label: t('allStatuses') }, ...STATUS_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }))],
    [t],
  )

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      keyword: draftKeyword.trim() || undefined,
      status: draftStatus !== 'all' ? draftStatus : undefined,
      supplierId: draftSupplierId !== 'all' ? Number(draftSupplierId) : undefined,
      warehouseId: draftWarehouseId !== 'all' ? Number(draftWarehouseId) : undefined,
      dateFrom: draftDateFrom || undefined,
      dateTo: draftDateTo || undefined,
      page: 1,
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftStatus('all')
    setDraftSupplierId('all')
    setDraftWarehouseId('all')
    setDraftDateFrom('')
    setDraftDateTo('')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  const handleApprove = (order: PurchaseOrderListItem) => {
    setPendingAction({ type: 'approve', order })
  }

  const handleCancel = (order: PurchaseOrderListItem) => {
    setPendingAction({ type: 'cancel', order })
  }

  const handleDelete = (order: PurchaseOrderListItem) => {
    setPendingAction({ type: 'delete', order })
  }

  /** 确认操作执行 */
  const handleActionConfirm = async () => {
    if (!pendingAction) return
    const { type, order } = pendingAction
    try {
      if (type === 'approve') {
        await approvePurchaseOrder(order.id)
        toast.success(t('approveSuccess'))
      } else if (type === 'cancel') {
        await cancelPurchaseOrder(order.id)
        toast.success(t('cancelSuccess'))
      } else {
        await deletePurchaseOrder(order.id)
        toast.success(t('deleteSuccess'))
      }
      setPendingAction(null)
      await loadOrders()
    } catch (error) {
      const errKey = type === 'approve' ? 'approveError' : type === 'cancel' ? 'cancelError' : 'deleteError'
      toast.error(getErrorMessage(error, t(errKey)))
      throw error
    }
  }

  const confirmTitle =
    pendingAction?.type === 'approve' ? t('approveConfirm') : pendingAction?.type === 'cancel' ? t('cancelConfirm') : t('deleteConfirm')
  const isDestructiveAction = pendingAction?.type === 'delete' || pendingAction?.type === 'cancel'

  return (
    <div className="flex flex-col gap-6">
      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
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
          <div className="w-[180px]">
            <Select value={draftSupplierId} onValueChange={v => v && setDraftSupplierId(v)} items={supplierItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplierItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <DateRangePicker
            fromValue={draftDateFrom}
            toValue={draftDateTo}
            onChange={(from, to) => {
              setDraftDateFrom(from)
              setDraftDateTo(to)
            }}
            className="w-[280px]"
          />
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
      <PurchaseOrderTable
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

      {/* 确认对话框 */}
      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={open => !open && setPendingAction(null)}
        title={confirmTitle}
        confirmText={pendingAction?.type === 'delete' ? tc('delete') : tc('confirm')}
        cancelText={tc('cancel')}
        destructive={isDestructiveAction}
        onConfirm={handleActionConfirm}
      />
    </div>
  )
}
