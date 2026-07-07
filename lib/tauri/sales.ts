import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 销售单物料选择
// ================================================================

/** 销售单添加物料选项 */
export interface SalesMaterialOption {
  materialId: number
  materialCode: string
  materialName: string
  materialType: 'raw' | 'semi' | 'finished'
  spec: string | null
  unitId: number
  unitName: string | null
  conversionRate: number
  salePrice: number
  availableQty: number
}

/** 获取销售单可选物料 */
export async function getSalesMaterialOptions(warehouseId?: number | null): Promise<SalesMaterialOption[]> {
  if (isTauriEnv()) {
    return invoke<SalesMaterialOption[]>('get_sales_material_options', { warehouseId: warehouseId ?? null })
  }
  return []
}

// ================================================================
// 销售出库
// ================================================================

/** 出库单列表项 */
export interface OutboundOrderListItem {
  id: number
  orderNo: string
  salesId: number | null
  salesOrderNo: string | null
  customerId: number | null
  customerName: string | null
  outboundDate: string
  warehouseId: number
  warehouseName: string
  outboundType: string
  currency: string
  totalAmount: number
  receivableAmount: number
  status: string
  createdByName: string | null
  createdAt: string | null
}

/** 出库单列表筛选 */
export interface OutboundOrderFilter {
  keyword?: string
  salesId?: number
  customerId?: number
  warehouseId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 销售单待出库明细 */
export interface PendingOutboundItem {
  salesOrderItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  orderQuantity: number
  shippedQty: number
  remainingQty: number
  unitPrice: number
  lineDiscount: number
  lotTrackingMode: string
  availableStock: number
  standardCost: number
  actualCost: number
  /** 后端按 FIFO 建议分配的批次 ID */
  suggestedLotId: number | null
  /** 后端按 FIFO 建议分配的批次号 */
  suggestedLotNo: string | null
}

/** 出库明细行批次分配 */
export interface OutboundLotAllocation {
  lotId: number | null
  lotNo: string | null
  quantity: number
}

/** 保存出库单明细参数 */
export interface SaveOutboundItemParams {
  salesOrderItemId?: number | null
  materialId: number
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  unitPrice: number
  lineDiscount: number
  lotAllocations?: OutboundLotAllocation[] | null
  remark?: string | null
}

/** 保存出库单参数 */
export interface SaveOutboundOrderParams {
  id?: number | null
  salesId?: number | null
  customerId?: number | null
  outboundDate: string
  warehouseId: number
  outboundType: string
  remark?: string | null
  items: SaveOutboundItemParams[]
}

/** 获取销售单待出库明细 */
export async function getPendingOutboundItems(salesId: number): Promise<PendingOutboundItem[]> {
  if (isTauriEnv()) {
    return invoke<PendingOutboundItem[]>('get_pending_outbound_items', { salesId })
  }
  return []
}

/** 获取出库单列表 */
export async function getOutboundOrders(filter: OutboundOrderFilter): Promise<PaginatedResponse<OutboundOrderListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<OutboundOrderListItem>>('get_outbound_orders', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 保存并确认出库单 */
export async function saveAndConfirmOutbound(params: SaveOutboundOrderParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_and_confirm_outbound', { params })
  }
  return Date.now()
}

// ================================================================
// 销售退货
// ================================================================

/** 销售退货列表项 */
export interface SalesReturnListItem {
  id: number
  returnNo: string
  outboundId: number
  outboundOrderNo: string
  customerId: number
  customerName: string
  returnDate: string
  currency: string
  totalAmount: number
  returnReason: string | null
  status: string
  createdByName: string | null
  createdAt: string | null
}

/** 销售退货列表筛选 */
export interface SalesReturnFilter {
  keyword?: string
  customerId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 出库单可退明细 */
export interface ReturnableOutboundItem {
  outboundItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  outboundQuantity: number
  alreadyReturnedQty: number
  returnableQty: number
  unitPrice: number
  lotId: number | null
  lotNo: string | null
}

/** 保存销售退货明细参数 */
export interface SaveSalesReturnItemParams {
  sourceOutboundItemId: number
  lotId?: number | null
  materialId: number
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  unitPrice: number
  remark?: string | null
}

/** 保存销售退货参数 */
export interface SaveSalesReturnParams {
  id?: number | null
  outboundId: number
  returnDate: string
  returnReason: string
  remark?: string | null
  items: SaveSalesReturnItemParams[]
}

/** 获取出库单可退明细 */
export async function getReturnableOutboundItems(outboundId: number): Promise<ReturnableOutboundItem[]> {
  if (isTauriEnv()) {
    return invoke<ReturnableOutboundItem[]>('get_returnable_outbound_items', { outboundId })
  }
  return []
}

/** 获取销售退货列表 */
export async function getSalesReturns(filter: SalesReturnFilter): Promise<PaginatedResponse<SalesReturnListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<SalesReturnListItem>>('get_sales_returns', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 保存并确认销售退货 */
export async function saveAndConfirmSalesReturn(params: SaveSalesReturnParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_and_confirm_sales_return', { params })
  }
  return Date.now()
}

// ================================================================
// 销售单详情
// ================================================================

/** 销售单详情（含明细） */
export interface SalesOrderDetail {
  id: number
  orderNo: string
  customerId: number
  customerName: string | null
  orderDate: string
  deliveryDate: string | null
  warehouseId: number
  warehouseName: string | null
  currency: string
  exchangeRate: number
  status: string
  totalAmount: number
  totalAmountBase: number
  discountRate: number
  discountAmount: number
  freightAmount: number
  otherCharges: number
  receivableAmount: number
  shippingAddress: string | null
  remark: string | null
  createdByUserId: number | null
  createdByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  cancelledByName: string | null
  cancelledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  items: SalesOrderItemData[]
}

/** 销售单明细项 */
export interface SalesOrderItemData {
  id: number | null
  materialId: number
  materialCode: string | null
  materialName: string | null
  spec: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  baseQuantity: number
  unitPrice: number
  discountRate: number
  amount: number
  shippedQty: number | null
  warehouseId: number
  remark: string | null
  sortOrder: number | null
}

/** 获取销售单详情 */
export async function getSalesOrderDetail(id: number): Promise<SalesOrderDetail> {
  if (isTauriEnv()) {
    return invoke<SalesOrderDetail>('get_sales_order_detail', { id })
  }
  throw new Error('非 Tauri 环境暂不支持')
}

/** 从定制单开始生产（自动创建工单），返回新建工单 id */
export async function startProductionFromCustomOrder(customOrderId: number): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('start_production_from_custom_order', { customOrderId })
  }
  return Date.now()
}
