import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../app/[locale]/production-orders/_components/production-order-detail.tsx', import.meta.url), 'utf8')

test('production order BOM select labels use get_bom_list materialName field', () => {
  assert.match(source, /materialName: string \| null/)
  assert.match(source, /label: `\$\{b\.materialName \?\? '—'\} \(\$\{b\.version\}\)`/)
  assert.doesNotMatch(source, /parent_material_name/)
})
