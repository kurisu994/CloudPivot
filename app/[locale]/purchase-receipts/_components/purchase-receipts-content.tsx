'use client'

import { useState } from 'react'
import { InboundExecutePage } from './inbound-execute-page'
import { InboundListPage } from './inbound-list-page'

/**
 * 采购入库主内容组件
 * 管理列表页和入库执行页之间的视图切换
 */
export function PurchaseReceiptsContent() {
  const [view, setView] = useState<'list' | 'execute'>('list')
  /** 关联的采购单 ID（从采购单跳转入库时传入） */
  const [purchaseId, setPurchaseId] = useState<number | null>(null)

  /** 新建入库单（关联采购单） */
  const handleNewInbound = (poId: number) => {
    setPurchaseId(poId)
    setView('execute')
  }

  /** 新建入库单（不关联采购单） */
  const handleNewFreeInbound = () => {
    setPurchaseId(null)
    setView('execute')
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setPurchaseId(null)
  }

  if (view === 'execute') {
    return <InboundExecutePage purchaseId={purchaseId} onBack={handleBackToList} />
  }

  return <InboundListPage onNewInbound={handleNewInbound} onNewFreeInbound={handleNewFreeInbound} />
}
