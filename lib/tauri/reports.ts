import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 报表中心命令
// ================================================================

/** 收发存汇总项 */
export interface InventoryReportItem {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  category_name: string | null
  unit_name: string | null
  opening_qty: number
  opening_value: number
  inbound_qty: number
  inbound_value: number
  outbound_qty: number
  outbound_value: number
  closing_qty: number
  closing_value: number
}

/** 报表 KPI 统计 */
export interface ReportStats {
  opening_value: number
  inbound_value: number
  outbound_value: number
  closing_value: number
}

/** 库存报表响应 */
export interface InventoryReportResponse {
  generated_at: string
  stats: ReportStats
  items: InventoryReportItem[]
  total: number
  page: number
  page_size: number
}

/** 库龄分析项 */
export interface InventoryAgingItem {
  material_id: number
  material_code: string
  material_name: string
  lot_no: string
  received_date: string
  days_in_stock: number
  qty_on_hand: number
  unit_cost: number
  value: number
}

/** 滞销预警项 */
export interface InventorySlowMovingItem {
  material_id: number
  material_code: string
  material_name: string
  category_name: string | null
  current_qty: number
  last_out_date: string | null
  days_since_last_out: number
  avg_monthly_outbound: number
}

/** 库存趋势数据点 */
export interface InventoryTrendPoint {
  date: string
  total_qty: number
  total_value: number
}

/** 库存趋势响应 */
export interface InventoryTrendResponse {
  generated_at: string
  points: InventoryTrendPoint[]
}

/** 收发存筛选条件 */
export interface InventoryReportFilter {
  start_date?: string | null
  end_date?: string | null
  warehouse_id?: number | null
  category_id?: number | null
  material_type?: string | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 库龄筛选 */
export interface AgingFilter {
  warehouse_id?: number | null
  category_id?: number | null
  min_days?: number | null
  max_days?: number | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 滞销筛选 */
export interface SlowMovingFilter {
  days_threshold: number
  warehouse_id?: number | null
  category_id?: number | null
  page: number
  page_size: number
}

/** 趋势筛选 */
export interface TrendFilter {
  days?: number | null
  warehouse_id?: number | null
}

/** 采购报表筛选 */
export interface PurchaseReportFilter {
  start_date?: string | null
  end_date?: string | null
  supplier_id?: number | null
  warehouse_id?: number | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 销售报表筛选 */
export interface SalesReportFilter {
  start_date?: string | null
  end_date?: string | null
  customer_id?: number | null
  warehouse_id?: number | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 业务报表 KPI */
export interface BusinessReportStats {
  total_amount: number
  order_count: number
  partner_count: number
  material_count: number
}

/** 业务报表趋势点 */
export interface BusinessTrendPoint {
  date: string
  amount: number
  order_count: number
}

/** 往来单位排行项 */
export interface PartnerRankItem {
  partner_id: number
  partner_code: string
  partner_name: string
  amount: number
  order_count: number
  ratio: number
}

/** 物料报表明细项 */
export interface MaterialReportItem {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  unit_name: string
  quantity: number
  amount: number
  avg_price: number
}

/** 业务报表响应 */
export interface BusinessReportResponse<T> {
  generated_at: string
  stats: BusinessReportStats
  trend: BusinessTrendPoint[]
  items: T[]
  total: number
  page: number
  page_size: number
}

// ---- 报表查询 ----

/** 获取库存收发存汇总 */
export async function getInventoryReportSummary(filter: InventoryReportFilter): Promise<InventoryReportResponse> {
  if (!isTauriEnv()) {
    return {
      generated_at: new Date().toISOString(),
      stats: { opening_value: 0, inbound_value: 0, outbound_value: 0, closing_value: 0 },
      items: [],
      total: 0,
      page: filter.page,
      page_size: filter.page_size,
    }
  }
  return invoke<InventoryReportResponse>('get_inventory_report_summary', { filter })
}

/** 获取库龄分析 */
export async function getInventoryAgingAnalysis(filter: AgingFilter): Promise<PaginatedResponse<InventoryAgingItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, page_size: filter.page_size }
  }
  return invoke<PaginatedResponse<InventoryAgingItem>>('get_inventory_aging_analysis', { filter })
}

/** 获取滞销预警 */
export async function getInventorySlowMoving(filter: SlowMovingFilter): Promise<PaginatedResponse<InventorySlowMovingItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, page_size: filter.page_size }
  }
  return invoke<PaginatedResponse<InventorySlowMovingItem>>('get_inventory_slow_moving', { filter })
}

/** 获取库存趋势 */
export async function getInventoryTrend(filter: TrendFilter): Promise<InventoryTrendResponse> {
  if (!isTauriEnv()) {
    return { generated_at: new Date().toISOString(), points: [] }
  }
  return invoke<InventoryTrendResponse>('get_inventory_trend', { filter })
}

function emptyBusinessReport<T>(page: number, pageSize: number): BusinessReportResponse<T> {
  return {
    generated_at: new Date().toISOString(),
    stats: { total_amount: 0, order_count: 0, partner_count: 0, material_count: 0 },
    trend: [],
    items: [],
    total: 0,
    page,
    page_size: pageSize,
  }
}

/** 获取采购汇总趋势 */
export async function getPurchaseReportSummary(filter: PurchaseReportFilter): Promise<BusinessReportResponse<BusinessTrendPoint>> {
  if (!isTauriEnv()) return emptyBusinessReport<BusinessTrendPoint>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<BusinessTrendPoint>>('get_purchase_report_summary', { filter })
}

/** 获取供应商采购排行 */
export async function getPurchaseSupplierRanking(filter: PurchaseReportFilter): Promise<BusinessReportResponse<PartnerRankItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<PartnerRankItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<PartnerRankItem>>('get_purchase_supplier_ranking', { filter })
}

/** 获取采购物料明细 */
export async function getPurchaseMaterialDetail(filter: PurchaseReportFilter): Promise<BusinessReportResponse<MaterialReportItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<MaterialReportItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<MaterialReportItem>>('get_purchase_material_detail', { filter })
}

/** 获取销售汇总趋势 */
export async function getSalesReportSummary(filter: SalesReportFilter): Promise<BusinessReportResponse<BusinessTrendPoint>> {
  if (!isTauriEnv()) return emptyBusinessReport<BusinessTrendPoint>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<BusinessTrendPoint>>('get_sales_report_summary', { filter })
}

/** 获取客户销售排行 */
export async function getSalesCustomerRanking(filter: SalesReportFilter): Promise<BusinessReportResponse<PartnerRankItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<PartnerRankItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<PartnerRankItem>>('get_sales_customer_ranking', { filter })
}

/** 获取销售物料明细 */
export async function getSalesMaterialDetail(filter: SalesReportFilter): Promise<BusinessReportResponse<MaterialReportItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<MaterialReportItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<MaterialReportItem>>('get_sales_material_detail', { filter })
}
