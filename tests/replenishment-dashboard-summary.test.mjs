import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const metricsCardsSource = readFileSync(new URL('../app/[locale]/_components/dashboard/metrics-cards.tsx', import.meta.url), 'utf8')
const replenishmentWrapperSource = readFileSync(new URL('../lib/tauri/replenishment.ts', import.meta.url), 'utf8')
const tauriLibSource = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')

test('dashboard replenishment KPI uses read-only summary command', () => {
  assert.match(metricsCardsSource, /getReplenishmentDashboardSummary\(\)/)
  assert.doesNotMatch(metricsCardsSource, /ensureReplenishmentRules/)
  assert.doesNotMatch(metricsCardsSource, /getReplenishmentSuggestions/)
})

test('replenishment dashboard summary wrapper invokes the read-only Tauri command', () => {
  assert.match(replenishmentWrapperSource, /invoke<ReplenishmentDashboardSummary>\('get_replenishment_dashboard_summary'\)/)
  assert.match(tauriLibSource, /commands::replenishment::get_replenishment_dashboard_summary/)
})
