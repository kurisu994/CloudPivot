'use client'

import { ArrowLeft, CheckCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { MaterialReferenceOption, SaveTransferItemParams, TransferDetail, WarehouseItem } from '@/lib/tauri'
import { confirmTransfer, getMaterialReferenceOptions, getTransferDetail, getWarehouses, saveTransfer } from '@/lib/tauri'

interface StockTransferEditPageProps {
  transferId: number | null
  onBack: () => void
}

interface TransferLineItem {
  key: string
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitId: number
  unitName: string
  conversionRate: number
  quantity: number
  lotId: number | null
  remark: string
}

/**
 * 调拨单编辑/详情页
 * 新建或编辑草稿调拨单
 */
export function StockTransferEditPage({ transferId, onBack }: StockTransferEditPageProps) {
  const t = useTranslations('stockTransfers')
  const tc = useTranslations('common')

  const [detail, setDetail] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [remark, setRemark] = useState('')
  const [lines, setLines] = useState<TransferLineItem[]>([])

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [materials, setMaterials] = useState<MaterialReferenceOption[]>([])

  const isEditable = !detail || detail.status === 'draft'

  const loadDetail = useCallback(async () => {
    if (!transferId) return
    setLoading(true)
    try {
      const d = await getTransferDetail(transferId)
      setDetail(d)
      setFromWarehouseId(String(d.from_warehouse_id))
      setToWarehouseId(String(d.to_warehouse_id))
      setTransferDate(d.transfer_date)
      setRemark(d.remark || '')
      setLines(
        d.items.map(item => ({
          key: `existing-${item.id}`,
          materialId: item.material_id,
          materialCode: item.material_code || '',
          materialName: item.material_name || '',
          spec: item.spec,
          unitId: item.unit_id,
          unitName: item.unit_name_snapshot,
          conversionRate: item.conversion_rate_snapshot,
          quantity: item.quantity,
          lotId: item.lot_id,
          remark: item.remark || '',
        })),
      )
    } catch (error) {
      toast.error(typeof error === 'string' ? error : '加载详情失败')
    } finally {
      setLoading(false)
    }
  }, [transferId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])
  useEffect(() => {
    void Promise.all([getWarehouses(false), getMaterialReferenceOptions()])
      .then(([wh, mat]) => {
        setWarehouses(wh)
        setMaterials(mat)
      })
      .catch(() => {})
  }, [])

  const warehouseItems = useMemo(() => warehouses.map(w => ({ value: String(w.id), label: w.name })), [warehouses])
  const materialItems = useMemo(() => materials.map(m => ({ value: String(m.id), label: `${m.code} - ${m.name}` })), [materials])

  /** 添加物料行 */
  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        materialId: 0,
        materialCode: '',
        materialName: '',
        spec: null,
        unitId: 0,
        unitName: '',
        conversionRate: 1,
        quantity: 0,
        lotId: null,
        remark: '',
      },
    ])
  }

  /** 选择物料 */
  const handleMaterialSelect = (index: number, materialIdStr: string) => {
    const mat = materials.find(m => String(m.id) === materialIdStr)
    if (!mat) return
    setLines(prev =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              materialId: mat.id,
              materialCode: mat.code,
              materialName: mat.name,
              spec: mat.spec,
              unitName: mat.unitName || '',
              conversionRate: 1,
            }
          : line,
      ),
    )
  }

  /** 更新数量 */
  const handleQtyChange = (index: number, value: string) => {
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, quantity: Number(value) || 0 } : line)))
  }

  /** 删除行 */
  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  /** 保存 */
  const handleSave = async () => {
    if (!fromWarehouseId || !toWarehouseId) {
      toast.error(t('selectFromWarehouse'))
      return
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error(t('sameWarehouseError'))
      return
    }
    const validLines = lines.filter(l => l.materialId > 0 && l.quantity > 0)
    if (validLines.length === 0) {
      toast.error(t('noItems'))
      return
    }

    setSaving(true)
    try {
      const items: SaveTransferItemParams[] = validLines.map(l => ({
        materialId: l.materialId,
        unitId: l.unitId,
        unitNameSnapshot: l.unitName,
        conversionRateSnapshot: l.conversionRate,
        quantity: l.quantity,
        lotId: l.lotId,
        remark: l.remark || undefined,
      }))
      await saveTransfer({
        id: transferId,
        fromWarehouseId: Number(fromWarehouseId),
        toWarehouseId: Number(toWarehouseId),
        transferDate,
        remark: remark || undefined,
        items,
      })
      toast.success('保存成功')
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  /** 确认调拨 */
  const handleConfirm = async () => {
    if (!transferId) return
    if (!window.confirm(t('confirmTransferTip'))) return
    try {
      await confirmTransfer(transferId)
      toast.success('确认成功')
      onBack()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : '确认失败')
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
          <h1 className="text-foreground text-2xl font-bold">{detail ? `${t('transferNo')}: ${detail.transfer_no}` : t('createTransfer')}</h1>
          {detail && (
            <div className="flex items-center gap-2 mt-1">
              {detail.status === 'draft' ? (
                <Badge variant="outline">{t('statusDraft')}</Badge>
              ) : (
                <Badge variant="default">{t('statusConfirmed')}</Badge>
              )}
            </div>
          )}
        </div>
        {isEditable && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? tc('loading') : tc('save')}
            </Button>
            {detail && (
              <Button onClick={handleConfirm}>
                <CheckCircle data-icon="inline-start" />
                {t('confirmTransfer')}
              </Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
      ) : (
        <>
          {/* 表头信息 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('fromWarehouse')}</label>
                {isEditable ? (
                  <Select value={fromWarehouseId} onValueChange={v => v && setFromWarehouseId(v)} items={warehouseItems}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectFromWarehouse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseItems.map(i => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">{detail?.from_warehouse_name}</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('toWarehouse')}</label>
                {isEditable ? (
                  <Select value={toWarehouseId} onValueChange={v => v && setToWarehouseId(v)} items={warehouseItems}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectToWarehouse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseItems.map(i => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">{detail?.to_warehouse_name}</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('transferDate')}</label>
                {isEditable ? (
                  <Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
                ) : (
                  <span className="text-sm">{detail?.transfer_date}</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">备注</label>
                {isEditable ? (
                  <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder="可选" />
                ) : (
                  <span className="text-sm text-muted-foreground">{detail?.remark || '-'}</span>
                )}
              </div>
            </div>
          </div>

          {/* 物料明细 */}
          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-medium">调拨明细</h3>
              {isEditable && (
                <Button variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus data-icon="inline-start" />
                  {t('addItem')}
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">物料</TableHead>
                  <TableHead className="w-[100px]">规格</TableHead>
                  <TableHead className="w-[80px]">单位</TableHead>
                  <TableHead className="w-[120px] text-right">数量</TableHead>
                  <TableHead className="w-[160px]">备注</TableHead>
                  {isEditable && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isEditable ? 6 : 5} className="text-center text-muted-foreground py-12">
                      {t('noItems')}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, index) => (
                    <TableRow key={line.key}>
                      <TableCell>
                        {isEditable ? (
                          <Select
                            value={line.materialId > 0 ? String(line.materialId) : ''}
                            onValueChange={v => v && handleMaterialSelect(index, v)}
                            items={materialItems}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择物料" />
                            </SelectTrigger>
                            <SelectContent>
                              {materialItems.map(i => (
                                <SelectItem key={i.value} value={i.value}>
                                  {i.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div>
                            <span className="font-mono text-sm">{line.materialCode}</span>
                            <span className="ml-2">{line.materialName}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{line.spec || '-'}</TableCell>
                      <TableCell>{line.unitName || '-'}</TableCell>
                      <TableCell className="text-right">
                        {isEditable ? (
                          <Input
                            type="number"
                            value={line.quantity || ''}
                            onChange={e => handleQtyChange(index, e.target.value)}
                            className="w-[100px] ml-auto text-right"
                            min={0}
                          />
                        ) : (
                          <span className="font-mono">{line.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditable ? (
                          <Input
                            value={line.remark}
                            onChange={e => setLines(prev => prev.map((l, i) => (i === index ? { ...l, remark: e.target.value } : l)))}
                            placeholder="可选"
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">{line.remark || '-'}</span>
                        )}
                      </TableCell>
                      {isEditable && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveLine(index)} className="text-red-600">
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
