'use client'

import { useState } from 'react'
import { BomComparePage } from './bom-compare-page'
import { BomEditPage } from './bom-edit-page'
import { BomListPage } from './bom-list-page'

/**
 * BOM 管理主内容组件
 * 管理列表页、编辑页和比较视图之间的视图切换
 */
export function BomContent() {
  const [view, setView] = useState<'list' | 'edit' | 'compare'>('list')
  const [editingBomId, setEditingBomId] = useState<number | null>(null)
  const [compareIds, setCompareIds] = useState<number[]>([])

  const handleEditBom = (id: number) => {
    setEditingBomId(id)
    setView('edit')
  }

  const handleNewBom = () => {
    setEditingBomId(null)
    setView('edit')
  }

  const handleCompare = (ids: number[]) => {
    setCompareIds(ids)
    setView('compare')
  }

  const handleBackToList = () => {
    setView('list')
    setEditingBomId(null)
  }

  if (view === 'edit') {
    return <BomEditPage bomId={editingBomId} onBack={handleBackToList} />
  }

  if (view === 'compare') {
    return <BomComparePage bomIds={compareIds} onBack={handleBackToList} />
  }

  return <BomListPage onEditBom={handleEditBom} onNewBom={handleNewBom} onCompare={handleCompare} />
}
