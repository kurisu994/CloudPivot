'use client'

import { Copy, Layers, MoreHorizontal, Pencil, Play, Plus, Search, Square, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
} from '@/components/common/business-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { invoke, isTauriEnv } from '@/lib/tauri'
import { formatAmount } from '@/lib/currency'

import { BomCopyDialog } from './bom-copy-dialog'
import { BomReverseLookup } from './bom-reverse-lookup'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

export interface BomListItem {
  id: number
  bom_code: string
  material_id: number
  material_code: string | null
  material_name: string | null
  material_spec: string | null
  version: string
  status: string
  effective_date: string | null
  total_standard_cost: number
  item_count: number
  remark: string | null
  created_at: string | null
  updated_at: string | null
}

/* ------------------------------------------------------------------ */
/*  Mock 数据                                                          */
/* ------------------------------------------------------------------ */

const MOCK_BOMS: BomListItem[] = [
  {
    id: 1,
    bom_code: 'BOM-20260401-001',
    material_id: 4,
    material_code: 'FP-001',
    material_name: '实木餐椅',
    material_spec: '450×520×880mm',
    version: 'V2.0',
    status: 'active',
    effective_date: '2026-03-15',
    total_standard_cost: 4500,
    item_count: 6,
    remark: null,
    created_at: '2026-03-10',
    updated_at: '2026-03-15',
  },
  {
    id: 2,
    bom_code: 'BOM-20260401-002',
    material_id: 4,
    material_code: 'FP-001',
    material_name: '实木餐椅',
    material_spec: '450×520×880mm',
    version: 'V1.0',
    status: 'inactive',
    effective_date: '2026-02-01',
    total_standard_cost: 4200,
    item_count: 5,
    remark: null,
    created_at: '2026-02-01',
    updated_at: '2026-03-15',
  },
  {
    id: 3,
    bom_code: 'BOM-20260401-003',
    material_id: 5,
    material_code: 'FP-002',
    material_name: '橡木茶几',
    material_spec: '1200×600×450mm',
    version: 'V1.0',
    status: 'draft',
    effective_date: null,
    total_standard_cost: 6800,
    item_count: 8,
    remark: null,
    created_at: '2026-03-20',
    updated_at: '2026-03-20',
  },
]

/* ------------------------------------------------------------------ */
/*  状态徽章                                                           */
/* ------------------------------------------------------------------ */

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const variant = status === 'active' ? 'default' : status === 'draft' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{t(`status.${status}`)}</Badge>
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

interface BomListPageProps {
  onEditBom: (id: number) => void
  onNewBom: () => void
}

export function BomListPage({ onEditBom, onNewBom }: BomListPageProps) {
  const t = useTranslations('bom')

  // 数据
  const [data, setData] = useState<BomListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 筛选
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 复制弹窗
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState<number | null>(null)

  const statusItems = useMemo(
    () => [
      { value: 'all', label: t('filters.statusAll') },
      { value: 'draft', label: t('filters.status.draft') },
      { value: 'active', label: t('filters.status.active') },
      { value: 'inactive', label: t('filters.status.inactive') },
    ],
    [t],
  )

  /** 加载 BOM 列表 */
  const fetchBomList = useCallback(async () => {
    setLoading(true)
    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 300))
      let filtered = [...MOCK_BOMS]
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase()
        filtered = filtered.filter(b => b.material_code?.toLowerCase().includes(kw) || b.material_name?.toLowerCase().includes(kw))
      }
      if (status !== 'all') {
        filtered = filtered.filter(b => b.status === status)
      }
      setTotal(filtered.length)
      setData(filtered.slice((page - 1) * pageSize, page * pageSize))
      setLoading(false)
      return
    }
    try {
      const res = await invoke<{ total: number; items: BomListItem[] }>('get_bom_list', {
        filter: {
          keyword: keyword.trim() || null,
          status: status === 'all' ? null : status,
          page,
          page_size: pageSize,
        },
      })
      setData(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [keyword, status, page, pageSize, t])

  useEffect(() => {
    fetchBomList()
  }, [fetchBomList])

  const handleSearch = () => {
    setPage(1)
    fetchBomList()
  }
  const handleReset = () => {
    setKeyword('')
    setStatus('all')
    setPage(1)
  }

  /** 删除 BOM */
  const handleDelete = async (id: number) => {
    if (!confirm(t('notifications.confirmDelete'))) return
    if (!isTauriEnv()) {
      setData(prev => prev.filter(b => b.id !== id))
      toast.success(t('notifications.deleteBomSuccess'))
      return
    }
    try {
      await invoke('delete_bom', { id })
      toast.success(t('notifications.deleteBomSuccess'))
      fetchBomList()
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.deleteBomFailed'))
    }
  }

  /** 切换状态 */
  const handleToggleStatus = async (id: number, newStatus: string) => {
    if (newStatus === 'active' && !confirm(t('notifications.confirmActivate'))) return
    if (!isTauriEnv()) {
      setData(prev =>
        prev.map(b => {
          if (b.id === id) return { ...b, status: newStatus }
          if (newStatus === 'active' && b.material_id === prev.find(x => x.id === id)?.material_id && b.status === 'active') {
            return { ...b, status: 'inactive' }
          }
          return b
        }),
      )
      toast.success(t('notifications.statusChangeSuccess'))
      return
    }
    try {
      await invoke('toggle_bom_status', { id, newStatus })
      toast.success(t('notifications.statusChangeSuccess'))
      fetchBomList()
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.statusChangeFailed'))
    }
  }

  /** 复制成功回调 */
  const handleCopySuccess = () => {
    setCopyDialogOpen(false)
    fetchBomList()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-foreground text-2xl font-bold">
          {t('title')}
          <span className="text-muted-foreground ml-2 text-lg font-normal">{t('subtitle')}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      {/* 搜索过滤条 */}
      <div className="border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-[18px]" />
            <Input
              className="pl-10"
              placeholder={t('searchPlaceholder')}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Select value={status} onValueChange={v => setStatus(v ?? 'all')} items={statusItems}>
            <SelectTrigger className="w-[150px]">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            {t('actions.reset')}
          </Button>
          <Button onClick={handleSearch}>{t('actions.search')}</Button>
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="flex gap-2">
        <Button onClick={onNewBom}>
          <Plus data-icon="inline-start" />
          {t('actions.add')}
        </Button>
      </div>

      {/* BOM 列表表格 */}
      <BusinessListTableShell
        className="border-border bg-card rounded-xl border shadow-sm"
        tableClassName="min-w-[960px]"
        footer={
          total > 0 ? (
            <BusinessListTableFooter>
              <span>{total} 条记录</span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => page > 1 && setPage(page - 1)}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-muted-foreground px-3 text-sm">
                      {page} / {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => page < totalPages && setPage(page + 1)}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </BusinessListTableFooter>
          ) : undefined
        }
      >
        <TableHeader>
          <TableRow>
            <TableHead className={`w-[200px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('table.materialName')}</TableHead>
            <TableHead className="w-[120px]">{t('table.materialCode')}</TableHead>
            <TableHead className="w-[80px]">{t('table.version')}</TableHead>
            <TableHead className="w-[90px]">{t('table.status')}</TableHead>
            <TableHead className="w-[120px]">{t('table.standardCost')}</TableHead>
            <TableHead className="w-[80px]">{t('table.itemCount')}</TableHead>
            <TableHead className="w-[120px]">{t('table.createdAt')}</TableHead>
            <TableHead className="w-[130px]">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={8} rows={4} />
          ) : data.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={8} message={t('table.noResults')} />
          ) : (
            data.map(bom => (
              <TableRow key={bom.id} className="group cursor-pointer" onClick={() => onEditBom(bom.id)}>
                <TableCell className={BUSINESS_LIST_STICKY_CELL_CLASS}>
                  <div className="flex items-center gap-2">
                    <Layers className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{bom.material_name ?? '—'}</div>
                      {bom.material_spec && <div className="text-muted-foreground truncate text-xs">{bom.material_spec}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{bom.material_code ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{bom.version}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={bom.status} t={t} />
                </TableCell>
                <TableCell className="font-mono">{formatAmount(bom.total_standard_cost, 'USD')}</TableCell>
                <TableCell className="text-center">{bom.item_count}</TableCell>
                <TableCell className="text-muted-foreground">{bom.created_at?.slice(0, 10) ?? '—'}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEditBom(bom.id)} title={t('actions.edit')}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCopySourceId(bom.id)
                        setCopyDialogOpen(true)
                      }}
                      title={t('actions.copy')}
                    >
                      <Copy className="size-4" />
                    </Button>
                    {bom.status !== 'active' ? (
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(bom.id, 'active')} title={t('actions.activate')}>
                        <Play className="size-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(bom.id, 'inactive')} title={t('actions.deactivate')}>
                        <Square className="size-4" />
                      </Button>
                    )}
                    {bom.status !== 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(bom.id)} title={t('actions.delete')}>
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>

      {/* 物料反查 */}
      <BomReverseLookup />

      {/* 复制弹窗 */}
      <BomCopyDialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen} sourceId={copySourceId} onSuccess={handleCopySuccess} />
    </div>
  )
}
