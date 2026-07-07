import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const purchaseEditSource = readFileSync(new URL('../app/[locale]/purchase-orders/_components/purchase-order-edit-page.tsx', import.meta.url), 'utf8')
const purchasePickerSource = readFileSync(
  new URL('../app/[locale]/purchase-orders/_components/purchase-material-picker-dialog.tsx', import.meta.url),
  'utf8',
)
const purchaseWrapperSource = readFileSync(new URL('../lib/tauri/purchase.ts', import.meta.url), 'utf8')
const purchaseCommandSource = readFileSync(new URL('../src-tauri/src/commands/purchase.rs', import.meta.url), 'utf8')

test('purchase order edit page uses material picker dialog instead of legacy quick-add select', () => {
  assert.match(purchaseEditSource, /PurchaseMaterialPickerDialog/)
  assert.match(purchaseEditSource, /handleAddMaterials/)
  assert.match(purchaseEditSource, /addPurchaseMaterial/)
  assert.doesNotMatch(purchaseEditSource, /handleAddFromSupplier/)
  assert.doesNotMatch(purchaseEditSource, /SelectValue placeholder=\{t\('selectSupplierMaterial'\)\}/)
})

test('purchase material picker is constrained to supplier material options', () => {
  assert.match(purchaseEditSource, /getSupplierMaterialsForPurchase\(sid\)/)
  assert.match(purchasePickerSource, /SupplierMaterialForPurchase/)
  assert.match(purchaseWrapperSource, /invoke<SupplierMaterialForPurchase\[]>\('get_supplier_materials_for_purchase'/)
  assert.match(purchaseCommandSource, /FROM supplier_materials sm/)
  assert.match(purchaseCommandSource, /WHERE sm\.supplier_id = \$1/)
})

test('purchase material picker supports pending draft editing before adding rows', () => {
  assert.match(purchasePickerSource, /pendingMaterials/)
  assert.match(purchasePickerSource, /purchaseQuantity/)
  assert.match(purchasePickerSource, /materialDraftInvalid/)
  assert.match(purchasePickerSource, /existingMaterialIds/)
  assert.match(purchasePickerSource, /draftSet/)
})
