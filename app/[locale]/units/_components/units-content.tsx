'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { BusinessListTableShell } from '@/components/common/business-list-table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/hooks/use-permission'
import { getErrorMessage } from '@/lib/error'
import type { UnitItem } from '@/lib/tauri'
import { deleteUnit, getAllUnits, toggleUnitStatus } from '@/lib/tauri'

import { UnitDialog } from './unit-dialog'

/** 单位管理主内容组件 */
export function UnitsContent() {
  const t = useTranslations('units')
  const tc = useTranslations('common')
  const { can } = usePermission()
  const canCreate = can('units', 'create')
  const canEdit = can('units', 'edit')
  const canDelete = can('units', 'delete')
  const showActions = canEdit || canDelete

  // 列表数据
  const [items, setItems] = useState<UnitItem[]>([])
  const [loading, setLoading] = useState(true)

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null)

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<UnitItem | null>(null)

  /** 加载单位列表 */
  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAllUnits(true)
      setItems(result)
    } catch (error) {
      console.error('加载单位失败', error)
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  /** 打开新增弹窗 */
  const handleAdd = () => {
    setEditingUnitId(null)
    setDialogOpen(true)
  }

  /** 打开编辑弹窗 */
  const handleEdit = (id: number) => {
    setEditingUnitId(id)
    setDialogOpen(true)
  }

  /** 删除单位（确认后执行） */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteUnit(deleteTarget.id)
      toast.success(t('deleteSuccess'))
      setDeleteTarget(null)
      loadUnits()
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  /** 切换启用/禁用 */
  const handleToggleStatus = async (item: UnitItem) => {
    try {
      await toggleUnitStatus(item.id)
      loadUnits()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  /** 弹窗保存成功回调 */
  const handleDialogSuccess = () => {
    setDialogOpen(false)
    setEditingUnitId(null)
    toast.success(t('saveSuccess'))
    loadUnits()
  }

  const colSpan = showActions ? 7 : 6

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* 操作栏：新增按钮右对齐 */}
      {canCreate && (
        <div className="flex items-center justify-end">
          <Button onClick={handleAdd}>
            <Plus data-icon="inline-start" />
            {t('addUnit')}
          </Button>
        </div>
      )}

      {/* 单位列表（独立滚动，表头吸顶） */}
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <TableHeader className="bg-muted sticky top-0 z-30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[7.5rem] text-center">{t('name')}</TableHead>
              <TableHead className="w-[6.25rem]">{t('nameEn')}</TableHead>
              <TableHead className="w-[6.25rem]">{t('nameVi')}</TableHead>
              <TableHead className="w-[5rem]">{t('symbol')}</TableHead>
              <TableHead className="w-[5rem]">{t('decimalPlaces')}</TableHead>
              <TableHead className="w-[5rem]">{t('status')}</TableHead>
              {showActions && <TableHead className="w-[8.75rem]">{t('actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // 加载骨架
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colSpan }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              // 空状态
              <TableRow>
                <TableCell colSpan={colSpan} className="h-32 text-center">
                  <div className="text-muted-foreground">
                    <p>{t('emptyState')}</p>
                    <p className="text-sm">{t('emptyStateDesc')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // 数据行
              items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-center font-medium">{item.name}</TableCell>
                  <TableCell>{item.nameEn ?? '—'}</TableCell>
                  <TableCell>{item.nameVi ?? '—'}</TableCell>
                  <TableCell>{item.symbol ?? '—'}</TableCell>
                  <TableCell>{item.decimalPlaces}</TableCell>
                  <TableCell>
                    <Badge
                      variant={item.isEnabled ? 'default' : 'secondary'}
                      className={canEdit ? 'cursor-pointer' : undefined}
                      onClick={canEdit ? () => handleToggleStatus(item) : undefined}
                    >
                      {item.isEnabled ? t('enabled') : t('disabled')}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item.id)}>
                            {t('edit')}
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}>
                            {t('delete')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </BusinessListTableShell>
      </div>

      {/* 新增/编辑弹窗 */}
      <UnitDialog open={dialogOpen} onOpenChange={setDialogOpen} unitId={editingUnitId} onSuccess={handleDialogSuccess} />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
        confirmText={tc('delete')}
        cancelText={tc('cancel')}
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
