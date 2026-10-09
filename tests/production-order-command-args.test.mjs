import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AUTO_LOT_VALUE,
  buildMaterialMovementArgs,
  buildSaveProductionOrderArgs,
  parseLotValue,
} from '../app/[locale]/production-orders/_components/production-order-command-args.ts'

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

test('parseLotValue treats auto, empty and invalid values as automatic allocation', () => {
  assert.equal(AUTO_LOT_VALUE, 'auto')
  assert.equal(parseLotValue(AUTO_LOT_VALUE), null)
  assert.equal(parseLotValue(''), null)
  assert.equal(parseLotValue('abc'), null)
  assert.equal(parseLotValue('0'), null)
  assert.equal(parseLotValue('-3'), null)
  assert.equal(parseLotValue('1.5'), null)
  assert.equal(parseLotValue('12'), 12)
})

test('buildMaterialMovementArgs sends the chosen lot as lotId and null for automatic allocation', () => {
  assert.deepEqual(
    buildMaterialMovementArgs({
      orderId: 7,
      materialId: 3,
      quantity: 4.2,
      warehouseId: '5',
      lotValue: '21',
    }),
    {
      input: {
        productionOrderId: 7,
        items: [{ materialId: 3, quantity: 4.2, warehouseId: 5, lotId: 21 }],
      },
    },
  )
  assert.deepEqual(
    buildMaterialMovementArgs({
      orderId: 7,
      materialId: 3,
      quantity: 1,
      warehouseId: '5',
      lotValue: AUTO_LOT_VALUE,
    }).input.items[0].lotId,
    null,
  )
})
