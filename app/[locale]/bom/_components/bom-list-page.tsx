'use client'

import { ChevronLeft, ChevronRight, Copy, Layers, Pencil, Play, Plus, Search, Square, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import { invoke, isTauriEnv } from '@/lib/tauri'
import { BomCopyDialog } from './bom-copy-dialog'
import { BomReverseLookup } from './bom-reverse-lookup'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

export interface BomListItem {
  id: number
  bom_code: string
  materialId: number
  materialCode: string | null
  materialName: string | null
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
    materialId: 4,
    materialCode: 'FP-001',
    materialName: '实木餐椅',
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
    materialId: 4,
    materialCode: 'FP-001',
    materialName: '实木餐椅',
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
    materialId: 5,
    materialCode: 'FP-002',
    materialName: '橡木茶几',
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
  const tc = useTranslations('common')

  // 数据
  const [data, setData] = useState<BomListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 筛选
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // 复制弹窗
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState<number | null>(null)

  // 确认对话框状态
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [activateTargetId, setActivateTargetId] = useState<number | null>(null)

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
        filtered = filtered.filter(b => b.materialCode?.toLowerCase().includes(kw) || b.materialName?.toLowerCase().includes(kw))
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
          pageSize: pageSize,
        },
      })
      setData(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.loadFailed')))
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
  const handleDelete = (id: number) => {
    setDeleteTargetId(id)
  }

  /** 删除 BOM（确认后执行） */
  const handleDeleteConfirm = async () => {
    if (deleteTargetId == null) return
    if (!isTauriEnv()) {
      setData(prev => prev.filter(b => b.id !== deleteTargetId))
      toast.success(t('notifications.deleteBomSuccess'))
      setDeleteTargetId(null)
      return
    }
    try {
      await invoke('delete_bom', { id: deleteTargetId })
      toast.success(t('notifications.deleteBomSuccess'))
      setDeleteTargetId(null)
      fetchBomList()
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.deleteBomFailed')))
      throw e
    }
  }

  /** 切换状态 */
  const handleToggleStatus = async (id: number, newStatus: string) => {
    if (newStatus === 'active') {
      setActivateTargetId(id)
      return
    }
    await doToggleStatus(id, newStatus)
  }

  /** 执行状态切换 */
  const doToggleStatus = async (id: number, newStatus: string) => {
    if (!isTauriEnv()) {
      setData(prev =>
        prev.map(b => {
          if (b.id === id) return { ...b, status: newStatus }
          if (newStatus === 'active' && b.materialId === prev.find(x => x.id === id)?.materialId && b.status === 'active') {
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
      toast.error(getErrorMessage(e, t('notifications.statusChangeFailed')))
    }
  }

  /** 激活 BOM（确认后执行） */
  const handleActivateConfirm = async () => {
    if (activateTargetId == null) return
    try {
      await doToggleStatus(activateTargetId, 'active')
      setActivateTargetId(null)
    } catch (e) {
      throw e
    }
  }

  /** 复制成功回调 */
  const handleCopySuccess = () => {
    setCopyDialogOpen(false)
    fetchBomList()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell className="border-border bg-card rounded-xl border shadow-sm" tableClassName="min-w-[960px]">
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
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
                        <div className="truncate font-medium">{bom.materialName ?? '—'}</div>
                        {bom.material_spec && <div className="text-muted-foreground truncate text-xs">{bom.material_spec}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{bom.materialCode ?? '—'}</TableCell>
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
      </div>

      {/* 分页栏（固定底部，不参与滚动） */}
      {total > 0 && (
        <BusinessListTableFooter className="shrink-0">
          <span className="text-xs font-bold text-slate-400">{t('table.totalRecords', { total: String(total) })}</span>
          <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </BusinessListTableFooter>
      )}

      {/* 物料反查 */}
      <BomReverseLookup />

      {/* 复制弹窗 */}
      <BomCopyDialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen} sourceId={copySourceId} onSuccess={handleCopySuccess} />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteTargetId != null}
        onOpenChange={open => !open && setDeleteTargetId(null)}
        title={t('notifications.confirmDelete')}
        confirmText={tc('delete')}
        cancelText={tc('cancel')}
        destructive
        onConfirm={handleDeleteConfirm}
      />

      {/* 激活确认对话框 */}
      <ConfirmDialog
        open={activateTargetId != null}
        onOpenChange={open => !open && setActivateTargetId(null)}
        title={t('notifications.confirmActivate')}
        confirmText={tc('confirm')}
        cancelText={tc('cancel')}
        onConfirm={handleActivateConfirm}
      />
    </div>
  )
}
