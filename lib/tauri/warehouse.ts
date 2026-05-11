import { invoke, isTauriEnv } from './core'

// ================================================================
// 仓库管理
// ================================================================

/** 仓库记录 */
export interface WarehouseItem {
  id: number
  code: string
  name: string
  warehouse_type: string
  manager: string | null
  phone: string | null
  address: string | null
  remark: string | null
  is_enabled: boolean
  created_at: string | null
  updated_at: string | null
}

/** 仓库保存参数 */
export interface SaveWarehouseParams {
  id?: number | null
  code: string
  name: string
  warehouse_type: string
  manager?: string | null
  phone?: string | null
  address?: string | null
  remark?: string | null
  is_enabled?: boolean
}

/** 默认仓映射记录 */
export interface DefaultWarehouseItem {
  id: number
  material_type: string
  warehouse_id: number
  warehouse_name: string | null
}

/** 默认仓映射保存参数 */
export interface DefaultWarehouseMapping {
  material_type: string
  warehouse_id: number
}

/** mock 仓库数据 */
const MOCK_WAREHOUSES: WarehouseItem[] = [
  {
    id: 1,
    code: 'WH-RAW-001',
    name: '原材料仓',
    warehouse_type: 'raw',
    manager: 'Nguyen A',
    phone: '+84 912345678',
    address: null,
    remark: null,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 2,
    code: 'WH-FIN-001',
    name: '成品仓',
    warehouse_type: 'finished',
    manager: 'Tran B',
    phone: null,
    address: null,
    remark: null,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 3,
    code: 'WH-SEMI-001',
    name: '半成品仓',
    warehouse_type: 'semi',
    manager: null,
    phone: null,
    address: null,
    remark: null,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 4,
    code: 'WH-RET-001',
    name: '退货仓',
    warehouse_type: 'return',
    manager: null,
    phone: null,
    address: null,
    remark: null,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

/** mock 默认仓映射 */
const MOCK_DEFAULT_WAREHOUSES: DefaultWarehouseItem[] = [
  { id: 1, material_type: 'raw', warehouse_id: 1, warehouse_name: '原材料仓' },
  { id: 2, material_type: 'semi', warehouse_id: 3, warehouse_name: '半成品仓' },
  { id: 3, material_type: 'finished', warehouse_id: 2, warehouse_name: '成品仓' },
]

/** 获取仓库列表 */
export async function getWarehouses(includeDisabled: boolean = true): Promise<WarehouseItem[]> {
  if (isTauriEnv()) {
    return invoke<WarehouseItem[]>('get_warehouses', { includeDisabled })
  }
  if (includeDisabled) return [...MOCK_WAREHOUSES]
  return MOCK_WAREHOUSES.filter(w => w.is_enabled)
}

/** 获取单个仓库 */
export async function getWarehouseById(id: number): Promise<WarehouseItem> {
  if (isTauriEnv()) {
    return invoke<WarehouseItem>('get_warehouse_by_id', { id })
  }
  const item = MOCK_WAREHOUSES.find(w => w.id === id)
  if (!item) throw new Error('仓库不存在')
  return { ...item }
}

/** 保存仓库（新增或更新） */
export async function saveWarehouse(params: SaveWarehouseParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_warehouse', { params })
  }
  return params.id ?? Date.now()
}

/** 删除仓库 */
export async function deleteWarehouse(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_warehouse', { id })
  }
}

/** 启用/禁用仓库 */
export async function toggleWarehouseStatus(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('toggle_warehouse_status', { id })
  }
}

/** 生成仓库编码 */
export async function generateWarehouseCode(warehouseType: string): Promise<string> {
  if (isTauriEnv()) {
    return invoke<string>('generate_warehouse_code', { warehouseType })
  }
  const prefix = { raw: 'RAW', semi: 'SEMI', finished: 'FIN', return: 'RET' }[warehouseType] ?? 'GEN'
  const count = MOCK_WAREHOUSES.filter(w => w.warehouse_type === warehouseType).length
  return `WH-${prefix}-${String(count + 1).padStart(3, '0')}`
}

/** 获取默认仓映射 */
export async function getDefaultWarehouses(): Promise<DefaultWarehouseItem[]> {
  if (isTauriEnv()) {
    return invoke<DefaultWarehouseItem[]>('get_default_warehouses')
  }
  return [...MOCK_DEFAULT_WAREHOUSES]
}

/** 保存默认仓映射 */
export async function saveDefaultWarehouses(mappings: DefaultWarehouseMapping[]): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('save_default_warehouses', { mappings })
  }
}
