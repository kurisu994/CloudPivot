'use client'

import { Download, Plus, Search, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePermission } from '@/hooks/use-permission'
import { createMaterialExcelColumns, downloadBusinessWorkbook, readBusinessExcelRows } from '@/lib/business-excel'
import { getErrorMessage } from '@/lib/error'
import type { MaterialImportRow } from '@/lib/tauri'
import { exportMaterials, importMaterials, invoke, isTauriEnv } from '@/lib/tauri'
import { buildToggleMaterialStatusArgs } from './material-command-args'
import { MaterialFormDialog } from './material-form-dialog'
import { MaterialTable } from './material-table'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/** 物料列表项（对应后端 MaterialListItem） */
export interface MaterialItem {
  id: number
  code: string
  name: string
  materialType: string
  categoryId: number | null
  categoryName: string | null
  spec: string | null
  baseUnitId: number
  unitName: string | null
  refCostPrice: number
  salePrice: number
  safetyStock: number
  maxStock: number
  isEnabled: boolean
  nameVi: string | null
  createdAt: string | null
}

/** 分类选项 */
export interface CategoryOption {
  id: number
  name: string
  code: string
  parentId: number | null
  level: number
}

/** 单位选项 */
export interface UnitOption {
  id: number
  name: string
  nameEn: string | null
  nameVi: string | null
}

/* ------------------------------------------------------------------ */
/*  Mock 数据 — Web 调试模式使用                                       */
/* ------------------------------------------------------------------ */

const MOCK_CATEGORIES: CategoryOption[] = [
  { id: 1, name: '木材', code: 'WOOD', parentId: null, level: 1 },
  { id: 2, name: '五金', code: 'HARDWARE', parentId: null, level: 1 },
  { id: 3, name: '客厅', code: 'LIVING', parentId: null, level: 1 },
  { id: 4, name: '餐厅', code: 'DINING', parentId: null, level: 1 },
]

const MOCK_UNITS: UnitOption[] = [
  { id: 1, name: '张', nameEn: 'Sheet', nameVi: 'Tấm' },
  { id: 2, name: '个', nameEn: 'Piece', nameVi: 'Cái' },
  { id: 3, name: '套', nameEn: 'Set', nameVi: 'Bộ' },
  { id: 4, name: '米', nameEn: 'Meter', nameVi: 'Mét' },
  { id: 5, name: '千克', nameEn: 'Kg', nameVi: 'Kg' },
]

const MOCK_MATERIALS: MaterialItem[] = [
  {
    id: 1,
    code: 'M-1002',
    name: '真皮三人沙发',
    nameVi: 'Sofa da 3 chỗ',
    materialType: 'finished',
    categoryId: 3,
    categoryName: '客厅',
    spec: '2100×900',
    baseUnitId: 3,
    unitName: '套',
    refCostPrice: 0,
    salePrice: 175600,
    safetyStock: 10,
    maxStock: 50,
    isEnabled: true,
    createdAt: '2024-01-15',
  },
  {
    id: 2,
    code: 'M-0001',
    name: '白橡实木板',
    nameVi: 'Gỗ sồi trắng',
    materialType: 'raw',
    categoryId: 1,
    categoryName: '木材',
    spec: '2440×1220',
    baseUnitId: 1,
    unitName: '张',
    refCostPrice: 3850,
    salePrice: 0,
    safetyStock: 50,
    maxStock: 500,
    isEnabled: true,
    createdAt: '2024-01-10',
  },
  {
    id: 3,
    code: 'M-0002',
    name: '不锈钢铰链',
    nameVi: 'Bản lề inox',
    materialType: 'raw',
    categoryId: 2,
    categoryName: '五金',
    spec: '40mm',
    baseUnitId: 2,
    unitName: '个',
    refCostPrice: 48,
    salePrice: 0,
    safetyStock: 500,
    maxStock: 5000,
    isEnabled: true,
    createdAt: '2024-01-12',
  },
  {
    id: 4,
    code: 'M-1001',
    name: '北欧实木餐桌',
    nameVi: 'Bàn ăn gỗ tự nhiên',
    materialType: 'finished',
    categoryId: 4,
    categoryName: '餐厅',
    spec: '1400×800',
    baseUnitId: 3,
    unitName: '套',
    refCostPrice: 0,
    salePrice: 49000,
    safetyStock: 5,
    maxStock: 30,
    isEnabled: true,
    createdAt: '2024-01-08',
  },
]

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function MaterialsClientPage() {
  const t = useTranslations('materials')
  const materialExcelColumns = useMemo(() => createMaterialExcelColumns(t), [t])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { can } = usePermission()
  const canCreate = can('materials', 'create')
  const canEdit = can('materials', 'edit')
  const canImport = can('materials', 'import')
  const canExport = can('materials', 'export')

  // 数据
  const [data, setData] = useState<MaterialItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 筛选
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [materialType, setMaterialType] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // 弹窗
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingImportRows, setPendingImportRows] = useState<MaterialImportRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])

  // 下拉选项
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])

  /* 构建 Select items（按树形深度优先排序并加缩进） */
  const categoryItems = useMemo(() => {
    const childrenMap = new Map<number | null, CategoryOption[]>()
    for (const cat of categories) {
      const pid = cat.parentId ?? null
      if (!childrenMap.has(pid)) childrenMap.set(pid, [])
      childrenMap.get(pid)!.push(cat)
    }
    const sorted: CategoryOption[] = []
    const traverse = (parentId: number | null) => {
      const children = childrenMap.get(parentId)
      if (!children) return
      for (const child of children) {
        sorted.push(child)
        traverse(child.id)
      }
    }
    traverse(null)
    return [
      { value: 'all', label: t('filters.categoryAll') },
      ...sorted.map(c => ({ value: c.id.toString(), label: `${'　'.repeat(c.level - 1)}${c.name}` })),
    ]
  }, [categories, t])

  const typeItems = useMemo(
    () => [
      { value: 'all', label: t('filters.typeAll') },
      { value: 'raw', label: t('filters.type.raw') },
      { value: 'semi', label: t('filters.type.semi') },
      { value: 'finished', label: t('filters.type.finished') },
    ],
    [t],
  )

  const statusItems = useMemo(
    () => [
      { value: 'all', label: t('filters.statusAll') },
      { value: 'active', label: t('filters.status.active') },
      { value: 'inactive', label: t('filters.status.inactive') },
    ],
    [t],
  )

  /** 加载分类/单位下拉选项 */
  const fetchOptions = useCallback(async () => {
    if (!isTauriEnv()) {
      setCategories(MOCK_CATEGORIES)
      setUnits(MOCK_UNITS)
      return
    }
    try {
      const [cat, uni] = await Promise.all([invoke<CategoryOption[]>('get_categories'), invoke<UnitOption[]>('get_units')])
      setCategories(cat)
      setUnits(uni)
    } catch (e) {
      console.error('加载下拉选项失败', e)
    }
  }, [])

  /** 加载物料列表 */
  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    if (!isTauriEnv()) {
      // Web 调试模式：使用 mock 数据
      await new Promise(r => setTimeout(r, 300))
      let filtered = [...MOCK_MATERIALS]
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase()
        filtered = filtered.filter(m => m.code.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw))
      }
      if (categoryId !== 'all') {
        filtered = filtered.filter(m => m.categoryId === parseInt(categoryId))
      }
      if (materialType !== 'all') {
        filtered = filtered.filter(m => m.materialType === materialType)
      }
      if (status !== 'all') {
        filtered = filtered.filter(m => (status === 'active' ? m.isEnabled : !m.isEnabled))
      }
      setTotal(filtered.length)
      setData(filtered.slice((page - 1) * pageSize, page * pageSize))
      setLoading(false)
      return
    }
    try {
      const res = await invoke<{ total: number; items: MaterialItem[] }>('get_materials', {
        filter: {
          keyword: keyword.trim() || null,
          categoryId: categoryId === 'all' ? null : parseInt(categoryId, 10),
          materialType: materialType === 'all' ? null : materialType,
          isEnabled: status === 'all' ? null : status === 'active',
          page,
          pageSize: pageSize,
        },
      })
      setData(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.loadMaterialsFailed')))
    } finally {
      setLoading(false)
    }
  }, [keyword, categoryId, materialType, status, page, pageSize, t])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])
  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const handleReset = () => {
    setKeyword('')
    setCategoryId('all')
    setMaterialType('all')
    setStatus('all')
    setPage(1)
  }

  const handleSearch = () => {
    setPage(1)
    fetchMaterials()
  }

  const handleToggleStatus = async (id: number, currentEnabled: boolean) => {
    if (!isTauriEnv()) {
      setData(prev => prev.map(item => (item.id === id ? { ...item, isEnabled: !currentEnabled } : item)))
      toast.success(currentEnabled ? t('notifications.materialDisabled') : t('notifications.materialEnabled'))
      return
    }
    try {
      await invoke('toggle_material_status', buildToggleMaterialStatusArgs(id, currentEnabled))
      toast.success(currentEnabled ? t('notifications.materialDisabled') : t('notifications.materialEnabled'))
      fetchMaterials()
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.toggleFailed')))
    }
  }

  /** 校验物料导入预览数据 */
  const validateMaterialImportRows = (rows: MaterialImportRow[]) => {
    const errors: string[] = []
    const seenCodes = new Set<string>()
    rows.forEach((row, index) => {
      const lineNo = index + 2
      if (!row.code?.trim()) errors.push(t('import.errors.codeRequired', { line: lineNo }))
      if (!row.name?.trim()) errors.push(t('import.errors.nameRequired', { line: lineNo }))
      if (!row.baseUnitName?.trim()) errors.push(t('import.errors.unitRequired', { line: lineNo }))
      if (row.code && seenCodes.has(row.code.trim())) errors.push(t('import.errors.duplicateCode', { line: lineNo }))
      if (row.code) seenCodes.add(row.code.trim())
    })
    return errors
  }

  /** 读取物料导入文件并打开预览 */
  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const rows = await readBusinessExcelRows<MaterialImportRow>(file, materialExcelColumns)
      const filteredRows = rows.filter(row => row.code || row.name)
      setPendingImportRows(filteredRows)
      setImportErrors(validateMaterialImportRows(filteredRows))
      setImportDialogOpen(true)
    } catch (error) {
      console.error('读取物料导入文件失败', error)
      toast.error(t('notifications.importReadFailed'))
    }
  }

  /** 确认导入物料 */
  const handleConfirmImport = async () => {
    if (!isTauriEnv()) {
      toast.info(t('notifications.tauriOnly'))
      return
    }
    setImporting(true)
    try {
      const result = await importMaterials(pendingImportRows)
      if (result.errors.length) {
        setImportErrors(result.errors)
        toast.error(t('notifications.importValidationFailed'))
        return
      }
      toast.success(t('notifications.importSuccess', { created: result.created, updated: result.updated }))
      setImportDialogOpen(false)
      setPendingImportRows([])
      fetchMaterials()
    } catch (error) {
      toast.error(getErrorMessage(error, t('notifications.importFailed')))
    } finally {
      setImporting(false)
    }
  }

  /** 导出物料主数据 */
  const handleExportMaterials = async () => {
    try {
      const rows: object[] = isTauriEnv()
        ? await exportMaterials()
        : MOCK_MATERIALS.map(item => ({ ...item, baseUnitName: item.unitName ?? '', lotTrackingMode: 'none' }))
      await downloadBusinessWorkbook('materials.xlsx', 'materials', materialExcelColumns, rows)
      toast.success(t('notifications.exportSuccess'))
    } catch (error) {
      console.error('导出物料失败', error)
      toast.error(t('notifications.exportFailed'))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* 搜索过滤条 */}
      <div className="border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-4">
          {/* 搜索框 */}
          <div className="relative max-w-xs flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-[1.125rem]" />
            <Input
              className="pl-10"
              placeholder={t('searchPlaceholder')}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          {/* 分类 */}
          <Select value={categoryId} onValueChange={value => setCategoryId(value ?? 'all')} items={categoryItems}>
            <SelectTrigger className="w-[9.375rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 类型 */}
          <Select value={materialType} onValueChange={value => setMaterialType(value ?? 'all')} items={typeItems}>
            <SelectTrigger className="w-[9.375rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 状态 */}
          <Select value={status} onValueChange={value => setStatus(value ?? 'all')} items={statusItems}>
            <SelectTrigger className="w-[8.125rem]">
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
        {canCreate && (
          <Button
            onClick={() => {
              setEditingId(null)
              setDialogOpen(true)
            }}
          >
            <Plus data-icon="inline-start" />
            {t('actions.add')}
          </Button>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
        {canImport && (
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload data-icon="inline-start" />
            {t('actions.import')}
          </Button>
        )}
        {canExport && (
          <Button variant="outline" onClick={handleExportMaterials}>
            <Download data-icon="inline-start" />
            {t('actions.export')}
          </Button>
        )}
      </div>

      {/* 数据表格 + 分页 */}
      <div className="min-h-0 flex-1">
        <MaterialTable
          data={data}
          loading={loading}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={s => {
            setPageSize(s)
            setPage(1)
          }}
          onEdit={id => {
            setEditingId(id)
            setDialogOpen(true)
          }}
          onToggleStatus={handleToggleStatus}
          canEdit={canEdit}
        />
      </div>

      {/* 新增/编辑弹窗 */}
      <MaterialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        materialId={editingId}
        categories={categories}
        units={units}
        onSuccess={() => {
          setDialogOpen(false)
          fetchMaterials()
        }}
      />

      {/* 物料导入预览弹窗 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('import.previewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              {t('import.previewSummary', { count: pendingImportRows.length, errors: importErrors.length })}
            </div>
            {importErrors.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {importErrors.slice(0, 8).map(error => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            )}
            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2">{t('form.code')}</th>
                    <th className="px-3 py-2">{t('form.name')}</th>
                    <th className="px-3 py-2">{t('form.type')}</th>
                    <th className="px-3 py-2">{t('form.baseUnit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingImportRows.slice(0, 20).map((row, index) => (
                    <tr key={`${row.code}-${index}`} className="border-t">
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.materialType}</td>
                      <td className="px-3 py-2">{row.baseUnitName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button disabled={importing || importErrors.length > 0 || pendingImportRows.length === 0} onClick={handleConfirmImport}>
              {t('import.confirmImport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
