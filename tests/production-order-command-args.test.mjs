import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSaveProductionOrderArgs } from '../app/[locale]/production-orders/_components/production-order-command-args.ts'

test('buildSaveProductionOrderArgs maps save_production_order input to camelCase', () => {
  assert.deepEqual(
    buildSaveProductionOrderArgs({
      orderId: 9,
      bomId: '3',
      plannedQty: '12.5',
      plannedStartDate: '2026-07-06',
      plannedEndDate: '',
      remark: 'urgent',
    }),
    {
      input: {
        id: 9,
        bomId: 3,
        customOrderId: null,
        plannedQty: 12.5,
        plannedStartDate: '2026-07-06',
        plannedEndDate: null,
        remark: 'urgent',
      },
    },
  )
})
