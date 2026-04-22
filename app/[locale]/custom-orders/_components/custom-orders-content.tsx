'use client'

import { useState } from 'react'
import { CustomOrderDetailPage } from './custom-order-detail'
import { CustomOrderListPage } from './custom-order-list-page'

/**
 * 定制单管理主内容组件
 * 管理列表页和详情/编辑页之间的视图切换
 */
export function CustomOrdersContent() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)

  /** 查看/编辑定制单 */
  const handleEdit = (id: number) => {
    setEditingOrderId(id)
    setView('detail')
  }

  /** 新建定制单 */
  const handleNew = () => {
    setEditingOrderId(null)
    setView('detail')
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setEditingOrderId(null)
  }

  if (view === 'detail') {
    return <CustomOrderDetailPage orderId={editingOrderId} onBack={handleBackToList} />
  }

  return <CustomOrderListPage onEdit={handleEdit} onNew={handleNew} />
}
