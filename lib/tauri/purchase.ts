import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 采购管理
// ================================================================

/** 采购单列表项（对应 Rust PurchaseOrderListItem） */
export interface PurchaseOrderListItem {
  id: number
  orderNo: string
  supplierId: number
  supplierName: string
  orderDate: string
  expectedDate: string | null
  warehouseId: number
  warehouseName: string
  currency: string
  status: string
  totalAmount: number
  payableAmount: number
  /** 明细总行数 */
  itemCount: number
  /** 已完成入库的行数 */
  receivedItemCount: number
  createdByName: string | null
  createdAt: string | null
}

/** 采购单明细项 */
export interface PurchaseOrderItemData {
  id?: number | null
  materialId: number
  materialCode?: string | null
  materialName?: string | null
  spec?: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  baseQuantity: number
  unitPrice: number
  amount: number
  receivedQty?: number | null
  warehouseId: number
  remark?: string | null
  sortOrder?: number | null
}

/** 采购单详情（含明细） */
export interface PurchaseOrderDetail {
  id: number
  orderNo: string
  supplierId: number
  supplierName: string | null
  orderDate: string
  expectedDate: string | null
  warehouseId: number
  warehouseName: string | null
  currency: string
  exchangeRate: number
  status: string
  totalAmount: number
  totalAmountBase: number
  discountAmount: number
  freightAmount: number
  otherCharges: number
  payableAmount: number
  remark: string | null
  createdByUserId: number | null
  createdByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  cancelledByName: string | null
  cancelledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  items: PurchaseOrderItemData[]
}

/** 保存采购单参数 */
export interface SavePurchaseOrderParams {
  id?: number | null
  supplierId: number
  orderDate: string
  expectedDate?: string | null
  warehouseId: number
  currency: string
  exchangeRate: number
  discountAmount: number
  freightAmount: number
  otherCharges: number
  remark?: string | null
  items: SavePurchaseOrderItemParams[]
}

/** 保存采购单明细参数 */
export interface SavePurchaseOrderItemParams {
  id?: number | null
  materialId: number
  spec?: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  unitPrice: number
  remark?: string | null
  sortOrder?: number | null
}

/** 采购单列表筛选参数 */
export interface PurchaseOrderFilter {
  keyword?: string
  supplierId?: number
  status?: string
  warehouseId?: number
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 供应商物料报价（采购单快速带入用） */
export interface SupplierMaterialForPurchase {
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitId: number
  unitName: string | null
  conversionRate: number
  unitPrice: number
  priceCurrency: string
  leadDays: number | null
}

/** 获取采购单列表 */
export async function getPurchaseOrders(filter: PurchaseOrderFilter): Promise<PaginatedResponse<PurchaseOrderListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<PurchaseOrderListItem>>('get_purchase_orders', { filter })
  }
  // Web mock：返回空列表
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 获取采购单详情 */
export async function getPurchaseOrderDetail(id: number): Promise<PurchaseOrderDetail> {
  if (isTauriEnv()) {
    return invoke<PurchaseOrderDetail>('get_purchase_order_detail', { id })
  }
  throw new Error('非 Tauri 环境暂不支持')
}

/** 保存采购单（新建/编辑） */
export async function savePurchaseOrder(params: SavePurchaseOrderParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_purchase_order', { params })
  }
  return params.id ?? Date.now()
}

/** 审核采购单 */
export async function approvePurchaseOrder(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('approve_purchase_order', { id })
  }
}

/** 作废采购单 */
export async function cancelPurchaseOrder(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('cancel_purchase_order', { id })
  }
}

/** 删除采购单 */
export async function deletePurchaseOrder(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_purchase_order', { id })
  }
}

/** 获取供应商物料报价（采购单选择供应商后快速带出） */
export async function getSupplierMaterialsForPurchase(supplierId: number): Promise<SupplierMaterialForPurchase[]> {
  if (isTauriEnv()) {
    return invoke<SupplierMaterialForPurchase[]>('get_supplier_materials_for_purchase', {
      supplierId,
    })
  }
  return []
}

// ================================================================
// 采购入库
// ================================================================

/** 入库单列表项 */
export interface InboundOrderListItem {
  id: number
  orderNo: string
  purchaseId: number | null
  purchaseOrderNo: string | null
  supplierId: number | null
  supplierName: string | null
  inboundDate: string
  warehouseId: number
  warehouseName: string
  inboundType: string
  currency: string
  totalAmount: number
  payableAmount: number
  status: string
  createdByName: string | null
  createdAt: string | null
}

/** 入库单列表筛选 */
export interface InboundOrderFilter {
  keyword?: string
  purchaseId?: number
  supplierId?: number
  warehouseId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 保存入库单明细参数 */
export interface SaveInboundItemParams {
  purchaseOrderItemId?: number | null
  materialId: number
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  unitPrice: number
  lotNo?: string | null
  supplierBatchNo?: string | null
  traceAttrsJson?: string | null
  remark?: string | null
}

/** 保存入库单参数 */
export interface SaveInboundOrderParams {
  id?: number | null
  purchaseId?: number | null
  supplierId?: number | null
  inboundDate: string
  warehouseId: number
  inboundType: string
  remark?: string | null
  items: SaveInboundItemParams[]
}

/** 采购单待入库明细 */
export interface PendingInboundItem {
  purchaseOrderItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  orderQuantity: number
  receivedQty: number
  remainingQty: number
  unitPrice: number
  lotTrackingMode: string
}

/** 获取采购单待入库明细 */
export async function getPendingInboundItems(purchaseId: number): Promise<PendingInboundItem[]> {
  if (isTauriEnv()) {
    return invoke<PendingInboundItem[]>('get_pending_inbound_items', { purchaseId })
  }
  return []
}

/** 获取入库单列表 */
export async function getInboundOrders(filter: InboundOrderFilter): Promise<PaginatedResponse<InboundOrderListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<InboundOrderListItem>>('get_inbound_orders', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 保存并确认入库单 */
export async function saveAndConfirmInbound(params: SaveInboundOrderParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_and_confirm_inbound', { params })
  }
  return Date.now()
}

// ================================================================
// 采购退货
// ================================================================

/** 采购退货列表项 */
export interface PurchaseReturnListItem {
  id: number
  returnNo: string
  inboundId: number
  inboundOrderNo: string
  purchaseOrderNo: string | null
  supplierId: number
  supplierName: string
  returnDate: string
  currency: string
  totalAmount: number
  returnReason: string | null
  status: string
  createdByName: string | null
  createdAt: string | null
}

/** 采购退货列表筛选 */
export interface PurchaseReturnFilter {
  keyword?: string
  supplierId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 入库单可退明细 */
export interface ReturnableInboundItem {
  inboundItemId: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  inboundQuantity: number
  alreadyReturnedQty: number
  returnableQty: number
  unitPrice: number
  lotId: number | null
  lotNo: string | null
}

/** 保存退货单明细参数 */
export interface SaveReturnItemParams {
  sourceInboundItemId: number
  lotId?: number | null
  materialId: number
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  unitPrice: number
  remark?: string | null
}

/** 保存退货单参数 */
export interface SavePurchaseReturnParams {
  id?: number | null
  inboundId: number
  returnDate: string
  returnReason?: string | null
  remark?: string | null
  items: SaveReturnItemParams[]
}

/** 获取入库单可退明细 */
export async function getReturnableInboundItems(inboundId: number): Promise<ReturnableInboundItem[]> {
  if (isTauriEnv()) {
    return invoke<ReturnableInboundItem[]>('get_returnable_inbound_items', { inboundId })
  }
  return []
}

/** 获取采购退货列表 */
export async function getPurchaseReturns(filter: PurchaseReturnFilter): Promise<PaginatedResponse<PurchaseReturnListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<PurchaseReturnListItem>>('get_purchase_returns', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 保存并确认采购退货 */
export async function saveAndConfirmPurchaseReturn(params: SavePurchaseReturnParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_and_confirm_purchase_return', { params })
  }
  return Date.now()
}
