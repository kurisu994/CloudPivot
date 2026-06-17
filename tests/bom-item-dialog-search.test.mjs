import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/[locale]/bom/_components/bom-item-dialog.tsx', 'utf8')

test('BOM 明细物料搜索输入不会触发弹窗初始化重置', () => {
  assert.equal(
    /setSearchKeyword\(e\.target\.value\)\s*fetchMaterials\(/.test(source),
    false,
    '搜索输入变化不应立即调用闭包里的 fetchMaterials，避免用旧 searchKeyword 查询',
  )

  assert.equal(
    /\[open,\s*editingItem,\s*fetchMaterials\]/.test(source),
    false,
    '弹窗初始化 effect 不应依赖随搜索词重建的 fetchMaterials，否则每次输入都会重置表单',
  )
})
