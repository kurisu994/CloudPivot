'use client'

import { useState } from 'react'
import { ManualStockMovementEdit } from './manual-stock-movement-edit'
import { ManualStockMovementsList } from './manual-stock-movements-list'

type ViewMode = { type: 'list' } | { type: 'edit'; movementId?: number }

export function ManualStockMovementsPage() {
  const [view, setView] = useState<ViewMode>({ type: 'list' })

  if (view.type === 'edit') {
    return <ManualStockMovementEdit movementId={view.movementId} onBack={() => setView({ type: 'list' })} />
  }

  return <ManualStockMovementsList onNew={() => setView({ type: 'edit' })} onEdit={id => setView({ type: 'edit', movementId: id })} />
}
