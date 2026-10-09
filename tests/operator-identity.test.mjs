import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const commandsDir = new URL('../src-tauri/src/commands/', import.meta.url)
const commandSources = readdirSync(commandsDir)
  .filter(name => name.endsWith('.rs'))
  .map(name => ({ name, source: readFileSync(new URL(name, commandsDir), 'utf8') }))
const replenishmentWrapperSource = readFileSync(new URL('../lib/tauri/replenishment.ts', import.meta.url), 'utf8')

test('单据审核/确认/作废人不再写死为 admin', () => {
  const hardcoded = /_by_user_id\s*=\s*1\b|_by_name\s*=\s*'admin'/
  const offenders = commandSources.filter(({ source }) => hardcoded.test(source)).map(({ name }) => name)
  assert.deepEqual(offenders, [])
})

test('补货一键下单只传物料 ID，制单人由后端按登录用户记录', () => {
  assert.match(replenishmentWrapperSource, /invoke<BulkCreatePoResult>\('create_purchase_orders_from_suggestions', \{ materialIds \}\)/)
  const replenishment = commandSources.find(({ name }) => name === 'replenishment.rs')
  assert.ok(replenishment)
  assert.doesNotMatch(replenishment.source, /unwrap_or_else\(\|\| "admin"/)
})
