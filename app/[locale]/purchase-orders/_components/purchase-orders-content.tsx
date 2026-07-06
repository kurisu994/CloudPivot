'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { PurchaseOrderEditPage } from './purchase-order-edit-page'
import { PurchaseOrderListPage } from './purchase-order-list-page'

/**
 * 采购单管理主内容组件
 * 管理列表页和编辑页之间的视图切换
 */
export function PurchaseOrdersContent() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // 处理 URL 参数 ?action=new（从 Dashboard 快捷操作跳转）
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setEditingOrderId(null)
      setView('edit')
    }
  }, [searchParams])

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

  /** 从采购单进入采购入库 */
  const handleInbound = (id: number) => {
    router.push(`/purchase-receipts?purchaseId=${id}`)
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setEditingOrderId(null)
  }

  if (view === 'edit') {
    return <PurchaseOrderEditPage orderId={editingOrderId} onBack={handleBackToList} />
  }

  return <PurchaseOrderListPage onEdit={handleEdit} onInbound={handleInbound} onNew={handleNew} />
}
