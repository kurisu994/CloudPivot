'use client'

import { Eye, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TransferFilter, TransferListItem, WarehouseItem } from '@/lib/tauri'
import { confirmTransfer, deleteTransfer, getTransfers, getWarehouses } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 10
const COL_COUNT = 9

interface StockTransferListPageProps {
  onEdit: (id: number) => void
  onNew: () => void
}

/**
 * 库存调拨列表页
 */
export function StockTransferListPage({ onEdit, onNew }: StockTransferListPageProps) {
  const t = useTranslations('stockTransfers')
  const tc = useTranslations('common')

  const [items, setItems] = useState<TransferListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftStatus, setDraftStatus] = useState('all')
  const [draftWarehouse, setDraftWarehouse] = useState('all')

  const [filters, setFilters] = useState<TransferFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getTransfers({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载调拨单失败', error)
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize])

  useEffect(() => {
    void loadData()
  }, [loadData])
  useEffect(() => {
    void getWarehouses(false)
      .then(setWarehouses)
      .catch(() => {})
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusItems = useMemo(
    () => [
      { value: 'all', label: tc('all') },
      { value: 'draft', label: t('statusDraft') },
      { value: 'confirmed', label: t('statusConfirmed') },
    ],
    [t, tc],
  )

  const warehouseItems = useMemo(
    () => [{ value: 'all', label: tc('all') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [tc, warehouses],
  )

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      status: draftStatus !== 'all' ? draftStatus : undefined,
      warehouseId: draftWarehouse !== 'all' ? Number(draftWarehouse) : undefined,
      page: 1,
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftStatus('all')
    setDraftWarehouse('all')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  const handleDelete = async (item: TransferListItem) => {
    if (!window.confirm(t('deleteConfirm'))) return
    try {
      await deleteTransfer(item.id)
      toast.success(t('deleteSuccess'))
      await loadData()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('deleteFailed'))
    }
  }

  const handleConfirm = async (item: TransferListItem) => {
    if (!window.confirm(t('confirmTransferTip'))) return
    try {
      await confirmTransfer(item.id)
      toast.success(t('confirmSuccess'))
      await loadData()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('confirmFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[140px]">
            <Select value={draftStatus} onValueChange={v => v && setDraftStatus(v)} items={statusItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map(i => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Select value={draftWarehouse} onValueChange={v => v && setDraftWarehouse(v)} items={warehouseItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouseItems.map(i => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
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

      {/* 操作栏 */}
      <div className="flex items-center gap-3">
        <Button onClick={onNew}>
          <Plus data-icon="inline-start" />
          {t('createTransfer')}
        </Button>
      </div>

      {/* 表格 */}
      <BusinessListTableShell
        tableClassName="min-w-[900px]"
        footer={
          <BusinessListTableFooter>
            <span>{t('totalItems', { total })}</span>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </BusinessListTableFooter>
        }
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">{t('transferNo')}</TableHead>
            <TableHead className="w-[120px]">{t('fromWarehouse')}</TableHead>
            <TableHead className="w-[120px]">{t('toWarehouse')}</TableHead>
            <TableHead className="w-[100px]">{t('transferDate')}</TableHead>
            <TableHead className="w-[80px]">{tc('status')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('itemCount')}</TableHead>
            <TableHead className="w-[100px]">{t('createdBy')}</TableHead>
            <TableHead className="w-[100px]">{t('createdAt')}</TableHead>
            <TableHead className="w-[120px]">{tc('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={COL_COUNT} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={COL_COUNT} message={t('noItems')} />
          ) : (
            items.map(item => (
              <TableRow key={item.id} className="group">
                <TableCell className="font-mono text-sm">{item.transfer_no}</TableCell>
                <TableCell>{item.from_warehouse_name}</TableCell>
                <TableCell>{item.to_warehouse_name}</TableCell>
                <TableCell className="text-sm">{item.transfer_date}</TableCell>
                <TableCell>
                  {item.status === 'draft' ? (
                    <Badge variant="outline">{t('statusDraft')}</Badge>
                  ) : (
                    <Badge variant="default">{t('statusConfirmed')}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{item.item_count}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.created_by_name || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.created_at?.split('T')[0] || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
                      <Eye className="size-4" />
                    </Button>
                    {item.status === 'draft' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleConfirm(item)} className="text-green-600 hover:text-green-700">
                          {tc('confirm')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>
    </div>
  )
}
