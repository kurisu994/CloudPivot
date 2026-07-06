import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSaveBomArgs, getLocalDateString, normalizeBomDetail } from '../app/[locale]/bom/_components/bom-command-args.ts'

test('buildSaveBomArgs maps BOM rows to save_bom camelCase params', () => {
  const args = buildSaveBomArgs({
    bomId: null,
    materialId: '4',
    version: 'V1.0',
    effectiveDate: '2026-06-17',
    status: 'active',
    isNew: true,
    remark: '',
    items: [
      {
        child_material_id: 7,
        standard_qty: 2.5,
        wastage_rate: 5,
        process_step: '',
        is_key_part: true,
        substitute_id: null,
        remark: '',
      },
    ],
  })

  assert.deepEqual(args, {
    params: {
      id: null,
      materialId: 4,
      version: 'V1.0',
      effectiveDate: '2026-06-17',
      status: 'draft',
      remark: null,
      items: [
        {
          childMaterialId: 7,
          standardQty: 2.5,
          wastageRate: 5,
          processStep: null,
          isKeyPart: true,
          substituteId: null,
          remark: null,
          sortOrder: 1,
        },
      ],
    },
  })
  assert.equal('child_material_id' in args.params.items[0], false)
})

test('buildSaveBomArgs defaults empty effectiveDate to local today', () => {
  const args = buildSaveBomArgs({
    bomId: null,
    materialId: '4',
    version: 'V1.0',
    effectiveDate: '',
    status: 'draft',
    isNew: true,
    remark: '',
    items: [
      {
        child_material_id: 7,
        standard_qty: 1,
        wastage_rate: 0,
        process_step: null,
        is_key_part: false,
        substitute_id: null,
        remark: null,
      },
    ],
  })

  assert.equal(args.params.effectiveDate, getLocalDateString())
})

test('normalizeBomDetail maps backend camelCase detail to page state shape', () => {
  const detail = normalizeBomDetail({
    id: 9,
    bomCode: 'BOM-20260617-001',
    materialId: 4,
    materialCode: 'FP-001',
    materialName: '成品',
    materialSpec: '1200mm',
    version: 'V2.0',
    status: 'active',
    effectiveDate: '2026-06-17',
    totalStandardCost: 1234,
    remark: null,
    createdAt: '2026-06-17T00:00:00Z',
    updatedAt: '2026-06-17T00:00:00Z',
    items: [
      {
        id: 12,
        bomId: 9,
        childMaterialId: 7,
        materialCode: 'M-007',
        materialName: '子件',
        materialSpec: '20mm',
        unitName: '件',
        refCostPrice: 100,
        standardQty: 2,
        wastageRate: 3,
        actualQty: 2.06,
        processStep: 'cutting',
        isKeyPart: false,
        substituteId: null,
        substituteName: null,
        remark: null,
        sortOrder: 1,
      },
    ],
  })

  assert.equal(detail.bom_code, 'BOM-20260617-001')
  assert.equal(detail.effective_date, '2026-06-17')
  assert.equal(detail.items[0].child_material_id, 7)
  assert.equal(detail.items[0].standard_qty, 2)
  assert.equal(detail.items[0].process_step, 'cutting')
})
