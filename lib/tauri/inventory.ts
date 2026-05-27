import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 库存管理命令
// ================================================================

/** 库存列表项 */
export interface InventoryListItem {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  categoryName: string | null
  warehouseId: number
  warehouseName: string
  quantity: number
  reservedQty: number
  availableQty: number
  avgCost: number
  inventoryValue: number
  safetyStock: number | null
  maxStock: number | null
  alertStatus: 'normal' | 'low' | 'high'
  lastInDate: string | null
  lastOutDate: string | null
}

/** 库存查询筛选参数 */
export interface InventoryFilter {
  keyword?: string
  warehouseId?: number
  categoryId?: number
  alertStatus?: string
  page: number
  pageSize: number
}

/** 分仓汇总 */
export interface InventoryWarehouseSummary {
  warehouseId: number
  warehouseName: string
  quantity: number
  reservedQty: number
  availableQty: number
  avgCost: number
  inventoryValue: number
  lastInDate: string | null
  lastOutDate: string | null
}

/** 批次明细 */
export interface InventoryLotDetail {
  id: number
  lotNo: string
  warehouseName: string
  qtyOnHand: number
  qtyReserved: number
  availableQty: number
  receiptUnitCost: number
  receivedDate: string
  ageDays: number
  supplierBatchNo: string | null
}

/** 近期流水 */
export interface RecentTransaction {
  id: number
  transactionNo: string
  transactionDate: string
  transactionType: string
  quantity: number
  beforeQty: number
  afterQty: number
  warehouseName: string
  relatedOrderNo: string | null
}

/** 库存详情 */
export interface InventoryDetail {
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  totalQuantity: number
  totalReserved: number
  totalAvailable: number
  warehouses: InventoryWarehouseSummary[]
  lots: InventoryLotDetail[]
  recentTransactions: RecentTransaction[]
}

/** 流水列表项 */
export interface TransactionListItem {
  id: number
  transactionNo: string
  transactionDate: string
  materialId: number
  materialCode: string
  materialName: string
  warehouseId: number
  warehouseName: string
  lotNo: string | null
  transactionType: string
  quantity: number
  beforeQty: number
  afterQty: number
  unitCost: number
  relatedOrderNo: string | null
  /** 来源单据类型（如 manual_stock_movement、purchase_inbound 等） */
  sourceType: string | null
  /** 手工批量单业务类型（仅来源为批量出入库单时有值） */
  businessType: string | null
  operatorName: string | null
  remark: string | null
  createdAt: string | null
}

/** 流水查询筛选参数 */
export interface TransactionFilter {
  keyword?: string
  warehouseId?: number
  transactionType?: string
  materialId?: number
  dateFrom?: string
  dateTo?: string
  /** 来源单据类型筛选 */
  sourceType?: string
  /** 手工批量单业务类型筛选 */
  businessType?: string
  page: number
  pageSize: number
}

/** 盘点单列表项 */
export interface StockCheckListItem {
  id: number
  checkNo: string
  warehouseId: number
  warehouseName: string
  checkDate: string
  status: string
  scopeType: string
  itemCount: number
  diffCount: number
  createdByName: string | null
  createdAt: string | null
}

/** 盘点单筛选参数 */
export interface StockCheckFilter {
  warehouseId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 盘点明细 */
export interface StockCheckItemData {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  spec: string | null
  unitName: string
  lotId: number | null
  lotNoSnapshot: string | null
  systemQty: number
  actualQty: number | null
  diffQty: number
  unitPrice: number
  diffAmount: number
  remark: string | null
}

/** 盘点单详情 */
export interface StockCheckDetail {
  id: number
  checkNo: string
  warehouseId: number
  warehouseName: string
  checkDate: string
  status: string
  scopeType: string
  scopeCategoryId: number | null
  remark: string | null
  createdByName: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  createdAt: string | null
  items: StockCheckItemData[]
}

/** 创建盘点单参数 */
export interface CreateStockCheckParams {
  warehouseId: number
  checkDate: string
  scopeType: string
  scopeCategoryId?: number | null
  remark?: string | null
}

/** 更新实盘数量参数 */
export interface UpdateStockCheckItemParams {
  itemId: number
  actualQty: number | null
  remark?: string | null
}

/** 调拨单列表项 */
export interface TransferListItem {
  id: number
  transferNo: string
  fromWarehouseName: string
  toWarehouseName: string
  transferDate: string
  status: string
  itemCount: number
  createdByName: string | null
  createdAt: string | null
}

/** 调拨单筛选参数 */
export interface TransferFilter {
  status?: string
  warehouseId?: number
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 调拨明细 */
export interface TransferItemData {
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
  lotId: number | null
  lotNo: string | null
  remark: string | null
}

/** 调拨单详情 */
export interface TransferDetail {
  id: number
  transferNo: string
  fromWarehouseId: number
  fromWarehouseName: string
  toWarehouseId: number
  toWarehouseName: string
  transferDate: string
  status: string
  remark: string | null
  createdByName: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  createdAt: string | null
  items: TransferItemData[]
}

/** 保存调拨明细参数 */
export interface SaveTransferItemParams {
  materialId: number
  unitId: number
  unitNameSnapshot: string
  conversionRateSnapshot: number
  quantity: number
  lotId?: number | null
  remark?: string | null
}

/** 保存调拨单参数 */
export interface SaveTransferParams {
  id?: number | null
  fromWarehouseId: number
  toWarehouseId: number
  transferDate: string
  remark?: string | null
  items: SaveTransferItemParams[]
}
// ---- 库存查询 ----

/** 获取库存列表 */
export async function getInventoryList(filter: InventoryFilter): Promise<PaginatedResponse<InventoryListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<InventoryListItem>>('get_inventory_list', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 获取库存详情 */
export async function getInventoryDetail(materialId: number): Promise<InventoryDetail> {
  return invoke<InventoryDetail>('get_inventory_detail', { materialId })
}

// ---- 出入库流水 ----

/** 获取流水列表 */
export async function getInventoryTransactions(filter: TransactionFilter): Promise<PaginatedResponse<TransactionListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<TransactionListItem>>('get_inventory_transactions', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}
// ---- 库存盘点 ----

/** 获取盘点单列表 */
export async function getStockChecks(filter: StockCheckFilter): Promise<PaginatedResponse<StockCheckListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<StockCheckListItem>>('get_stock_checks', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 获取盘点单详情 */
export async function getStockCheckDetail(id: number): Promise<StockCheckDetail> {
  return invoke<StockCheckDetail>('get_stock_check_detail', { id })
}

/** 创建盘点单 */
export async function createStockCheck(params: CreateStockCheckParams): Promise<number> {
  return invoke<number>('create_stock_check', { params })
}

/** 更新实盘数量 */
export async function updateStockCheckItems(checkId: number, items: UpdateStockCheckItemParams[]): Promise<void> {
  return invoke<void>('update_stock_check_items', { checkId, items })
}

/** 审核盘点单 */
export async function confirmStockCheck(id: number): Promise<void> {
  return invoke<void>('confirm_stock_check', { id })
}

// ---- 库存调拨 ----

/** 获取调拨单列表 */
export async function getTransfers(filter: TransferFilter): Promise<PaginatedResponse<TransferListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<TransferListItem>>('get_transfers', { filter })
  }
  return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
}

/** 获取调拨单详情 */
export async function getTransferDetail(id: number): Promise<TransferDetail> {
  return invoke<TransferDetail>('get_transfer_detail', { id })
}

/** 保存调拨单 */
export async function saveTransfer(params: SaveTransferParams): Promise<number> {
  return invoke<number>('save_transfer', { params })
}

/** 确认调拨 */
export async function confirmTransfer(id: number): Promise<void> {
  return invoke<void>('confirm_transfer', { id })
}

/** 删除草稿调拨单 */
export async function deleteTransfer(id: number): Promise<void> {
  return invoke<void>('delete_transfer', { id })
}
