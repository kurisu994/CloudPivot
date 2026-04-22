'use client'

import { Ban, Check, Eye, Pencil, ShoppingCart, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'

/** 定制单列表项 */
export interface CustomOrderListItem {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  order_date: string
  delivery_date: string | null
  currency: string
  custom_type: string
  priority: string
  status: string
  ref_material_name: string | null
  quote_amount: number
  cost_amount: number
  item_count: number
  created_at: string | null
}

/** 状态对应的样式 */
const STATUS_STYLES: Record<string, string> = {
  quoting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  producing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

/** 状态翻译键映射 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  quoting: 'statusQuoting',
  confirmed: 'statusConfirmed',
  producing: 'statusProducing',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
}

/** 定制类型翻译键映射 */
const TYPE_LABEL_KEYS: Record<string, string> = {
  size: 'typeSize',
  material: 'typeMaterial',
  full: 'typeFull',
}

/** 优先级样式 */
const PRIORITY_STYLES: Record<string, string> = {
  normal: '',
  urgent: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400 font-bold',
}

/** 优先级翻译键映射 */
const PRIORITY_LABEL_KEYS: Record<string, string> = {
  normal: 'priorityNormal',
  urgent: 'priorityUrgent',
  critical: 'priorityCritical',
}

interface CustomOrderTableProps {
  orders: CustomOrderListItem[]
  loading?: boolean
  total: number
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (order: CustomOrderListItem) => void
  onConfirm: (order: CustomOrderListItem) => void
  onCancel: (order: CustomOrderListItem) => void
  onDelete: (order: CustomOrderListItem) => void
}

export function CustomOrderTable({
  orders,
  loading,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onConfirm,
  onCancel,
  onDelete,
}: CustomOrderTableProps) {
  const t = useTranslations('customOrders')
  const tc = useTranslations('common')

  const pageSizeItems = [
    { value: '10', label: t('perPage', { count: '10' }) },
    { value: '20', label: t('perPage', { count: '20' }) },
    { value: '50', label: t('perPage', { count: '50' }) },
  ]

  /** 根据状态渲染操作按钮 */
  const renderActions = (order: CustomOrderListItem) => {
    const actions: React.ReactNode[] = []

    if (order.status === 'quoting') {
      // 报价中：编辑、确认、删除
      actions.push(
        <Button key="edit" variant="ghost" size="icon-sm" onClick={() => onEdit(order)} title={tc('edit')}>
          <Pencil className="size-3.5" />
        </Button>,
        <Button key="confirm" variant="ghost" size="icon-sm" onClick={() => onConfirm(order)} title={t('confirm')}>
          <Check className="size-3.5" />
        </Button>,
        <Button key="delete" variant="ghost" size="icon-sm" onClick={() => onDelete(order)} title={tc('delete')}>
          <Trash2 className="size-3.5" />
        </Button>,
      )
    } else if (order.status === 'confirmed') {
      // 已确认：详情、取消
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => onEdit(order)} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
        <Button key="cancel" variant="ghost" size="icon-sm" onClick={() => onCancel(order)} title={t('cancel')}>
          <Ban className="size-3.5" />
        </Button>,
      )
    } else {
      // 其他状态：仅详情
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => onEdit(order)} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
      )
    }

    return <div className="flex items-center justify-end gap-1">{actions}</div>
  }

  return (
    <BusinessListTableShell
      className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      tableClassName="min-w-[1100px]"
      footer={
        <BusinessListTableFooter>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="font-medium">{t('totalRecords', { count: total })}</span>
            <Select value={pageSize.toString()} onValueChange={v => v && onPageSizeChange(parseInt(v))} items={pageSizeItems}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        </BusinessListTableFooter>
      }
    >
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`w-[170px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('orderNo')}</TableHead>
          <TableHead className="w-[140px]">{t('customer')}</TableHead>
          <TableHead className="w-[90px]">{t('customType')}</TableHead>
          <TableHead className="w-[120px]">{t('refProduct')}</TableHead>
          <TableHead className="w-[120px] text-right">{t('quoteAmount')}</TableHead>
          <TableHead className="w-[70px]">{t('priority')}</TableHead>
          <TableHead className="w-[90px]">{tc('status')}</TableHead>
          <TableHead className="w-[100px]">{t('orderDate')}</TableHead>
          <TableHead className="w-[100px] text-right">{tc('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={9} />
        ) : orders.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={9} message={tc('noData')} />
        ) : (
          orders.map(order => (
            <TableRow key={order.id} className="group">
              {/* 定制单号（固定首列） */}
              <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{order.order_no}</TableCell>

              {/* 客户 */}
              <TableCell>
                <div className="truncate font-medium">{order.customer_name}</div>
              </TableCell>

              {/* 定制类型 */}
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {t(TYPE_LABEL_KEYS[order.custom_type] || 'typeFull')}
                </Badge>
              </TableCell>

              {/* 参考产品 */}
              <TableCell className="text-sm">{order.ref_material_name || '—'}</TableCell>

              {/* 报价金额 */}
              <TableCell className="text-right font-medium">{formatAmount(order.quote_amount, order.currency as 'VND' | 'CNY' | 'USD')}</TableCell>

              {/* 优先级 */}
              <TableCell>
                <span className={`text-sm ${PRIORITY_STYLES[order.priority] || ''}`}>
                  {t(PRIORITY_LABEL_KEYS[order.priority] || 'priorityNormal')}
                </span>
              </TableCell>

              {/* 状态 */}
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.quoting}`}
                >
                  {t(STATUS_LABEL_KEYS[order.status] || 'statusQuoting')}
                </span>
              </TableCell>

              {/* 日期 */}
              <TableCell className="text-sm">{order.order_date}</TableCell>

              {/* 操作 */}
              <TableCell className="text-right">{renderActions(order)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </BusinessListTableShell>
  )
}
