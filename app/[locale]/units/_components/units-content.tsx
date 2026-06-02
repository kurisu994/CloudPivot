'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/hooks/use-permission'
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
      toast.error(String(error))
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
      toast.error(String(error))
      throw error
    }
  }

  /** 切换启用/禁用 */
  const handleToggleStatus = async (item: UnitItem) => {
    try {
      await toggleUnitStatus(item.id)
      loadUnits()
    } catch (error) {
      toast.error(String(error))
    }
  }

  /** 弹窗保存成功回调 */
  const handleDialogSuccess = () => {
    setDialogOpen(false)
    setEditingUnitId(null)
    toast.success(t('saveSuccess'))
    loadUnits()
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        {canCreate && (
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addUnit')}
          </Button>
        )}
      </div>

      {/* 单位列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">{t('name')}</TableHead>
                <TableHead className="w-[100px]">{t('nameEn')}</TableHead>
                <TableHead className="w-[100px]">{t('nameVi')}</TableHead>
                <TableHead className="w-[80px]">{t('symbol')}</TableHead>
                <TableHead className="w-[80px]">{t('decimalPlaces')}</TableHead>
                <TableHead className="w-[80px]">{t('status')}</TableHead>
                {showActions && <TableHead className="w-[140px]">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // 加载骨架
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: showActions ? 7 : 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                // 空状态
                <TableRow>
                  <TableCell colSpan={showActions ? 7 : 6} className="h-32 text-center">
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
                    <TableCell className="font-medium">{item.name}</TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(item)}
                            >
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
          </Table>
        </CardContent>
      </Card>

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
