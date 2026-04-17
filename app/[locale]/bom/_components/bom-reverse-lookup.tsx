'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { invoke, isTauriEnv } from '@/lib/tauri'

/** 物料反查结果项 */
interface ReverseLookupItem {
  bom_id: number
  bom_code: string
  material_id: number
  material_name: string | null
  material_code: string | null
  version: string
  status: string
  standard_qty: number
  wastage_rate: number
  actual_qty: number | null
  unit_name: string | null
}

/** 物料搜索结果 */
interface MaterialSearchResult {
  id: number
  code: string
  name: string
}

/**
 * 物料反查组件：输入物料名称/编码，查看该物料被哪些 BOM 使用
 */
export function BomReverseLookup() {
  const t = useTranslations('bom')
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<ReverseLookupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return
    setLoading(true)
    setSearched(true)

    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 300))
      // Mock 数据
      setResults([
        {
          bom_id: 1,
          bom_code: 'BOM-20260401-001',
          material_id: 4,
          material_name: '实木餐椅',
          material_code: 'FP-001',
          version: 'V2.0',
          status: 'active',
          standard_qty: 4,
          wastage_rate: 5,
          actual_qty: 4.2,
          unit_name: '张',
        },
        {
          bom_id: 3,
          bom_code: 'BOM-20260401-003',
          material_id: 5,
          material_name: '橡木茶几',
          material_code: 'FP-002',
          version: 'V1.0',
          status: 'draft',
          standard_qty: 6,
          wastage_rate: 3,
          actual_qty: 6.18,
          unit_name: '张',
        },
      ])
      setLoading(false)
      return
    }

    try {
      // 先搜索物料 ID
      const materials = await invoke<MaterialSearchResult[]>('get_bom_child_materials', {
        keyword: keyword.trim(),
      })
      if (materials.length === 0) {
        setResults([])
        setLoading(false)
        return
      }
      // 用第一个匹配的物料做反查
      const items = await invoke<ReverseLookupItem[]>('reverse_lookup_material', {
        materialId: materials[0].id,
      })
      setResults(items)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [keyword, t])

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <h3 className="text-foreground mb-3 text-base font-semibold">{t('reverseLookup.title')}</h3>
      <div className="relative mb-4 max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-3 size-[18px]" />
        <Input
          className="pl-10"
          placeholder={t('reverseLookup.placeholder')}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
      </div>

      {searched && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reverseLookup.bomCode')}</TableHead>
                <TableHead>{t('reverseLookup.materialName')}</TableHead>
                <TableHead>{t('reverseLookup.version')}</TableHead>
                <TableHead>{t('reverseLookup.qty')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    未找到引用记录
                  </TableCell>
                </TableRow>
              ) : (
                results.map(item => (
                  <TableRow key={`${item.bom_id}-${item.material_id}`}>
                    <TableCell className="font-mono text-sm">{item.bom_code}</TableCell>
                    <TableCell>
                      <span>{item.material_name}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({item.material_code})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'active' ? 'default' : 'outline'}>{item.version}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.actual_qty?.toFixed(2) ?? item.standard_qty.toFixed(2)} {item.unit_name}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
