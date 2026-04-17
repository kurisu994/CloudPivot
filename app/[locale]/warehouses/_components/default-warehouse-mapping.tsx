'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { DefaultWarehouseItem, WarehouseItem } from '@/lib/tauri'
import { getDefaultWarehouses, saveDefaultWarehouses } from '@/lib/tauri'

/** 物料类型到默认仓映射的键 */
const MATERIAL_TYPES = ['raw', 'semi', 'finished'] as const

interface DefaultWarehouseMappingProps {
  /** 仓库列表（从父组件传入，避免重复请求） */
  warehouses: WarehouseItem[]
  /** 刷新触发器（父组件禁用/删除仓库时递增） */
  refreshKey: number
}

/** 默认仓映射配置区域 */
export function DefaultWarehouseMapping({ warehouses, refreshKey }: DefaultWarehouseMappingProps) {
  const t = useTranslations('warehouses')

  const [mappings, setMappings] = useState<Record<string, string>>({
    raw: '',
    semi: '',
    finished: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 仅启用的仓库可选
  const enabledWarehouses = useMemo(() => warehouses.filter(w => w.is_enabled), [warehouses])

  /** 加载默认仓映射 */
  const loadMappings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getDefaultWarehouses()
      const map: Record<string, string> = { raw: '', semi: '', finished: '' }
      for (const item of result) {
        map[item.material_type] = String(item.warehouse_id)
      }
      setMappings(map)
    } catch (error) {
      console.error('加载默认仓映射失败', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMappings()
  }, [loadMappings, refreshKey])

  /** 保存映射 */
  const handleSave = async () => {
    // 构建非空映射
    const toSave = MATERIAL_TYPES.filter(type => mappings[type]).map(type => ({
      material_type: type,
      warehouse_id: Number(mappings[type]),
    }))

    setSaving(true)
    try {
      await saveDefaultWarehouses(toSave)
      toast.success(t('defaultMapping.saveSuccess'))
    } catch (error) {
      toast.error(String(error))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('defaultMapping.title')}</CardTitle>
        <CardDescription>{t('defaultMapping.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {MATERIAL_TYPES.map(type => {
            // 为每个 Select 构建 items
            const selectItems = enabledWarehouses.map(w => ({
              value: String(w.id),
              label: `${w.name} (${w.code})`,
            }))

            return (
              <div key={type} className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">{t(`defaultMapping.${type}`)}</Label>
                <Select
                  value={mappings[type] || undefined}
                  onValueChange={val => setMappings(prev => ({ ...prev, [type]: val ?? '' }))}
                  items={selectItems}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('defaultMapping.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledWarehouses.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {t('defaultMapping.save')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
