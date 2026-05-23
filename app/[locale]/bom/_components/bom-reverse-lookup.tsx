'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/error'
import { invoke, isTauriEnv } from '@/lib/tauri'

/** 物料反查结果项 */
interface ReverseLookupItem {
  bomId: number
  bom_code: string
  materialId: number
  materialName: string | null
  materialCode: string | null
  version: string
  status: string
  standard_qty: number
  wastage_rate: number
  actual_qty: number | null
  unitName: string | null
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
          bomId: 1,
          bom_code: 'BOM-20260401-001',
          materialId: 4,
          materialName: '实木餐椅',
          materialCode: 'FP-001',
          version: 'V2.0',
          status: 'active',
          standard_qty: 4,
          wastage_rate: 5,
          actual_qty: 4.2,
          unitName: '张',
        },
        {
          bomId: 3,
          bom_code: 'BOM-20260401-003',
          materialId: 5,
          materialName: '橡木茶几',
          materialCode: 'FP-002',
          version: 'V1.0',
          status: 'draft',
          standard_qty: 6,
          wastage_rate: 3,
          actual_qty: 6.18,
          unitName: '张',
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
      toast.error(getErrorMessage(e, t('notifications.loadFailed')))
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
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    {t('noReverseLookup')}
                  </TableCell>
                </TableRow>
              ) : (
                results.map(item => (
                  <TableRow key={`${item.bomId}-${item.materialId}`}>
                    <TableCell className="font-mono text-sm">{item.bom_code}</TableCell>
                    <TableCell>
                      <span>{item.materialName}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({item.materialCode})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'active' ? 'default' : 'outline'}>{item.version}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.actual_qty?.toFixed(2) ?? item.standard_qty.toFixed(2)} {item.unitName}
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
