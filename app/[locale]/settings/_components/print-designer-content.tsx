'use client'

/**
 * 打印模板设计器（MVP v0.5）
 *
 * 当前支持：
 * - 左侧字段列表（来自 datasource.fields）
 * - 中间 14×22cm 实时预览
 * - 右侧属性面板：可见 / 列宽 6 档 / 对齐 3 档
 * - 顶部：保存 / 重置默认 / 返回设置
 *
 * 推到下一会话：HTML5 拖拽排序（左→中、中内重排）。
 * 当前临时方案：用上/下移按钮调整顺序，确保业务能用。
 */

import { ArrowDown, ArrowLeft, ArrowUp, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PrintPage } from '@/components/print/PrintPage'
import { PrintRenderer } from '@/components/print/PrintRenderer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getDatasource } from '@/lib/print/registry'
import type { FieldDescriptor } from '@/lib/print/types'
import { COLUMN_WIDTH_OPTIONS, CURRENT_SCHEMA_VERSION, DEFAULT_PRINT_GLOBAL_CONFIG } from '@/lib/print/types'
import type { PrintColumn, PrintColumnAlign, PrintTemplateKey, PrintTemplateRecord } from '@/lib/tauri/print-template'
import { getPrintTemplate, resetPrintTemplateToDefault, savePrintTemplate } from '@/lib/tauri/print-template'

interface PrintDesignerContentProps {
  templateKey: PrintTemplateKey
}

export function PrintDesignerContent({ templateKey }: PrintDesignerContentProps) {
  const t = useTranslations('settings.printSettings')
  const router = useRouter()
  const pathname = usePathname()

  const datasource = useMemo(() => getDatasource(templateKey), [templateKey])

  const [record, setRecord] = useState<PrintTemplateRecord | null>(null)
  const [draftColumns, setDraftColumns] = useState<PrintColumn[]>([])
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // 加载模板配置
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPrintTemplate(templateKey)
      .then(r => {
        if (cancelled) return
        setRecord(r)
        setDraftColumns([...(r.columnsJson as PrintColumn[])])
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [templateKey])

  const draftRecord = useMemo<PrintTemplateRecord | null>(() => {
    if (!record) return null
    return { ...record, columnsJson: draftColumns }
  }, [record, draftColumns])

  // mock data 用于实时预览
  const mockData = useMemo(() => {
    if (templateKey !== 'manual_stock_movement') return null
    return {
      id: 1,
      movementNo: 'FM-20260609-001',
      direction: 'in',
      businessType: t('templates.manualStockMovement'),
      warehouseId: 1,
      warehouseName: '主仓库 / Main Warehouse',
      movementDate: '2026-06-09',
      counterpartyName: '示例供应商',
      remark: '设计器预览',
      status: 'confirmed',
      createdByName: 'admin',
      confirmedByName: 'admin',
      confirmedAt: '2026-06-09 10:30:00',
      createdAt: '2026-06-09 10:00:00',
      items: [
        {
          id: 1,
          sortOrder: 1,
          materialId: 1,
          materialCode: 'M001',
          materialName: '示例物料 A',
          spec: '20×30',
          unitName: '个',
          quantity: 100,
          unitCostUsd: 1.5,
          lotNo: 'LOT-001',
          supplierBatchNo: null,
        },
        {
          id: 2,
          sortOrder: 2,
          materialId: 2,
          materialCode: 'M002',
          materialName: '示例物料 B',
          spec: '50mm',
          unitName: '盒',
          quantity: 25,
          unitCostUsd: 8,
          lotNo: null,
          supplierBatchNo: null,
        },
      ],
    }
  }, [templateKey, t])

  // 左侧"可添加字段"：datasource fields 中标了 columnEligible 且当前 draftColumns 没用的
  const availableFields = useMemo<FieldDescriptor[]>(() => {
    if (!datasource) return []
    const used = new Set(draftColumns.map(c => c.fieldKey))
    return datasource.fields.filter(f => f.columnEligible && !used.has(f.key))
  }, [datasource, draftColumns])

  // 添加字段到列表末尾
  const addField = useCallback((field: FieldDescriptor) => {
    const newCol: PrintColumn = {
      fieldKey: field.key,
      label: field.defaultLabel,
      widthChars: field.defaultWidthChars,
      align: field.defaultAlign,
      visible: true,
    }
    setDraftColumns(prev => [...prev, newCol])
    setSelectedFieldKey(field.key)
  }, [])

  // 删除一列
  const removeColumn = useCallback(
    (fieldKey: string) => {
      setDraftColumns(prev => prev.filter(c => c.fieldKey !== fieldKey))
      if (selectedFieldKey === fieldKey) setSelectedFieldKey(null)
    },
    [selectedFieldKey],
  )

  // 上/下移
  const moveColumn = useCallback((fieldKey: string, direction: -1 | 1) => {
    setDraftColumns(prev => {
      const idx = prev.findIndex(c => c.fieldKey === fieldKey)
      if (idx === -1) return prev
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(idx, 1)
      next.splice(newIdx, 0, moved)
      return next
    })
  }, [])

  // 改属性
  const updateColumn = useCallback((fieldKey: string, patch: Partial<PrintColumn>) => {
    setDraftColumns(prev => prev.map(c => (c.fieldKey === fieldKey ? { ...c, ...patch } : c)))
  }, [])

  const selectedColumn = draftColumns.find(c => c.fieldKey === selectedFieldKey) ?? null

  // 保存
  const handleSave = useCallback(async () => {
    if (!record) return
    setSaving(true)
    try {
      await savePrintTemplate({
        templateKey: record.templateKey,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        paperSize: record.paperSize,
        headerJson: record.headerJson,
        columnsJson: draftColumns,
        footerJson: record.footerJson,
      })
      toast.success(t('saveSuccess'))
      // 重新拉，让 isDefault 字段刷新
      const fresh = await getPrintTemplate(templateKey)
      setRecord(fresh)
    } catch (err) {
      toast.error(`${t('saveFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }, [record, draftColumns, templateKey, t])

  // 重置默认
  const handleReset = useCallback(async () => {
    setSaving(true)
    try {
      await resetPrintTemplateToDefault(templateKey)
      const fresh = await getPrintTemplate(templateKey)
      setRecord(fresh)
      setDraftColumns([...(fresh.columnsJson as PrintColumn[])])
      setSelectedFieldKey(null)
      toast.success(t('saveSuccess'))
    } catch (err) {
      toast.error(`${t('saveFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }, [templateKey, t])

  // 返回设置页
  const handleBack = useCallback(() => {
    const localeMatch = pathname.match(/^\/(zh|vi|en)\//)
    const locale = localeMatch ? localeMatch[1] : 'zh'
    router.push(`/${locale}/settings/print-settings`)
  }, [pathname, router])

  if (!datasource) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{t('previewMissingData')}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 顶栏 */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
            <ArrowLeft className="size-4" />
            {t('backToSettings') /* 复用 */}
          </Button>
          <h2 className="text-base font-bold">
            {t('editTemplate')}: {t(`templates.${SNAKE_TO_CAMEL[templateKey]}`)}
          </h2>
          {record && !record.isDefault && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.625rem] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {t('customized')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-2">
            <RotateCcw className="size-4" />
            {t('resetDefaults')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="gap-2">
            <Save className="size-4" />
            {t('saveAllSettings')}
          </Button>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="grid grid-cols-12 gap-4">
        {/* 左：可添加字段列表 */}
        <div className="col-span-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="mb-3 text-[0.6875rem] font-bold tracking-wider text-slate-400 uppercase">{t('availableFields')}</h3>
          <div className="flex flex-col gap-1">
            {availableFields.length === 0 ? (
              <p className="text-xs text-slate-400">{t('allFieldsUsed')}</p>
            ) : (
              availableFields.map(f => (
                <button
                  key={f.key}
                  type="button"
                  className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => addField(f)}
                >
                  <span className="font-medium">{f.defaultLabel}</span>
                  <Plus className="size-3.5 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* 中：实时预览 + 列顺序 */}
        <div className="col-span-6 flex flex-col gap-4">
          {/* 列顺序面板 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-3 text-[0.6875rem] font-bold tracking-wider text-slate-400 uppercase">{t('columnOrder')}</h3>
            <div className="flex flex-col gap-1">
              {draftColumns.map(col => {
                const isSelected = col.fieldKey === selectedFieldKey
                return (
                  <div
                    key={col.fieldKey}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900'
                    }`}
                  >
                    <Checkbox
                      checked={col.visible}
                      onCheckedChange={checked => updateColumn(col.fieldKey, { visible: !!checked })}
                      className="h-4 w-4"
                    />
                    <button type="button" className="flex-1 text-left font-medium" onClick={() => setSelectedFieldKey(col.fieldKey)}>
                      {col.label}
                    </button>
                    <span className="text-[0.625rem] text-slate-400">
                      {col.widthChars}ch · {col.align}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveColumn(col.fieldKey, -1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveColumn(col.fieldKey, 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeColumn(col.fieldKey)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )
              })}
              {draftColumns.length === 0 && <p className="text-xs text-slate-400">{t('noColumnsHint')}</p>}
            </div>
          </div>

          {/* 实时预览 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-3 text-[0.6875rem] font-bold tracking-widest text-slate-400 uppercase">{t('realTimePreview')}</h3>
            {loading || !draftRecord ? (
              <p className="text-center text-xs text-slate-500">...</p>
            ) : mockData ? (
              <div className="flex justify-center overflow-auto">
                <div style={{ transform: 'scale(0.55)', transformOrigin: 'top center' }}>
                  <PrintPage>
                    <PrintRenderer config={draftRecord} data={mockData} global={DEFAULT_PRINT_GLOBAL_CONFIG} />
                  </PrintPage>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-500">{t('previewMissingData')}</p>
            )}
          </div>
        </div>

        {/* 右：选中列属性面板 */}
        <div className="col-span-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="mb-3 text-[0.6875rem] font-bold tracking-wider text-slate-400 uppercase">{t('columnProperties')}</h3>
          {!selectedColumn ? (
            <p className="text-xs text-slate-400">{t('selectColumnHint')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-[0.625rem] font-bold tracking-wider text-slate-400 uppercase">{t('columnField')}</Label>
                <p className="rounded bg-slate-50 px-2 py-1 text-xs font-mono dark:bg-slate-900">{selectedColumn.fieldKey}</p>
              </div>

              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selectedColumn.visible}
                  onCheckedChange={checked => updateColumn(selectedColumn.fieldKey, { visible: !!checked })}
                />
                <span className="text-sm">{t('columnVisible')}</span>
              </label>

              <div className="space-y-1.5">
                <Label className="text-[0.625rem] font-bold tracking-wider text-slate-400 uppercase">{t('columnWidth')}</Label>
                <Select
                  value={String(selectedColumn.widthChars)}
                  onValueChange={next => updateColumn(selectedColumn.fieldKey, { widthChars: Number(next) as PrintColumn['widthChars'] })}
                  items={COLUMN_WIDTH_OPTIONS.map(w => ({ value: String(w), label: `${w} ${t('chars')}` }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMN_WIDTH_OPTIONS.map(w => (
                      <SelectItem key={w} value={String(w)}>
                        {w} {t('chars')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[0.625rem] font-bold tracking-wider text-slate-400 uppercase">{t('columnAlign')}</Label>
                <div className="grid grid-cols-3 gap-1">
                  {(['left', 'center', 'right'] as PrintColumnAlign[]).map(a => (
                    <Button
                      key={a}
                      variant={selectedColumn.align === a ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => updateColumn(selectedColumn.fieldKey, { align: a })}
                    >
                      {t(`align.${a}`)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// snake_case → camelCase 映射（与 print-settings-content 保持一致）
const SNAKE_TO_CAMEL: Record<PrintTemplateKey, string> = {
  manual_stock_movement: 'manualStockMovement',
  purchase_order: 'purchaseOrder',
  purchase_receipt: 'purchaseReceipt',
  purchase_return: 'purchaseReturn',
  sales_order: 'salesOrder',
  sales_delivery: 'salesDelivery',
  sales_return: 'salesReturn',
  stock_check: 'stockCheck',
  stock_transfer: 'stockTransfer',
  production_order: 'productionOrder',
}
