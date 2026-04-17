'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { UnitItem } from '@/lib/tauri'
import { deleteUnit, getAllUnits, toggleUnitStatus } from '@/lib/tauri'

import { UnitDialog } from './unit-dialog'

/** 单位管理主内容组件 */
export function UnitsContent() {
  const t = useTranslations('units')

  // 列表数据
  const [items, setItems] = useState<UnitItem[]>([])
  const [loading, setLoading] = useState(true)

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null)

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

  /** 删除单位 */
  const handleDelete = async (item: UnitItem) => {
    if (!confirm(t('deleteConfirm', { name: item.name }))) return

    try {
      await deleteUnit(item.id)
      toast.success(t('deleteSuccess'))
      loadUnits()
    } catch (error) {
      toast.error(String(error))
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
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addUnit')}
        </Button>
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
                <TableHead className="w-[140px]">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // 加载骨架
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                // 空状态
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
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
                    <TableCell>{item.name_en ?? '—'}</TableCell>
                    <TableCell>{item.name_vi ?? '—'}</TableCell>
                    <TableCell>{item.symbol ?? '—'}</TableCell>
                    <TableCell>{item.decimal_places}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_enabled ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => handleToggleStatus(item)}>
                        {item.is_enabled ? t('enabled') : t('disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item.id)}>
                          {t('edit')}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                          {t('delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新增/编辑弹窗 */}
      <UnitDialog open={dialogOpen} onOpenChange={setDialogOpen} unitId={editingUnitId} onSuccess={handleDialogSuccess} />
    </div>
  )
}
