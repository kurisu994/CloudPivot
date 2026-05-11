import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 智能补货命令
// ================================================================

/** 补货建议项 */
export interface ReplenishmentSuggestion {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  category_name: string | null
  unit_name: string | null
  material_type: string
  physical_qty: number
  reserved_qty: number
  available_qty: number
  safety_stock: number
  gap_qty: number
  daily_consumption: number
  days_until_stockout: number
  suggested_qty: number
  supplier_id: number | null
  supplier_name: string | null
  ref_price: number | null
  ref_currency: string
  urgency: 'urgent' | 'warning' | 'normal'
  log_id: number | null
}

/** 补货建议筛选参数 */
export interface SuggestionFilter {
  urgency?: string
  category_id?: number
  keyword?: string
}

/** 补货策略配置项 */
export interface ReplenishmentRule {
  id: number
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  analysis_days: number
  lead_days: number
  safety_days: number
  batch_multiple: number
  preferred_supplier_id: number | null
  supplier_name: string | null
  is_enabled: boolean
}

/** 策略列表筛选参数 */
export interface RuleFilter {
  keyword?: string
  page: number
  page_size: number
}

/** 策略更新参数 */
export interface UpdateRuleParams {
  analysis_days: number
  lead_days: number
  safety_days: number
  batch_multiple: number
  preferred_supplier_id: number | null
  is_enabled: boolean
}

/** 消耗趋势数据点 */
export interface ConsumptionTrendPoint {
  date: string
  qty: number
}

/** 批量生成采购单结果 */
export interface BulkCreatePoResult {
  created_orders: number[]
  errors: string[]
}

/** 补齐缺失的补货策略规则 */
export async function ensureReplenishmentRules(): Promise<number> {
  if (!isTauriEnv()) return 0
  return invoke<number>('ensure_replenishment_rules')
}

/** 获取补货建议列表 */
export async function getReplenishmentSuggestions(filter: SuggestionFilter): Promise<ReplenishmentSuggestion[]> {
  if (!isTauriEnv()) return []
  return invoke<ReplenishmentSuggestion[]>('get_replenishment_suggestions', { filter })
}

/** 获取补货策略配置列表 */
export async function getReplenishmentRules(filter: RuleFilter): Promise<PaginatedResponse<ReplenishmentRule>> {
  if (!isTauriEnv()) return { total: 0, items: [], page: 1, page_size: 20 }
  return invoke<PaginatedResponse<ReplenishmentRule>>('get_replenishment_rules', { filter })
}

/** 更新补货策略配置 */
export async function updateReplenishmentRule(id: number, params: UpdateRuleParams): Promise<void> {
  if (!isTauriEnv()) return
  return invoke<void>('update_replenishment_rule', { id, params })
}

/** 获取消耗趋势数据 */
export async function getConsumptionTrend(materialId: number, days: number): Promise<ConsumptionTrendPoint[]> {
  if (!isTauriEnv()) return []
  return invoke<ConsumptionTrendPoint[]>('get_consumption_trend', { materialId, days })
}

/** 一键生成采购单 */
export async function createPurchaseOrdersFromSuggestions(materialIds: number[], userId?: number, userName?: string): Promise<BulkCreatePoResult> {
  if (!isTauriEnv()) return { created_orders: [], errors: ['仅 Tauri 环境可用'] }
  return invoke<BulkCreatePoResult>('create_purchase_orders_from_suggestions', {
    materialIds,
    userId: userId ?? null,
    userName: userName ?? null,
  })
}

/** 忽略补货建议 */
export async function ignoreSuggestion(logId: number): Promise<void> {
  if (!isTauriEnv()) return
  return invoke<void>('ignore_suggestion', { logId })
}
