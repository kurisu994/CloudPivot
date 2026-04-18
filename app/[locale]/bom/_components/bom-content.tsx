'use client'

import { useState } from 'react'
import { BomEditPage } from './bom-edit-page'
import { BomListPage } from './bom-list-page'

/**
 * BOM 管理主内容组件
 * 管理列表页和编辑页之间的视图切换
 */
export function BomContent() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingBomId, setEditingBomId] = useState<number | null>(null)

  const handleEditBom = (id: number) => {
    setEditingBomId(id)
    setView('edit')
  }

  const handleNewBom = () => {
    setEditingBomId(null)
    setView('edit')
  }

  const handleBackToList = () => {
    setView('list')
    setEditingBomId(null)
  }

  if (view === 'edit') {
    return <BomEditPage bomId={editingBomId} onBack={handleBackToList} />
  }

  return <BomListPage onEditBom={handleEditBom} onNewBom={handleNewBom} />
}
