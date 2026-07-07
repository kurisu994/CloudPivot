import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const salesEditSource = readFileSync(new URL('../app/[locale]/sales-orders/_components/sales-order-edit-page.tsx', import.meta.url), 'utf8')
const salesPickerSource = readFileSync(new URL('../app/[locale]/sales-orders/_components/sales-material-picker-dialog.tsx', import.meta.url), 'utf8')
const salesCommandSource = readFileSync(new URL('../src-tauri/src/commands/sales.rs', import.meta.url), 'utf8')
const salesWrapperSource = readFileSync(new URL('../lib/tauri/sales.ts', import.meta.url), 'utf8')
const tauriLibSource = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')

test('sales order edit page uses material picker dialog instead of legacy material reference select', () => {
  assert.match(salesEditSource, /SalesMaterialPickerDialog/)
  assert.match(salesEditSource, /handleAddMaterials/)
  assert.doesNotMatch(salesEditSource, /getMaterialReferenceOptions/)
  assert.doesNotMatch(salesEditSource, /unitId: mat\.id/)
})

test('sales material picker loads dedicated sales material options', () => {
  assert.match(salesPickerSource, /getSalesMaterialOptions\(warehouseId\)/)
  assert.match(salesWrapperSource, /invoke<SalesMaterialOption\[]>\('get_sales_material_options', \{ warehouseId: warehouseId \?\? null \}\)/)
  assert.match(tauriLibSource, /commands::sales::get_sales_material_options/)
})

test('sales material options include real base unit, sale price, and available stock', () => {
  assert.match(salesCommandSource, /m\.base_unit_id AS unit_id/)
  assert.match(salesCommandSource, /COALESCE\(m\.sale_price, 0\) AS sale_price/)
  assert.match(salesCommandSource, /SUM\(available_qty\) AS available_qty/)
})
