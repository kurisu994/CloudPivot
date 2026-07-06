'use client'

import { ArrowLeft, CheckCircle, Download, Save, Search, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { StockCheckDetail, UpdateStockCheckItemParams } from '@/lib/tauri'
import { confirmStockCheck, getStockCheckDetail, updateStockCheckItems } from '@/lib/tauri'

interface StockCheckEditPageProps {
  checkId: number | null
  onBack: () => void
}

const STOCK_CHECK_ITEM_ID_HEADER = '__stock_check_item_id__'

const cellToString = (value: unknown) => {
  if (value == null) return ''
  return String(value).trim()
}

const cellToNumber = (value: unknown) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN

  const raw = String(value).trim()
  if (!raw) return null

  return Number(raw.replace(/,/g, ''))
}

/**
 * 盘点单编辑/详情页
 * 草稿/盘点中状态可录入实盘数量，已审核状态只读
 */
export function StockCheckEditPage({ checkId, onBack }: StockCheckEditPageProps) {
  const t = useTranslations('stockChecks')
  const tc = useTranslations('common')
  const ti = useTranslations('inventory')

  const [detail, setDetail] = useState<StockCheckDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 实盘数量编辑
  const [editValues, setEditValues] = useState<Record<number, string>>({})

  // 物料搜索筛选
  const [searchTerm, setSearchTerm] = useState('')
  const filteredItems = useMemo(() => {
    if (!detail) return []
    if (!searchTerm.trim()) return detail.items
    const keyword = searchTerm.trim().toLowerCase()
    return detail.items.filter(item => item.materialName.toLowerCase().includes(keyword) || item.materialCode.toLowerCase().includes(keyword))
  }, [detail, searchTerm])

  const loadDetail = useCallback(async () => {
    if (!checkId) return
    setLoading(true)
    try {
      const d = await getStockCheckDetail(checkId)
      setDetail(d)
      // 初始化编辑值
      const vals: Record<number, string> = {}
      for (const item of d.items) {
        vals[item.id] = String(item.actualQty ?? item.systemQty)
      }
      setEditValues(vals)
    } catch (error) {
      toast.error(getErrorMessage(error, tc('loadDetailFailed')))
    } finally {
      setLoading(false)
    }
  }, [checkId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const isEditable = detail && (detail.status === 'draft' || detail.status === 'checking')

  /** 导出盘点明细表，未审核状态实盘列留空便于打印线下盘点 */
  const handleExport = async () => {
    if (!detail) return
    try {
      const XLSX = await import('xlsx')
      const editable = detail.status === 'draft' || detail.status === 'checking'

      const headers = [STOCK_CHECK_ITEM_ID_HEADER, ti('materialCode'), ti('materialName'), ti('spec'), ti('unit'), t('systemQty'), t('actualQty')]

      const dataRows = detail.items.map(item => {
        const actual = editable ? null : item.actualQty
        return [item.id, item.materialCode, item.materialName, item.spec ?? '', item.unitName, item.systemQty, actual]
      })

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
      worksheet['!cols'] = [{ wch: 12, hidden: true }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, t('exportSheetTitle'))
      XLSX.writeFile(workbook, `${t('exportSheetTitle')}-${detail.checkNo}-${detail.checkDate}.xlsx`)
      toast.success(t('exportSuccess'))
    } catch (error) {
      toast.error(getErrorMessage(error, t('exportFailed')))
    }
  }

  const handleImportClick = () => {
    if (!isEditable) {
      toast.error(t('importReadonly'))
      return
    }
    fileInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !detail || !isEditable) return

    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error(t('importTemplateInvalid'))
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' })
      const header = rows[0] ?? []
      if (cellToString(header[0]) !== STOCK_CHECK_ITEM_ID_HEADER) {
        throw new Error(t('importTemplateInvalid'))
      }

      const itemMap = new Map(detail.items.map(item => [item.id, item]))
      const seenItemIds = new Set<number>()
      const updates: UpdateStockCheckItemParams[] = []
      const errors: string[] = []

      for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index] ?? []
        if (row.every(cell => cellToString(cell) === '')) continue

        const rowNumber = index + 1
        const itemId = cellToNumber(row[0])
        const actualQty = cellToNumber(row[6])

        if (itemId == null || !Number.isInteger(itemId)) {
          errors.push(t('importRowError', { row: rowNumber, reason: t('importReasonMissingId') }))
          continue
        }

        const item = itemMap.get(itemId)
        if (!item) {
          errors.push(t('importRowError', { row: rowNumber, reason: t('importReasonUnknownItem') }))
          continue
        }

        if (seenItemIds.has(item.id)) {
          errors.push(t('importRowError', { row: rowNumber, reason: t('importReasonDuplicateItem') }))
          continue
        }
        seenItemIds.add(item.id)

        const materialCode = cellToString(row[1])
        if (materialCode && materialCode !== item.materialCode) {
          errors.push(t('importRowError', { row: rowNumber, reason: t('importReasonMaterialMismatch') }))
          continue
        }

        if (actualQty == null) continue
        if (!Number.isFinite(actualQty) || actualQty < 0) {
          errors.push(t('importRowError', { row: rowNumber, reason: t('importReasonInvalidQty') }))
          continue
        }

        updates.push({
          itemId: item.id,
          actualQty,
          remark: item.remark,
        })
      }

      if (errors.length > 0) {
        const visibleErrors = errors.slice(0, 3).join('；')
        const suffix = errors.length > 3 ? `；${t('importMoreErrors', { count: errors.length - 3 })}` : ''
        throw new Error(`${visibleErrors}${suffix}`)
      }

      if (updates.length === 0) {
        throw new Error(t('importNoValidRows'))
      }

      await updateStockCheckItems(detail.id, updates)
      toast.success(t('importSuccess', { count: updates.length }))
      await loadDetail()
    } catch (error) {
      toast.error(getErrorMessage(error, t('importFailed')))
    } finally {
      setImporting(false)
    }
  }

  /** 保存实盘数量 */
  const handleSave = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const items: UpdateStockCheckItemParams[] = detail.items.map(item => ({
        itemId: item.id,
        actualQty: editValues[item.id] !== '' ? Number(editValues[item.id]) : null,
        remark: item.remark,
      }))
      await updateStockCheckItems(detail.id, items)
      toast.success(tc('saveSuccess'))
      await loadDetail()
    } catch (error) {
      toast.error(getErrorMessage(error, tc('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  /** 审核确认 */
  const handleConfirm = () => {
    if (!detail) return
    setShowConfirm(true)
  }

  /** 审核确认（弹窗确认后执行） */
  const doConfirm = async () => {
    if (!detail) return
    setShowConfirm(false)
    setConfirming(true)
    try {
      await confirmStockCheck(detail.id)
      toast.success(tc('confirmSuccess'))
      await loadDetail()
    } catch (error) {
      toast.error(getErrorMessage(error, tc('confirmFailed')))
      throw error
    } finally {
      setConfirming(false)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">{t('statusDraft')}</Badge>
      case 'checking':
        return <Badge variant="secondary">{t('statusChecking')}</Badge>
      case 'confirmed':
        return <Badge variant="default">{t('statusConfirmed')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 标题栏 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-foreground text-2xl font-bold">{detail ? `${t('checkNo')}: ${detail.checkNo}` : t('title')}</h1>
          {detail && (
            <div className="flex items-center gap-3 mt-1 text-muted-foreground text-sm">
              {statusBadge(detail.status)}
              <span>
                {t('warehouse')}: {detail.warehouseName}
              </span>
              <span>
                {t('checkDate')}: {detail.checkDate}
              </span>
              {detail.createdByName && (
                <span>
                  {t('createdBy')}: {detail.createdByName}
                </span>
              )}
            </div>
          )}
        </div>
        {detail && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              onClick={handleExport}
            >
              <Download data-icon="inline-start" />
              {t('exportExcel')}
            </Button>
            {isEditable && (
              <>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
                <Button
                  className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:border-blue-500 focus-visible:ring-blue-500/30 dark:bg-blue-500 dark:hover:bg-blue-600"
                  onClick={handleImportClick}
                  disabled={importing}
                >
                  <Upload data-icon="inline-start" />
                  {importing ? tc('loading') : t('importExcel')}
                </Button>
                <Button variant="outline" onClick={handleSave} disabled={saving}>
                  <Save data-icon="inline-start" />
                  {saving ? tc('loading') : t('saveActualQty')}
                </Button>
                <Button onClick={handleConfirm} disabled={confirming}>
                  <CheckCircle data-icon="inline-start" />
                  {confirming ? tc('loading') : t('confirmCheck')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 盘点明细表格 */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
      ) : detail ? (
        <>
          {/* 物料搜索框 */}
          <div className="relative w-72">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input placeholder={t('searchMaterial')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[7.5rem]">{ti('materialCode')}</TableHead>
                  <TableHead className="w-[10rem]">{ti('materialName')}</TableHead>
                  <TableHead className="w-[5rem]">{ti('spec')}</TableHead>
                  <TableHead className="w-[3.75rem]">{ti('unit')}</TableHead>
                  <TableHead className="w-[5.625rem] text-right">{t('systemQty')}</TableHead>
                  <TableHead className="w-[7.5rem] text-right">{t('actualQty')}</TableHead>
                  <TableHead className="w-[5.625rem] text-right">{t('diffQty')}</TableHead>
                  <TableHead className="w-[6.25rem] text-right">{t('diffAmount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      {t('noItems')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map(item => {
                    const actualVal = editValues[item.id] ?? ''
                    const actualQty = actualVal !== '' ? Number(actualVal) : null
                    const diff = actualQty !== null ? actualQty - item.systemQty : 0
                    return (
                      <TableRow
                        key={item.id}
                        className={diff !== 0 ? (diff > 0 ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-red-50/50 dark:bg-red-950/20') : ''}
                      >
                        <TableCell className="font-mono text-sm">{item.materialCode}</TableCell>
                        <TableCell>{item.materialName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.spec || '-'}</TableCell>
                        <TableCell>{item.unitName}</TableCell>
                        <TableCell className="text-right font-mono">{item.systemQty}</TableCell>
                        <TableCell className="text-right">
                          {isEditable ? (
                            <Input
                              type="number"
                              value={actualVal}
                              onChange={e => setEditValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-[6.25rem] ml-auto text-right"
                              placeholder={t('inputActualQty')}
                            />
                          ) : (
                            <span className="font-mono">{item.actualQty ?? '-'}</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''}`}>
                          {actualQty !== null ? (diff > 0 ? '+' : '') + diff : '-'}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm ${item.diffAmount > 0 ? 'text-green-600' : item.diffAmount < 0 ? 'text-red-600' : ''}`}
                        >
                          {item.actualQty !== null ? formatAmount(item.diffAmount, 'USD', { showSymbol: false }) : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {/* 盘点确认对话框 */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={t('confirmCheckTip')}
        confirmText={tc('confirm')}
        cancelText={tc('cancel')}
        onConfirm={doConfirm}
      />
    </div>
  )
}
