'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { SalesOrderEditPage } from './sales-order-edit-page'
import { SalesOrderListPage } from './sales-order-list-page'

/**
 * 销售单管理主内容组件
 * 管理列表页和编辑页之间的视图切换
 */
export function SalesOrdersContent() {
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

  /** 编辑销售单 */
  const handleEdit = (id: number) => {
    setEditingOrderId(id)
    setView('edit')
  }

  /** 新建销售单 */
  const handleNew = () => {
    setEditingOrderId(null)
    setView('edit')
  }

  /** 从销售单进入销售出库 */
  const handleOutbound = (id: number) => {
    router.push(`/sales-deliveries?salesId=${id}`)
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setEditingOrderId(null)
  }

  if (view === 'edit') {
    return <SalesOrderEditPage orderId={editingOrderId} onBack={handleBackToList} />
  }

  return <SalesOrderListPage onEdit={handleEdit} onNew={handleNew} onOutbound={handleOutbound} />
}
