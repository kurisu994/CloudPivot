'use client'

import { Eye, Plus, RotateCcw, Search } from 'lucide-react'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CategoryNode, StockCheckFilter, StockCheckListItem, WarehouseItem } from '@/lib/tauri'
import { createStockCheck, getCategoryTree, getStockChecks, getWarehouses } from '@/lib/tauri'

const DEFAULT_PAGE_SIZE = 10
const COL_COUNT = 9

interface StockCheckListPageProps {
  onEdit: (id: number) => void
  onCreated: (id: number) => void
}

const STATUS_OPTIONS = [
  { value: 'draft', labelKey: 'statusDraft' },
  { value: 'checking', labelKey: 'statusChecking' },
  { value: 'confirmed', labelKey: 'statusConfirmed' },
] as const

/**
 * 库存盘点列表页
 */
export function StockCheckListPage({ onEdit, onCreated }: StockCheckListPageProps) {
  const t = useTranslations('stockChecks')
  const tc = useTranslations('common')

  const [items, setItems] = useState<StockCheckListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [draftWarehouse, setDraftWarehouse] = useState('all')
  const [draftStatus, setDraftStatus] = useState('all')

  const [filters, setFilters] = useState<StockCheckFilter>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])

  // 新建弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [newWarehouseId, setNewWarehouseId] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newScope, setNewScope] = useState('all')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getStockChecks({ ...filters, page: currentPage, pageSize })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('加载盘点单失败', error)
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize])

  useEffect(() => {
    void loadData()
  }, [loadData])
  useEffect(() => {
    void Promise.all([getWarehouses(false), getCategoryTree()])
      .then(([wh, cat]) => {
        setWarehouses(wh)
        setCategories(cat.filter(c => c.level === 1))
      })
      .catch(() => {})
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const warehouseItems = useMemo(
    () => [{ value: 'all', label: tc('all') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [tc, warehouses],
  )
  const statusItems = useMemo(
    () => [{ value: 'all', label: tc('all') }, ...STATUS_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))],
    [t, tc],
  )
  const warehouseSelectItems = useMemo(() => warehouses.map(w => ({ value: String(w.id), label: w.name })), [warehouses])
  const categorySelectItems = useMemo(() => categories.map(c => ({ value: String(c.id), label: c.name })), [categories])
  const scopeItems = useMemo(
    () => [
      { value: 'all', label: t('scopeWarehouse') },
      { value: 'category', label: t('scopeCategory') },
    ],
    [t],
  )

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters({
      warehouseId: draftWarehouse !== 'all' ? Number(draftWarehouse) : undefined,
      status: draftStatus !== 'all' ? draftStatus : undefined,
      page: 1,
      pageSize,
    })
  }

  const handleReset = () => {
    setDraftWarehouse('all')
    setDraftStatus('all')
    setCurrentPage(1)
    setFilters({ page: 1, pageSize })
  }

  const handleCreate = async () => {
    if (!newWarehouseId) {
      toast.error(t('selectWarehouse'))
      return
    }
    setCreating(true)
    try {
      const id = await createStockCheck({
        warehouseId: Number(newWarehouseId),
        checkDate: newDate,
        scopeType: newScope,
        scopeCategoryId: newScope === 'category' && newCategoryId ? Number(newCategoryId) : undefined,
      })
      toast.success(t('createSuccess'))
      setCreateOpen(false)
      onCreated(id)
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">{t('statusDraft')}</Badge>
      case 'checking':
        return <Badge variant="secondary">{t('statusChecking')}</Badge>
      case 'confirmed':
        return <Badge variant="default">{t('statusConfirmed')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          {t('createCheck')}
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
            <TableHead className="w-[160px]">{t('checkNo')}</TableHead>
            <TableHead className="w-[120px]">{t('warehouse')}</TableHead>
            <TableHead className="w-[100px]">{t('checkDate')}</TableHead>
            <TableHead className="w-[80px]">{tc('status')}</TableHead>
            <TableHead className="w-[80px]">{t('scopeType')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('itemCount')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('diffCount')}</TableHead>
            <TableHead className="w-[100px]">{t('createdBy')}</TableHead>
            <TableHead className="w-[80px]">{tc('actions')}</TableHead>
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
                <TableCell className="font-mono text-sm">{item.check_no}</TableCell>
                <TableCell>{item.warehouse_name}</TableCell>
                <TableCell className="text-sm">{item.check_date}</TableCell>
                <TableCell>{statusBadge(item.status)}</TableCell>
                <TableCell className="text-sm">{item.scope_type === 'all' ? t('scopeWarehouse') : t('scopeCategory')}</TableCell>
                <TableCell className="text-right">{item.item_count}</TableCell>
                <TableCell className="text-right">
                  {item.diff_count > 0 ? <span className="text-amber-600 font-medium">{item.diff_count}</span> : 0}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.created_by_name || '-'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>

      {/* 新建盘点单弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createCheck')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('selectWarehouse')}</label>
              <Select value={newWarehouseId} onValueChange={v => v && setNewWarehouseId(v)} items={warehouseSelectItems}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouseSelectItems.map(i => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('checkDate')}</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('selectScope')}</label>
              <Select value={newScope} onValueChange={v => v && setNewScope(v)} items={scopeItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeItems.map(i => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newScope === 'category' && (
              <div>
                <label className="text-sm font-medium mb-1 block">{t('selectCategory')}</label>
                <Select value={newCategoryId} onValueChange={v => v && setNewCategoryId(v)} items={categorySelectItems}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categorySelectItems.map(i => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? tc('loading') : tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
