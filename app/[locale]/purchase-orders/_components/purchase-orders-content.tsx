'use client'

import { useState } from 'react'
import { PurchaseOrderEditPage } from './purchase-order-edit-page'
import { PurchaseOrderListPage } from './purchase-order-list-page'

/**
 * 采购单管理主内容组件
 * 管理列表页和编辑页之间的视图切换
 */
export function PurchaseOrdersContent() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)

  /** 编辑采购单 */
  const handleEdit = (id: number) => {
    setEditingOrderId(id)
    setView('edit')
  }

  /** 新建采购单 */
  const handleNew = () => {
    setEditingOrderId(null)
    setView('edit')
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setEditingOrderId(null)
  }

  if (view === 'edit') {
    return <PurchaseOrderEditPage orderId={editingOrderId} onBack={handleBackToList} />
  }

  return <PurchaseOrderListPage onEdit={handleEdit} onNew={handleNew} />
}
