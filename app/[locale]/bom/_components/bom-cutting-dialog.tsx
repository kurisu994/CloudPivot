'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import type { BomCuttingPageRow } from './bom-command-args'

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

interface BomCuttingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 弹窗标题中的物料名 */
  materialLabel: string
  details: BomCuttingPageRow[]
  onSave: (details: BomCuttingPageRow[]) => void
}

const EMPTY_ROW: BomCuttingPageRow = {
  part_name: null,
  length_mm: null,
  width_mm: null,
  height_mm: null,
  qty: 1,
  spec: null,
  remark: null,
  sort_order: 0,
}

/** 单行体积（m³）：长宽高齐全时计算，否则返回 null */
function rowVolume(row: BomCuttingPageRow): number | null {
  if (row.length_mm == null || row.width_mm == null || row.height_mm == null) return null
  return (row.length_mm * row.width_mm * row.height_mm * row.qty) / 1e9
}

/**
 * BOM 开料明细编辑弹窗：按部位维护长/宽/高、数量与规格文本，
 * 对标 Excel 海绵/木方/包装开料 sheet 的行结构，体积列自动计算。
 */
export function BomCuttingDialog({ open, onOpenChange, materialLabel, details, onSave }: BomCuttingDialogProps) {
  const t = useTranslations('bom')

  const [rows, setRows] = useState<BomCuttingPageRow[]>([])

  // 弹窗打开时用当前明细初始化本地编辑副本
  useEffect(() => {
    if (open) {
      setRows(details.length > 0 ? details.map(d => ({ ...d })) : [{ ...EMPTY_ROW }])
    }
  }, [open, details])

  const setRowField = <K extends keyof BomCuttingPageRow>(index: number, key: K, value: BomCuttingPageRow[K]) => {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const handleAddRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }])

  const handleRemoveRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index))

  const handleSave = () => {
    // 过滤掉完全空白的行，按当前顺序重排 sort_order
    const cleaned = rows
      .filter(row => row.part_name || row.length_mm != null || row.width_mm != null || row.height_mm != null || row.spec)
      .map((row, index) => ({ ...row, qty: row.qty > 0 ? row.qty : 1, sort_order: index + 1 }))
    onSave(cleaned)
  }

  const totalVolume = rows.reduce((sum, row) => sum + (rowVolume(row) ?? 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[56rem]">
        <DialogHeader>
          <DialogTitle>
            {t('cutting.title')}
            <span className="text-muted-foreground ml-2 text-sm font-normal">{materialLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[8rem]">{t('cutting.partName')}</TableHead>
                <TableHead className="w-[6rem]">{t('cutting.length')}</TableHead>
                <TableHead className="w-[6rem]">{t('cutting.width')}</TableHead>
                <TableHead className="w-[6rem]">{t('cutting.height')}</TableHead>
                <TableHead className="w-[5rem]">{t('cutting.qty')}</TableHead>
                <TableHead className="min-w-[8rem]">{t('cutting.spec')}</TableHead>
                <TableHead className="min-w-[7rem]">{t('cutting.remark')}</TableHead>
                <TableHead className="w-[6rem]">{t('cutting.volume')}</TableHead>
                <TableHead className="w-[3rem]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const volume = rowVolume(row)
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Input value={row.part_name ?? ''} onChange={e => setRowField(index, 'part_name', e.target.value || null)} />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.length_mm ?? ''}
                        onChange={e => setRowField(index, 'length_mm', parseFloat(e.target.value) || null)}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.width_mm ?? ''}
                        onChange={e => setRowField(index, 'width_mm', parseFloat(e.target.value) || null)}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.height_mm ?? ''}
                        onChange={e => setRowField(index, 'height_mm', parseFloat(e.target.value) || null)}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.qty} onChange={e => setRowField(index, 'qty', parseFloat(e.target.value) || 0)} min={0} />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.spec ?? ''}
                        onChange={e => setRowField(index, 'spec', e.target.value || null)}
                        placeholder={t('cutting.specPlaceholder')}
                      />
                    </TableCell>
                    <TableCell>
                      <Input value={row.remark ?? ''} onChange={e => setRowField(index, 'remark', e.target.value || null)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{volume != null ? volume.toFixed(4) : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveRow(index)}>
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="mt-3 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleAddRow}>
              <Plus data-icon="inline-start" />
              {t('cutting.addRow')}
            </Button>
            {totalVolume > 0 && (
              <span className="text-muted-foreground text-sm">
                {t('cutting.totalVolume')}: <span className="font-mono font-medium">{totalVolume.toFixed(4)}</span> m³
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('actions.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
