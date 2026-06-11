'use client'

import { Eye, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BusinessListTableEmptyRow, BusinessListTableLoadingRows, BusinessListTableShell } from '@/components/common/business-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** 工单列表项 */
interface ProductionOrderListItem {
  id: number
  orderNo: string
  custom_order_no: string | null
  output_material_name: string
  planned_qty: number
  completed_qty: number
  status: string
  planned_start_date: string | null
  actual_start_date: string | null
  created_at: string | null
}

interface Props {
  items: ProductionOrderListItem[]
  loading: boolean
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}

/** 状态 → Badge variant 映射 */
function getStatusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'outline', label: t('statusOptions.draft') },
    picking: { variant: 'secondary', label: t('statusOptions.picking') },
    producing: { variant: 'default', label: t('statusOptions.producing') },
    completed: { variant: 'default', label: t('statusOptions.completed') },
    cancelled: { variant: 'destructive', label: t('statusOptions.cancelled') },
  }
  const info = map[status] ?? { variant: 'outline' as const, label: status }
  return <Badge variant={info.variant}>{info.label}</Badge>
}

const COLUMNS = 8
const TABLE_MIN_W = 'min-w-[47.5rem]'

/**
 * 生产工单表格组件
 */
export function ProductionOrderTable({ items, loading, onEdit, onDelete }: Props) {
  const t = useTranslations('productionOrders')

  return (
    <BusinessListTableShell tableClassName={TABLE_MIN_W}>
      <thead className="sticky top-0 z-30 bg-white dark:bg-slate-950">
        <tr className="border-b">
          <th className="bg-background sticky left-0 z-10 w-[8.125rem] px-3 py-2.5 text-left text-sm font-medium">{t('orderNo')}</th>
          <th className="w-[7.5rem] px-3 py-2.5 text-left text-sm font-medium">{t('outputMaterial')}</th>
          <th className="w-[5rem] px-3 py-2.5 text-right text-sm font-medium">{t('plannedQty')}</th>
          <th className="w-[5rem] px-3 py-2.5 text-right text-sm font-medium">{t('completedQty')}</th>
          <th className="w-[5rem] px-3 py-2.5 text-center text-sm font-medium">{t('status')}</th>
          <th className="w-[6rem] px-3 py-2.5 text-left text-sm font-medium">{t('relatedCustomOrder')}</th>
          <th className="w-[5.5rem] px-3 py-2.5 text-left text-sm font-medium">{t('actualStartDate')}</th>
          <th className="w-[5rem] px-3 py-2.5 text-right text-sm font-medium">{t('actions')}</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={COLUMNS} rows={5} />
        ) : items.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={COLUMNS} message={t('empty')} />
        ) : (
          items.map(item => (
            <tr key={item.id} className="hover:bg-muted/50 border-b transition-colors">
              <td className="bg-background sticky left-0 z-10 px-3 py-2.5 text-sm font-medium">{item.orderNo}</td>
              <td className="px-3 py-2.5 text-sm">{item.output_material_name}</td>
              <td className="px-3 py-2.5 text-right text-sm">{item.planned_qty}</td>
              <td className="px-3 py-2.5 text-right text-sm">
                {item.completed_qty} / {item.planned_qty}
              </td>
              <td className="px-3 py-2.5 text-center text-sm">{getStatusBadge(item.status, t)}</td>
              <td className="px-3 py-2.5 text-sm">{item.custom_order_no ?? '—'}</td>
              <td className="px-3 py-2.5 text-sm">{item.actual_start_date ?? '—'}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  {item.status === 'draft' ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </BusinessListTableShell>
  )
}
