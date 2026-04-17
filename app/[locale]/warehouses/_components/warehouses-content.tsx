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
import type { WarehouseItem } from '@/lib/tauri'
import { deleteWarehouse, getWarehouses, toggleWarehouseStatus } from '@/lib/tauri'

import { DefaultWarehouseMapping } from './default-warehouse-mapping'
import { WarehouseDialog } from './warehouse-dialog'

/** 仓库类型映射（用于显示） */
const WAREHOUSE_TYPE_KEYS: Record<string, string> = {
  raw: 'typeOptions.raw',
  semi: 'typeOptions.semi',
  finished: 'typeOptions.finished',
  return: 'typeOptions.return',
}

/** 仓库管理主内容组件 */
export function WarehousesContent() {
  const t = useTranslations('warehouses')

  // 列表数据
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWarehouseId, setEditingWarehouseId] = useState<number | null>(null)

  // 默认仓映射刷新触发器
  const [mappingRefreshKey, setMappingRefreshKey] = useState(0)

  /** 加载仓库列表 */
  const loadWarehouses = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getWarehouses(true)
      setItems(result)
    } catch (error) {
      console.error('加载仓库失败', error)
      toast.error(String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWarehouses()
  }, [loadWarehouses])

  /** 打开新增弹窗 */
  const handleAdd = () => {
    setEditingWarehouseId(null)
    setDialogOpen(true)
  }

  /** 打开编辑弹窗 */
  const handleEdit = (id: number) => {
    setEditingWarehouseId(id)
    setDialogOpen(true)
  }

  /** 删除仓库 */
  const handleDelete = async (item: WarehouseItem) => {
    if (!confirm(t('deleteConfirm', { name: item.name }))) return

    try {
      await deleteWarehouse(item.id)
      toast.success(t('deleteSuccess'))
      loadWarehouses()
      // 删除后刷新默认仓映射（可能被清除了）
      setMappingRefreshKey(k => k + 1)
    } catch (error) {
      toast.error(String(error))
    }
  }

  /** 切换启用/禁用 */
  const handleToggleStatus = async (item: WarehouseItem) => {
    // 禁用默认仓时提示用户
    if (item.is_enabled) {
      if (!confirm(t('disableConfirm'))) return
    }

    try {
      await toggleWarehouseStatus(item.id)
      loadWarehouses()
      // 禁用时可能清除了默认仓映射，刷新
      setMappingRefreshKey(k => k + 1)
    } catch (error) {
      toast.error(String(error))
    }
  }

  /** 弹窗保存成功回调 */
  const handleDialogSuccess = () => {
    setDialogOpen(false)
    setEditingWarehouseId(null)
    toast.success(t('saveSuccess'))
    loadWarehouses()
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addWarehouse')}
        </Button>
      </div>

      {/* 仓库列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">{t('code')}</TableHead>
                <TableHead className="w-[140px]">{t('name')}</TableHead>
                <TableHead className="w-[120px]">{t('type')}</TableHead>
                <TableHead className="w-[120px]">{t('manager')}</TableHead>
                <TableHead className="w-[80px]">{t('status')}</TableHead>
                <TableHead className="w-[140px]">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="text-muted-foreground">
                      <p>{t('emptyState')}</p>
                      <p className="text-sm">{t('emptyStateDesc')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      {WAREHOUSE_TYPE_KEYS[item.warehouse_type] ? t(WAREHOUSE_TYPE_KEYS[item.warehouse_type]) : item.warehouse_type}
                    </TableCell>
                    <TableCell>{item.manager ?? '—'}</TableCell>
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

      {/* 默认仓映射 */}
      <DefaultWarehouseMapping warehouses={items} refreshKey={mappingRefreshKey} />

      {/* 新增/编辑弹窗 */}
      <WarehouseDialog open={dialogOpen} onOpenChange={setDialogOpen} warehouseId={editingWarehouseId} onSuccess={handleDialogSuccess} />
    </div>
  )
}
