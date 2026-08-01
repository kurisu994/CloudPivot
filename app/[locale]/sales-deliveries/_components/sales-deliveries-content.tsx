'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { OutboundExecutePage } from './outbound-execute-page'
import { OutboundListPage } from './outbound-list-page'

/**
 * 销售出库主内容组件
 * 管理列表页和出库执行页之间的视图切换
 */
export function SalesDeliveriesContent() {
  const [view, setView] = useState<'list' | 'execute'>('list')
  /** 关联的销售单 ID（从销售单跳转出库时传入） */
  const [salesId, setSalesId] = useState<number | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // 支持从销售单列表通过 ?salesId=xxx 直接进入出库执行页。
  useEffect(() => {
    const rawSalesId = searchParams.get('salesId')
    if (!rawSalesId) return

    const nextSalesId = Number(rawSalesId)
    if (Number.isSafeInteger(nextSalesId) && nextSalesId > 0) {
      setSalesId(nextSalesId)
      setView('execute')
    }
  }, [searchParams])

  /** 新建出库单（关联销售单） */
  const handleNewOutbound = (id: number) => {
    setSalesId(id)
    setView('execute')
  }

  /** 返回列表 */
  const handleBackToList = () => {
    setView('list')
    setSalesId(null)
    if (searchParams.has('salesId')) {
      router.push('/sales-deliveries')
    }
  }

  if (view === 'execute' && salesId) {
    return <OutboundExecutePage salesId={salesId} onBack={handleBackToList} />
  }

  return <OutboundListPage onNewOutbound={handleNewOutbound} />
}
