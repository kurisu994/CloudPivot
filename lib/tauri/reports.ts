import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 报表中心命令
// ================================================================

/** 收发存汇总项 */
export interface InventoryReportItem {
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  categoryName: string | null
  unitName: string | null
  openingQty: number
  openingValue: number
  inboundQty: number
  inboundValue: number
  outboundQty: number
  outboundValue: number
  closingQty: number
  closingValue: number
}

/** 报表 KPI 统计 */
export interface ReportStats {
  openingValue: number
  inboundValue: number
  outboundValue: number
  closingValue: number
}

/** 库存报表响应 */
export interface InventoryReportResponse {
  generatedAt: string
  stats: ReportStats
  items: InventoryReportItem[]
  total: number
  page: number
  pageSize: number
}

/** 库龄分析项 */
export interface InventoryAgingItem {
  materialId: number
  materialCode: string
  materialName: string
  lotNo: string
  receivedDate: string
  daysInStock: number
  qtyOnHand: number
  unitCost: number
  value: number
}

/** 滞销预警项 */
export interface InventorySlowMovingItem {
  materialId: number
  materialCode: string
  materialName: string
  categoryName: string | null
  currentQty: number
  lastOutDate: string | null
  daysSinceLastOut: number
  avgMonthlyOutbound: number
}

/** 库存趋势数据点 */
export interface InventoryTrendPoint {
  date: string
  totalQty: number
  totalValue: number
}

/** 库存趋势响应 */
export interface InventoryTrendResponse {
  generatedAt: string
  points: InventoryTrendPoint[]
}

/** 收发存筛选条件 */
export interface InventoryReportFilter {
  startDate?: string | null
  endDate?: string | null
  warehouseId?: number | null
  categoryId?: number | null
  materialType?: string | null
  keyword?: string | null
  page: number
  pageSize: number
}

/** 库龄筛选 */
export interface AgingFilter {
  warehouseId?: number | null
  categoryId?: number | null
  minDays?: number | null
  maxDays?: number | null
  keyword?: string | null
  page: number
  pageSize: number
}

/** 滞销筛选 */
export interface SlowMovingFilter {
  daysThreshold: number
  warehouseId?: number | null
  categoryId?: number | null
  page: number
  pageSize: number
}

/** 趋势筛选 */
export interface TrendFilter {
  days?: number | null
  warehouseId?: number | null
}

/** 采购报表筛选 */
export interface PurchaseReportFilter {
  startDate?: string | null
  endDate?: string | null
  supplierId?: number | null
  warehouseId?: number | null
  keyword?: string | null
  page: number
  pageSize: number
}

/** 销售报表筛选 */
export interface SalesReportFilter {
  startDate?: string | null
  endDate?: string | null
  customerId?: number | null
  warehouseId?: number | null
  keyword?: string | null
  page: number
  pageSize: number
}

/** 业务报表 KPI */
export interface BusinessReportStats {
  totalAmount: number
  orderCount: number
  partnerCount: number
  materialCount: number
}

/** 业务报表趋势点 */
export interface BusinessTrendPoint {
  date: string
  amount: number
  orderCount: number
}

/** 往来单位排行项 */
export interface PartnerRankItem {
  partnerId: number
  partnerCode: string
  partnerName: string
  amount: number
  orderCount: number
  ratio: number
}

/** 物料报表明细项 */
export interface MaterialReportItem {
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitName: string
  quantity: number
  amount: number
  avgPrice: number
}

/** 业务报表响应 */
export interface BusinessReportResponse<T> {
  generatedAt: string
  stats: BusinessReportStats
  trend: BusinessTrendPoint[]
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ---- 报表查询 ----

/** 获取库存收发存汇总 */
export async function getInventoryReportSummary(filter: InventoryReportFilter): Promise<InventoryReportResponse> {
  if (!isTauriEnv()) {
    return {
      generatedAt: new Date().toISOString(),
      stats: { openingValue: 0, inboundValue: 0, outboundValue: 0, closingValue: 0 },
      items: [],
      total: 0,
      page: filter.page,
      pageSize: filter.pageSize,
    }
  }
  return invoke<InventoryReportResponse>('get_inventory_report_summary', { filter })
}

/** 获取库龄分析 */
export async function getInventoryAgingAnalysis(filter: AgingFilter): Promise<PaginatedResponse<InventoryAgingItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
  }
  return invoke<PaginatedResponse<InventoryAgingItem>>('get_inventory_aging_analysis', { filter })
}

/** 获取滞销预警 */
export async function getInventorySlowMoving(filter: SlowMovingFilter): Promise<PaginatedResponse<InventorySlowMovingItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
  }
  return invoke<PaginatedResponse<InventorySlowMovingItem>>('get_inventory_slow_moving', { filter })
}

/** 获取库存趋势 */
export async function getInventoryTrend(filter: TrendFilter): Promise<InventoryTrendResponse> {
  if (!isTauriEnv()) {
    return { generatedAt: new Date().toISOString(), points: [] }
  }
  return invoke<InventoryTrendResponse>('get_inventory_trend', { filter })
}

function emptyBusinessReport<T>(page: number, pageSize: number): BusinessReportResponse<T> {
  return {
    generatedAt: new Date().toISOString(),
    stats: { totalAmount: 0, orderCount: 0, partnerCount: 0, materialCount: 0 },
    trend: [],
    items: [],
    total: 0,
    page,
    pageSize,
  }
}

/** 获取采购汇总趋势 */
export async function getPurchaseReportSummary(filter: PurchaseReportFilter): Promise<BusinessReportResponse<BusinessTrendPoint>> {
  if (!isTauriEnv()) return emptyBusinessReport<BusinessTrendPoint>(filter.page, filter.pageSize)
  return invoke<BusinessReportResponse<BusinessTrendPoint>>('get_purchase_report_summary', { filter })
}

/** 获取供应商采购排行 */
export async function getPurchaseSupplierRanking(filter: PurchaseReportFilter): Promise<BusinessReportResponse<PartnerRankItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<PartnerRankItem>(filter.page, filter.pageSize)
  return invoke<BusinessReportResponse<PartnerRankItem>>('get_purchase_supplier_ranking', { filter })
}

/** 获取采购物料明细 */
export async function getPurchaseMaterialDetail(filter: PurchaseReportFilter): Promise<BusinessReportResponse<MaterialReportItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<MaterialReportItem>(filter.page, filter.pageSize)
  return invoke<BusinessReportResponse<MaterialReportItem>>('get_purchase_material_detail', { filter })
}

/** 获取销售汇总趋势 */
export async function getSalesReportSummary(filter: SalesReportFilter): Promise<BusinessReportResponse<BusinessTrendPoint>> {
  if (!isTauriEnv()) return emptyBusinessReport<BusinessTrendPoint>(filter.page, filter.pageSize)
  return invoke<BusinessReportResponse<BusinessTrendPoint>>('get_sales_report_summary', { filter })
}

/** 获取客户销售排行 */
export async function getSalesCustomerRanking(filter: SalesReportFilter): Promise<BusinessReportResponse<PartnerRankItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<PartnerRankItem>(filter.page, filter.pageSize)
  return invoke<BusinessReportResponse<PartnerRankItem>>('get_sales_customer_ranking', { filter })
}

/** 获取销售物料明细 */
export async function getSalesMaterialDetail(filter: SalesReportFilter): Promise<BusinessReportResponse<MaterialReportItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<MaterialReportItem>(filter.page, filter.pageSize)
  return invoke<BusinessReportResponse<MaterialReportItem>>('get_sales_material_detail', { filter })
}
