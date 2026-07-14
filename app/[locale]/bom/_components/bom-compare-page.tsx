'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { BUSINESS_LIST_STICKY_CELL_CLASS, BUSINESS_LIST_STICKY_HEAD_CLASS, BusinessListTableShell } from '@/components/common/business-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/error'
import { invoke, isTauriEnv } from '@/lib/tauri'
import { type BomDetailPageState, type BomDetailResponse, normalizeBomDetail } from './bom-command-args'
import { compareProcessSteps, translateProcessStep } from './process-steps'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/** 比较表中的一行：同一物料在各 BOM 中的标准用量并排展示 */
interface CompareRow {
  childMaterialId: number
  materialCode: string | null
  materialName: string | null
  materialNameVi: string | null
  spec: string | null
  unitName: string | null
  /** 与 details 顺序对应的各 BOM 用量，null 表示该 BOM 未使用此物料 */
  qtys: (number | null)[]
  total: number
}

/* ------------------------------------------------------------------ */
/*  Mock 数据（dev-web 环境）                                           */
/* ------------------------------------------------------------------ */

function mockItem(row: {
  child_material_id: number
  materialCode: string
  materialName: string
  materialNameVi: string | null
  material_spec: string | null
  unitName: string
  standard_qty: number
  process_step: string | null
}): BomDetailPageState['items'][number] {
  return {
    ...row,
    ref_cost_price: 0,
    wastage_rate: 0,
    actual_qty: row.standard_qty,
    is_key_part: false,
    substitute_id: null,
    substitute_name: null,
    remark: null,
    sort_order: 0,
    cutting_details: [],
  }
}

const MOCK_COMPARE_DETAILS: BomDetailPageState[] = [
  {
    id: 1,
    bom_code: 'BOM-20260401-001',
    materialId: 4,
    materialCode: 'FP-001',
    materialName: '单人电动沙发',
    material_spec: '1人位',
    version: 'V1.0',
    status: 'active',
    effective_date: '2026-06-01',
    total_standard_cost: 0,
    remark: null,
    container_qty: 95,
    items: [
      mockItem({
        child_material_id: 21,
        materialCode: 'M-0021',
        materialName: '黑色无纺布100g',
        materialNameVi: 'Vải không dệt đen',
        material_spec: '1.6米幅宽',
        unitName: '米',
        standard_qty: 2.2,
        process_step: 'sewing',
      }),
      mockItem({
        child_material_id: 7,
        materialCode: 'M-0007',
        materialName: '木方',
        materialNameVi: 'Thanh gỗ',
        material_spec: '40×40',
        unitName: '根',
        standard_qty: 4,
        process_step: 'woodworking',
      }),
    ],
  },
  {
    id: 2,
    bom_code: 'BOM-20260401-002',
    materialId: 5,
    materialCode: 'FP-002',
    materialName: '三人电动沙发',
    material_spec: '3人位',
    version: 'V1.0',
    status: 'active',
    effective_date: '2026-06-01',
    total_standard_cost: 0,
    remark: null,
    container_qty: 38,
    items: [
      mockItem({
        child_material_id: 21,
        materialCode: 'M-0021',
        materialName: '黑色无纺布100g',
        materialNameVi: 'Vải không dệt đen',
        material_spec: '1.6米幅宽',
        unitName: '米',
        standard_qty: 4.4,
        process_step: 'sewing',
      }),
      mockItem({
        child_material_id: 7,
        materialCode: 'M-0007',
        materialName: '木方',
        materialNameVi: 'Thanh gỗ',
        material_spec: '40×40',
        unitName: '根',
        standard_qty: 9,
        process_step: 'woodworking',
      }),
      mockItem({
        child_material_id: 22,
        materialCode: 'M-0022',
        materialName: '五金排位脚',
        materialNameVi: 'Chân sắt',
        material_spec: '中位',
        unitName: '个',
        standard_qty: 1,
        process_step: 'ironwork',
      }),
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

interface BomComparePageProps {
  bomIds: number[]
  onBack: () => void
}

/** 数量展示：整数原样，小数保留两位 */
function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
}

/**
 * 多 SKU BOM 用量比较视图：按工序分组、物料合并行，
 * 并排展示各 BOM 的标准用量与合计（对标 Excel 多配置汇总 sheet）。
 */
export function BomComparePage({ bomIds, onBack }: BomComparePageProps) {
  const t = useTranslations('bom')

  const [details, setDetails] = useState<BomDetailPageState[]>([])
  const [loading, setLoading] = useState(true)

  /** 加载所有参与比较的 BOM 详情 */
  const fetchDetails = useCallback(async () => {
    setLoading(true)
    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 200))
      setDetails(MOCK_COMPARE_DETAILS)
      setLoading(false)
      return
    }
    try {
      const responses = await Promise.all(bomIds.map(id => invoke<BomDetailResponse>('get_bom_detail', { id })))
      setDetails(responses.map(normalizeBomDetail))
    } catch (e) {
      toast.error(getErrorMessage(e, t('notifications.loadFailed')))
    } finally {
      setLoading(false)
    }
  }, [bomIds, t])

  useEffect(() => {
    void fetchDetails()
  }, [fetchDetails])

  /** 按工序分组，组内按物料合并行；同一 BOM 同工序下重复物料累加用量 */
  const groupedRows = useMemo(() => {
    const groups = new Map<string, Map<number, CompareRow>>()
    details.forEach((detail, bomIndex) => {
      for (const item of detail.items) {
        const step = item.process_step || ''
        let rows = groups.get(step)
        if (!rows) {
          rows = new Map()
          groups.set(step, rows)
        }
        let row = rows.get(item.child_material_id)
        if (!row) {
          row = {
            childMaterialId: item.child_material_id,
            materialCode: item.materialCode,
            materialName: item.materialName,
            materialNameVi: item.materialNameVi,
            spec: item.material_spec,
            unitName: item.unitName,
            qtys: details.map(() => null),
            total: 0,
          }
          rows.set(item.child_material_id, row)
        }
        row.qtys[bomIndex] = (row.qtys[bomIndex] ?? 0) + item.standard_qty
        row.total += item.standard_qty
      }
    })

    return Array.from(groups.entries())
      .sort(([a], [b]) => compareProcessSteps(a, b))
      .map(([step, rows]) => ({ step, rows: Array.from(rows.values()) }))
  }, [details])

  const hasRows = groupedRows.length > 0
  // 物料 + 规格 + 单位 + 各 BOM 列 + 合计
  const totalColumns = 3 + details.length + 1

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          {t('actions.backToList')}
        </Button>
        <h2 className="text-foreground font-semibold">{t('compare.title')}</h2>
      </div>

      {/* 比较表 */}
      {loading ? (
        <div className="border-border bg-card text-muted-foreground flex min-h-0 flex-1 items-center justify-center rounded-xl border py-20 shadow-sm">
          {t('loading')}
        </div>
      ) : !hasRows ? (
        <div className="border-border bg-card text-muted-foreground flex min-h-0 flex-1 items-center justify-center rounded-xl border py-20 shadow-sm">
          {t('compare.empty')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
          <BusinessListTableShell className="border-border bg-card rounded-xl border shadow-sm" tableClassName="table-auto">
            <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
              <TableRow>
                <TableHead className={`min-w-[12rem] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('items.materialName')}</TableHead>
                <TableHead className="min-w-[7rem]">{t('items.spec')}</TableHead>
                <TableHead className="w-[4rem]">{t('items.unit')}</TableHead>
                {details.map(detail => (
                  <TableHead key={detail.id} className="min-w-[7rem]">
                    <div className="min-w-0">
                      <div className="truncate">{detail.materialName ?? detail.bom_code}</div>
                      <div className="text-muted-foreground text-xs font-normal">{detail.version}</div>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="min-w-[5rem] font-semibold">{t('compare.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedRows.map(({ step, rows }) => (
                <Fragment key={step}>
                  {/* 工序分组标题行 */}
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={totalColumns} className="py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                          {step ? translateProcessStep(step, t) : t('items.ungrouped')}
                        </Badge>
                        <span className="text-muted-foreground">({t('items.groupCount', { count: rows.length })})</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {rows.map(row => (
                    <TableRow key={`${step}-${row.childMaterialId}`} className="group">
                      <TableCell className={BUSINESS_LIST_STICKY_CELL_CLASS}>
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {row.materialName}
                            {row.materialNameVi && <span className="text-muted-foreground ml-1.5 text-xs font-normal">({row.materialNameVi})</span>}
                          </div>
                          <div className="text-muted-foreground truncate text-xs">{row.materialCode}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate">{row.spec ?? '—'}</TableCell>
                      <TableCell>{row.unitName ?? '—'}</TableCell>
                      {row.qtys.map((qty, qtyIndex) => (
                        <TableCell key={details[qtyIndex]?.id ?? qtyIndex} className="font-mono">
                          {qty != null ? formatQty(qty) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className="font-mono font-semibold">{formatQty(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </BusinessListTableShell>
        </div>
      )}
    </div>
  )
}
