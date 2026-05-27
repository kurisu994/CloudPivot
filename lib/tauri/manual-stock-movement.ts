import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ---- 类型定义 ----

/** 批量出入库单列表项 */
export interface ManualMovementListItem {
  id: number
  movementNo: string
  direction: 'in' | 'out'
  businessType: string
  warehouseId: number
  warehouseName: string
  movementDate: string
  counterpartyName: string | null
  status: 'draft' | 'confirmed'
  itemCount: number
  createdByName: string | null
  createdAt: string | null
}

/** 列表筛选参数 */
export interface ManualMovementFilter {
  keyword?: string
  warehouseId?: number
  direction?: string
  status?: string
  businessType?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 明细项数据 */
export interface ManualMovementItemData {
  id: number | null
  sortOrder: number
  materialId: number
  materialCode: string | null
  materialName: string | null
  spec: string | null
  unitName: string | null
  quantity: number
  unitCostUsd: number | null
  lotNo: string | null
  supplierBatchNo: string | null
}

/** 单据详情 */
export interface ManualMovementDetail {
  id: number
  movementNo: string
  direction: 'in' | 'out'
  businessType: string
  warehouseId: number
  warehouseName: string
  movementDate: string
  counterpartyName: string | null
  remark: string | null
  status: 'draft' | 'confirmed'
  createdByName: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  createdAt: string | null
  items: ManualMovementItemData[]
}

/** 保存明细行参数 */
export interface SaveManualMovementItemParams {
  materialId: number
  sortOrder: number
  quantity: number
  unitCostUsd?: number | null
  lotNo?: string | null
  supplierBatchNo?: string | null
}

/** 保存单据参数 */
export interface SaveManualMovementParams {
  id?: number | null
  direction: string
  businessType: string
  warehouseId: number
  movementDate: string
  counterpartyName?: string | null
  remark?: string | null
  items: SaveManualMovementItemParams[]
}

/** 确认过账参数 */
export interface ConfirmManualMovementParams {
  id: number
  riskConfirmed?: boolean
}

// ---- IPC 封装函数 ----

/** 获取批量出入库单列表 */
export async function getManualStockMovements(filter: ManualMovementFilter): Promise<PaginatedResponse<ManualMovementListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<ManualMovementListItem>>('get_manual_stock_movements', { filter })
  }
  // 非 Tauri 降级 mock
  return {
    total: 0,
    items: [],
    page: filter.page,
    pageSize: filter.pageSize,
  }
}

/** 获取批量出入库单详情 */
export async function getManualStockMovementDetail(id: number): Promise<ManualMovementDetail> {
  if (isTauriEnv()) {
    return invoke<ManualMovementDetail>('get_manual_stock_movement_detail', { id })
  }
  // 非 Tauri 降级 mock
  return {
    id,
    movementNo: `FM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-001`,
    direction: 'in',
    businessType: 'manual_purchase_in',
    warehouseId: 1,
    warehouseName: 'Mock Warehouse',
    movementDate: new Date().toISOString().slice(0, 10),
    counterpartyName: null,
    remark: 'Mock Detail Data',
    status: 'draft',
    createdByName: 'Admin',
    confirmedByName: null,
    confirmedAt: null,
    createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    items: [],
  }
}

/** 保存批量出入库单（新建或修改草稿） */
export async function saveManualStockMovement(params: SaveManualMovementParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_manual_stock_movement', { params })
  }
  return params.id || Math.floor(Math.random() * 1000)
}

/** 确认过账批量出入库单 */
export async function confirmManualStockMovement(params: ConfirmManualMovementParams): Promise<string> {
  if (isTauriEnv()) {
    return invoke<string>('confirm_manual_stock_movement', { params })
  }
  return `FM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-001`
}

/** 删除批量出入库单草稿 */
export async function deleteManualStockMovement(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_manual_stock_movement', { id })
  }
}
