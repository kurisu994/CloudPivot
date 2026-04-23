'use client'

import { ArrowLeft, CheckCircle, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockCheckDetail, UpdateStockCheckItemParams } from '@/lib/tauri'
import { confirmStockCheck, getStockCheckDetail, updateStockCheckItems } from '@/lib/tauri'

interface StockCheckEditPageProps {
  checkId: number | null
  onBack: () => void
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
  const [confirming, setConfirming] = useState(false)

  // 实盘数量编辑
  const [editValues, setEditValues] = useState<Record<number, string>>({})

  const loadDetail = useCallback(async () => {
    if (!checkId) return
    setLoading(true)
    try {
      const d = await getStockCheckDetail(checkId)
      setDetail(d)
      // 初始化编辑值
      const vals: Record<number, string> = {}
      for (const item of d.items) {
        vals[item.id] = item.actual_qty !== null ? String(item.actual_qty) : ''
      }
      setEditValues(vals)
    } catch (error) {
      toast.error(typeof error === 'string' ? error : tc('loadDetailFailed'))
    } finally {
      setLoading(false)
    }
  }, [checkId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const isEditable = detail && (detail.status === 'draft' || detail.status === 'checking')

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
      toast.error(typeof error === 'string' ? error : tc('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  /** 审核确认 */
  const handleConfirm = async () => {
    if (!detail) return
    if (!window.confirm(t('confirmCheckTip'))) return
    setConfirming(true)
    try {
      await confirmStockCheck(detail.id)
      toast.success(tc('confirmSuccess'))
      await loadDetail()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : tc('confirmFailed'))
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
          <h1 className="text-foreground text-2xl font-bold">{detail ? `${t('checkNo')}: ${detail.check_no}` : t('title')}</h1>
          {detail && (
            <div className="flex items-center gap-3 mt-1 text-muted-foreground text-sm">
              {statusBadge(detail.status)}
              <span>
                {t('warehouse')}: {detail.warehouse_name}
              </span>
              <span>
                {t('checkDate')}: {detail.check_date}
              </span>
              {detail.created_by_name && (
                <span>
                  {t('createdBy')}: {detail.created_by_name}
                </span>
              )}
            </div>
          )}
        </div>
        {isEditable && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? tc('loading') : t('saveActualQty')}
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              <CheckCircle data-icon="inline-start" />
              {confirming ? tc('loading') : t('confirmCheck')}
            </Button>
          </div>
        )}
      </div>

      {/* 盘点明细表格 */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
      ) : detail ? (
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">{ti('materialCode')}</TableHead>
                <TableHead className="w-[160px]">{ti('materialName')}</TableHead>
                <TableHead className="w-[80px]">{ti('spec')}</TableHead>
                <TableHead className="w-[60px]">{ti('unit')}</TableHead>
                <TableHead className="w-[90px] text-right">{t('systemQty')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('actualQty')}</TableHead>
                <TableHead className="w-[90px] text-right">{t('diffQty')}</TableHead>
                <TableHead className="w-[100px] text-right">{t('diffAmount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {t('noItems')}
                  </TableCell>
                </TableRow>
              ) : (
                detail.items.map(item => {
                  const actualVal = editValues[item.id] ?? ''
                  const actualQty = actualVal !== '' ? Number(actualVal) : null
                  const diff = actualQty !== null ? actualQty - item.system_qty : 0
                  return (
                    <TableRow
                      key={item.id}
                      className={diff !== 0 ? (diff > 0 ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-red-50/50 dark:bg-red-950/20') : ''}
                    >
                      <TableCell className="font-mono text-sm">{item.material_code}</TableCell>
                      <TableCell>{item.material_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.spec || '-'}</TableCell>
                      <TableCell>{item.unit_name}</TableCell>
                      <TableCell className="text-right font-mono">{item.system_qty}</TableCell>
                      <TableCell className="text-right">
                        {isEditable ? (
                          <Input
                            type="number"
                            value={actualVal}
                            onChange={e => setEditValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-[100px] ml-auto text-right"
                            placeholder={t('inputActualQty')}
                          />
                        ) : (
                          <span className="font-mono">{item.actual_qty ?? '-'}</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''}`}>
                        {actualQty !== null ? (diff > 0 ? '+' : '') + diff : '-'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${item.diff_amount > 0 ? 'text-green-600' : item.diff_amount < 0 ? 'text-red-600' : ''}`}
                      >
                        {item.actual_qty !== null ? item.diff_amount.toFixed(2) : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
