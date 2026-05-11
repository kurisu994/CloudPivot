import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 库存管理命令
// ================================================================

/** 库存列表项 */
export interface InventoryListItem {
  id: number
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  category_name: string | null
  warehouse_id: number
  warehouse_name: string
  quantity: number
  reserved_qty: number
  available_qty: number
  avg_cost: number
  inventory_value: number
  safety_stock: number | null
  max_stock: number | null
  alert_status: 'normal' | 'low' | 'high'
  last_in_date: string | null
  last_out_date: string | null
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
  warehouse_id: number
  warehouse_name: string
  quantity: number
  reserved_qty: number
  available_qty: number
  avg_cost: number
  inventory_value: number
  last_in_date: string | null
  last_out_date: string | null
}

/** 批次明细 */
export interface InventoryLotDetail {
  id: number
  lot_no: string
  warehouse_name: string
  qty_on_hand: number
  qty_reserved: number
  available_qty: number
  receipt_unit_cost: number
  received_date: string
  age_days: number
  supplier_batch_no: string | null
}

/** 近期流水 */
export interface RecentTransaction {
  id: number
  transaction_no: string
  transaction_date: string
  transaction_type: string
  quantity: number
  before_qty: number
  after_qty: number
  warehouse_name: string
  related_order_no: string | null
}

/** 库存详情 */
export interface InventoryDetail {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  total_quantity: number
  total_reserved: number
  total_available: number
  warehouses: InventoryWarehouseSummary[]
  lots: InventoryLotDetail[]
  recent_transactions: RecentTransaction[]
}

/** 流水列表项 */
export interface TransactionListItem {
  id: number
  transaction_no: string
  transaction_date: string
  material_id: number
  material_code: string
  material_name: string
  warehouse_id: number
  warehouse_name: string
  lot_no: string | null
  transaction_type: string
  quantity: number
  before_qty: number
  after_qty: number
  unit_cost: number
  related_order_no: string | null
  operator_name: string | null
  remark: string | null
  created_at: string | null
}

/** 流水查询筛选参数 */
export interface TransactionFilter {
  keyword?: string
  warehouseId?: number
  transactionType?: string
  materialId?: number
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 盘点单列表项 */
export interface StockCheckListItem {
  id: number
  check_no: string
  warehouse_id: number
  warehouse_name: string
  check_date: string
  status: string
  scope_type: string
  item_count: number
  diff_count: number
  created_by_name: string | null
  created_at: string | null
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
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  unit_name: string
  lot_id: number | null
  lot_no_snapshot: string | null
  system_qty: number
  actual_qty: number | null
  diff_qty: number
  unit_price: number
  diff_amount: number
  remark: string | null
}

/** 盘点单详情 */
export interface StockCheckDetail {
  id: number
  check_no: string
  warehouse_id: number
  warehouse_name: string
  check_date: string
  status: string
  scope_type: string
  scope_category_id: number | null
  remark: string | null
  created_by_name: string | null
  confirmed_by_name: string | null
  confirmed_at: string | null
  created_at: string | null
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
  transfer_no: string
  from_warehouse_name: string
  to_warehouse_name: string
  transfer_date: string
  status: string
  item_count: number
  created_by_name: string | null
  created_at: string | null
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
  material_id: number
  material_code: string | null
  material_name: string | null
  spec: string | null
  unit_id: number
  unit_name_snapshot: string
  conversion_rate_snapshot: number
  quantity: number
  base_quantity: number
  lot_id: number | null
  lot_no: string | null
  remark: string | null
}

/** 调拨单详情 */
export interface TransferDetail {
  id: number
  transfer_no: string
  from_warehouse_id: number
  from_warehouse_name: string
  to_warehouse_id: number
  to_warehouse_name: string
  transfer_date: string
  status: string
  remark: string | null
  created_by_name: string | null
  confirmed_by_name: string | null
  confirmed_at: string | null
  created_at: string | null
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

/** 自由出入库参数 */
export interface ManualStockMovementParams {
  movementType: 'in' | 'out'
  materialId: number
  warehouseId: number
  movementDate: string
  quantity: number
  unitCostUsd?: number | null
  lotNo?: string | null
  supplierBatchNo?: string | null
  remark?: string | null
}

// ---- 库存查询 ----

/** 获取库存列表 */
export async function getInventoryList(filter: InventoryFilter): Promise<PaginatedResponse<InventoryListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<InventoryListItem>>('get_inventory_list', { filter })
  }
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
}

/** 创建自由出入库记录 */
export async function createManualStockMovement(params: ManualStockMovementParams): Promise<string> {
  if (isTauriEnv()) {
    return invoke<string>('create_manual_stock_movement', { params })
  }
  return `FM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-001`
}

// ---- 库存盘点 ----

/** 获取盘点单列表 */
export async function getStockChecks(filter: StockCheckFilter): Promise<PaginatedResponse<StockCheckListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<StockCheckListItem>>('get_stock_checks', { filter })
  }
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
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
