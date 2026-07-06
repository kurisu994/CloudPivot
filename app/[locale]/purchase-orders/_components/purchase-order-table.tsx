'use client'

import { Ban, Check, Eye, PackageCheck, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
import type { PurchaseOrderListItem } from '@/lib/tauri'
import { PurchaseOrderDetailDialog } from './purchase-order-detail-dialog'

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
  onInbound: (order: PurchaseOrderListItem) => void
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
  onInbound,
  onCancel,
  onDelete,
}: PurchaseOrderTableProps) {
  const t = useTranslations('purchase')
  const tc = useTranslations('common')
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null)

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
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => setDetailOrderId(order.id)} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
        <Button key="inbound" variant="ghost" size="icon-sm" onClick={() => onInbound(order)} title={t('inbound')}>
          <PackageCheck className="size-3.5" />
        </Button>,
        <Button key="cancel" variant="ghost" size="icon-sm" onClick={() => onCancel(order)} title={t('cancelOrder')}>
          <Ban className="size-3.5" />
        </Button>,
      )
    } else if (order.status === 'partial_in') {
      // 部分入库：详情、继续入库
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => setDetailOrderId(order.id)} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
        <Button key="continue" variant="ghost" size="icon-sm" onClick={() => onInbound(order)} title={t('continueInbound')}>
          <PackageCheck className="size-3.5" />
        </Button>,
      )
    } else {
      // 已入库、已作废：仅详情
      actions.push(
        <Button key="detail" variant="ghost" size="icon-sm" onClick={() => setDetailOrderId(order.id)} title={t('details')}>
          <Eye className="size-3.5" />
        </Button>,
      )
    }

    return <div className="flex items-center justify-end gap-1">{actions}</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
        <BusinessListTableShell
          className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          tableClassName="min-w-[60rem]"
        >
          <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-[8.75rem] ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}>{t('orderNo')}</TableHead>
              <TableHead className="w-[7.5rem]">{t('supplier')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('orderDate')}</TableHead>
              <TableHead className="w-[4rem]">{t('currency')}</TableHead>
              <TableHead className="w-[5rem]">{tc('status')}</TableHead>
              <TableHead className="w-[6.25rem] text-right">{t('payableAmount')}</TableHead>
              <TableHead className="w-[5.5rem]">{t('inboundProgress')}</TableHead>
              <TableHead className="w-[5rem]">{t('warehouse')}</TableHead>
              <TableHead className="w-[4rem]">{t('createdBy')}</TableHead>
              <TableHead className="w-[6.875rem] text-right">{tc('actions')}</TableHead>
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
                  <TableCell className={`font-mono text-xs font-medium ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>{order.orderNo}</TableCell>

                  {/* 供应商 */}
                  <TableCell>
                    <div className="truncate font-medium">{order.supplierName}</div>
                  </TableCell>

                  {/* 采购日期 */}
                  <TableCell className="text-sm">{order.orderDate}</TableCell>

                  {/* 币种 */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {order.currency}
                    </Badge>
                  </TableCell>

                  {/* 状态 */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.draft}`}
                    >
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
                  <TableCell className="text-right">{renderActions(order)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </BusinessListTableShell>
      </div>

      <div className="shrink-0 pt-4">
        <BusinessListTableFooter>
          <span className="text-xs font-bold text-slate-400">{t('totalRecords', { count: total })}</span>
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        </BusinessListTableFooter>
      </div>

      {/* 采购单详情弹窗 */}
      <PurchaseOrderDetailDialog orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  )
}
