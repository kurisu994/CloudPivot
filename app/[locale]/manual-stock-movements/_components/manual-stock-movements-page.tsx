'use client'

import { useState } from 'react'
import { ManualStockMovementEdit } from './manual-stock-movement-edit'
import { ManualStockMovementPrint } from './manual-stock-movement-print'
import { ManualStockMovementsList } from './manual-stock-movements-list'

type ViewMode = { type: 'list' } | { type: 'edit'; movementId?: number } | { type: 'print'; movementId: number }

export function ManualStockMovementsPage() {
  const [view, setView] = useState<ViewMode>({ type: 'list' })

  if (view.type === 'edit') {
    return <ManualStockMovementEdit movementId={view.movementId} onBack={() => setView({ type: 'list' })} />
  }

  if (view.type === 'print') {
    return <ManualStockMovementPrint movementId={view.movementId} onBack={() => setView({ type: 'list' })} />
  }

  return (
    <ManualStockMovementsList
      onNew={() => setView({ type: 'edit' })}
      onEdit={id => setView({ type: 'edit', movementId: id })}
      onPrint={id => setView({ type: 'print', movementId: id })}
    />
  )
}
