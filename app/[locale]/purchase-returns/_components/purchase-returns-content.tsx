'use client'

import { useState } from 'react'
import { ReturnExecutePage } from './return-execute-page'
import { ReturnListPage } from './return-list-page'

/**
 * 采购退货主内容组件
 */
export function PurchaseReturnsContent() {
  const [view, setView] = useState<'list' | 'execute'>('list')
  const [inboundId, setInboundId] = useState<number | null>(null)

  const handleNewReturn = (id: number) => {
    setInboundId(id)
    setView('execute')
  }

  const handleBackToList = () => {
    setView('list')
    setInboundId(null)
  }

  if (view === 'execute' && inboundId) {
    return <ReturnExecutePage inboundId={inboundId} onBack={handleBackToList} />
  }

  return <ReturnListPage onNewReturn={handleNewReturn} />
}
