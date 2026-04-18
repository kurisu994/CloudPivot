'use client'

import { Ban, Check, Eye, PackageCheck, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { PurchaseOrderListItem } from '@/lib/tauri'
import { toast } from 'sonner'
import { PaginationControls } from '@/components/common/pagination'

/** 状态对应的样式 */
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  partial_in: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

/** 状态翻译键映射 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'statusDraft',
  approved: 'statusApproved',
  partial_in: 'statusPartialIn',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
}

interface PurchaseOrderTableProps {
  orders: PurchaseOrderListItem[]
  loading?: boolean
  total: number
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (order: PurchaseOrderListItem) => void
  onApprove: (order: PurchaseOrderListItem) => void
  onCancel: (order: PurchaseOrderListItem) => void
  onDelete: (order: PurchaseOrderListItem) => void
}

export function PurchaseOrderTable({
  orders,
  loading,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onApprove,
  onCancel,
  onDelete,
}: PurchaseOrderTableProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')

  const pageSizeItems = [
    { value: '10', label: t('perPage', { count: '10' }) },
    { value: '20', label: t('perPage', { count: '20' }) },
    { value: '50', label: t('perPage', { count: '50' }) },
  ]

  /** 根据状态渲染操作按钮 */
  const renderActions = (order: PurchaseOrderListItem) => {
    const actions: React.ReactNode[] = []

    if (order.status === 'draft') {
      // 草稿：编辑、审核、删除
      actions.push(
        <Button key="edit" variant="ghost" size="icon-sm" onClick={() => onEdit(order)} title={tc('edit')}>
          <Pencil className="size-3.5" />
        </Button>,
        <Button key="approve" variant="ghost" size="icon-sm" onClick={() => onApprove(order)} title={t('approve')}>
          <Check className="size-3.5" />
        </Button>,
        <Button key="delete" variant="ghost" size="icon-sm" onClick={() => onDelete(order)} title={tc('delete')}>
          <Trash2 className="size-3.5" />
        </Button>,
      )
    } else if (order.status === 'approved') {
      // 已审核：详情、入库、作废
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
        <Button key="inbound" variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('inbound')}>
          <PackageCheck className="size-3.5" />
        </Button>,
        <Button key="cancel" variant="ghost" size="icon-sm" onClick={() => onCancel(order)} title={t('cancelOrder')}>
          <Ban className="size-3.5" />
        </Button>,
      )
    } else if (order.status === 'partial_in') {
      // 部分入库：详情、继续入库
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
        <Button key="continue" variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('continueInbound')}>
          <PackageCheck className="size-3.5" />
        </Button>,
      )
    } else {
      // 已入库、已作废：仅详情
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => toast.info(tc('developing'))} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
      )
    }

    return <div className="flex items-center justify-end gap-1">{actions}</div>
  }

  return (
    <BusinessListTableShell
      className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      tableClassName="min-w-[1200px]"
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
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
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
          <TableHead className={`w-[180px] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('orderNo')}</TableHead>
          <TableHead className="w-[160px]">{t('supplier')}</TableHead>
          <TableHead className="w-[110px]">{t('orderDate')}</TableHead>
          <TableHead className="w-[80px]">{t('currency')}</TableHead>
          <TableHead className="w-[100px]">{tc('status')}</TableHead>
          <TableHead className="w-[130px] text-right">{t('payableAmount')}</TableHead>
          <TableHead className="w-[110px]">{t('inboundProgress')}</TableHead>
          <TableHead className="w-[100px]">{t('warehouse')}</TableHead>
          <TableHead className="w-[80px]">{t('createdBy')}</TableHead>
          <TableHead className="w-[140px] text-right">{tc('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={10} />
        ) : orders.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={10} message={tc('noData')} />
        ) : (
          orders.map(order => (
            <TableRow key={order.id} className="group">
              {/* 采购单号（固定首列） */}
              <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>
                {order.orderNo}
              </TableCell>

              {/* 供应商 */}
              <TableCell>
                <div className="truncate font-medium">{order.supplierName}</div>
              </TableCell>

              {/* 采购日期 */}
              <TableCell className="text-sm">{order.orderDate}</TableCell>

              {/* 币种 */}
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">{order.currency}</Badge>
              </TableCell>

              {/* 状态 */}
              <TableCell>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.draft}`}>
                  {t(STATUS_LABEL_KEYS[order.status] || 'statusDraft')}
                </span>
              </TableCell>

              {/* 订单总金额 */}
              <TableCell className="text-right font-medium">
                {formatAmount(order.payableAmount, order.currency as 'VND' | 'CNY' | 'USD')}
              </TableCell>

              {/* 入库进度 */}
              <TableCell>
                <span className="text-muted-foreground text-sm">
                  {t('progressFormat', {
                    received: order.receivedItemCount,
                    total: order.itemCount,
                  })}
                </span>
              </TableCell>

              {/* 入库仓库 */}
              <TableCell className="text-sm">{order.warehouseName}</TableCell>

              {/* 创建人 */}
              <TableCell className="text-sm">{order.createdByName ?? '—'}</TableCell>

              {/* 操作 */}
              <TableCell className="text-right">
                {renderActions(order)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </BusinessListTableShell>
  )
}
