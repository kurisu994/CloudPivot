'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
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
  const searchParams = useSearchParams()
  const router = useRouter()

  // 支持从采购单列表通过 ?purchaseId=xxx 直接进入入库执行页。
  useEffect(() => {
    const rawPurchaseId = searchParams.get('purchaseId')
    if (!rawPurchaseId) return

    const nextPurchaseId = Number(rawPurchaseId)
    if (Number.isSafeInteger(nextPurchaseId) && nextPurchaseId > 0) {
      setPurchaseId(nextPurchaseId)
      setView('execute')
    }
  }, [searchParams])

  /** 新建入库单（关联采购单） */
  const handleNewInbound = (poId: number) => {
    setPurchaseId(poId)
    setView('execute')
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setPurchaseId(null)
    if (searchParams.has('purchaseId')) {
      router.push('/purchase-receipts')
    }
  }

  if (view === 'execute') {
    return <InboundExecutePage purchaseId={purchaseId} onBack={handleBackToList} />
  }

  return <InboundListPage onNewInbound={handleNewInbound} />
}
