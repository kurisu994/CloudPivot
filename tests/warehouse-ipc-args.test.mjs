import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const warehouseWrapperSource = readFileSync(new URL('../lib/tauri/warehouse.ts', import.meta.url), 'utf8')
const productionOrderDetailSource = readFileSync(
  new URL('../app/[locale]/production-orders/_components/production-order-detail.tsx', import.meta.url),
  'utf8',
)

test('getWarehouses always sends includeDisabled to Tauri', () => {
  assert.match(warehouseWrapperSource, /invoke<WarehouseItem\[]>\('get_warehouses', \{ includeDisabled \}\)/)
})

test('production order detail uses getWarehouses wrapper instead of bare get_warehouses invoke', () => {
  assert.match(productionOrderDetailSource, /getWarehouses\(false\)/)
  assert.doesNotMatch(productionOrderDetailSource, /invoke<WarehouseOption\[]>\('get_warehouses'\)/)
})
