import { invoke, isTauriEnv } from './core'

// ================================================================
// 系统配置命令
// ================================================================

/** 系统配置记录 */
export interface SystemConfigRecord {
  key: string
  value: string
  remark?: string
}

/** localStorage 中系统配置的存储键前缀（web 调试模式降级用） */
const CONFIG_STORAGE_PREFIX = 'cloudpivot_config_'

/**
 * 批量获取系统配置
 *
 * Tauri 环境调用后端 IPC；web 调试模式从 localStorage 读取。
 */
export async function getSystemConfigs(keys: string[]): Promise<SystemConfigRecord[]> {
  if (isTauriEnv()) {
    return invoke<SystemConfigRecord[]>('get_system_configs', { keys })
  }

  // Web 调试模式：从 localStorage 降级读取
  const records: SystemConfigRecord[] = []
  for (const key of keys) {
    const stored = localStorage.getItem(CONFIG_STORAGE_PREFIX + key)
    if (stored !== null) {
      records.push({ key, value: stored })
    }
  }
  return records
}

/**
 * 设置单个系统配置（upsert）
 *
 * Tauri 环境调用后端 IPC；web 调试模式写入 localStorage。
 */
export async function setSystemConfig(key: string, value: string): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('set_system_config', { key, value })
  }

  // Web 调试模式：写入 localStorage
  localStorage.setItem(CONFIG_STORAGE_PREFIX + key, value)
}

/**
 * 批量设置系统配置
 *
 * Tauri 环境调用后端 IPC；web 调试模式写入 localStorage。
 */
export async function setSystemConfigs(configs: { key: string; value: string }[]): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('set_system_configs', { configs })
  }

  // Web 调试模式：写入 localStorage
  for (const { key, value } of configs) {
    localStorage.setItem(CONFIG_STORAGE_PREFIX + key, value)
  }
}

// ================================================================
// 数据管理 / 导入导出
// ================================================================

/** 备份文件信息 */
export interface BackupFileInfo {
  file_name: string
  file_path: string
  size_bytes: number
  created_at: string
}

/** 数据管理状态 */
export interface DataManagementStatus {
  db_path: string
  db_size_bytes: number
  backup_dir: string
  last_backup_at: string | null
  backups: BackupFileInfo[]
}

/** 业务导入结果 */
export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

/** 物料导入行 */
export interface MaterialImportRow {
  code: string
  name: string
  material_type: string
  category_code?: string | null
  category_name?: string | null
  spec?: string | null
  base_unit_name: string
  aux_unit_name?: string | null
  conversion_rate?: number | null
  ref_cost_price?: number | null
  sale_price?: number | null
  safety_stock?: number | null
  max_stock?: number | null
  lot_tracking_mode?: string | null
  texture?: string | null
  color?: string | null
  surface_craft?: string | null
  length_mm?: number | null
  width_mm?: number | null
  height_mm?: number | null
  barcode?: string | null
  remark?: string | null
}

/** 物料导出行 */
export interface MaterialExportRow extends MaterialImportRow {
  category_code: string | null
  category_name: string | null
  spec: string | null
  aux_unit_name: string | null
  conversion_rate: number | null
  ref_cost_price: number
  sale_price: number
  safety_stock: number
  max_stock: number
  lot_tracking_mode: string
  texture: string | null
  color: string | null
  surface_craft: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  barcode: string | null
  remark: string | null
  is_enabled: boolean
}

/** 期初库存导入行 */
export interface InitialInventoryImportRow {
  material_code: string
  warehouse_code: string
  quantity: number
  unit_cost_usd: number
  received_date: string
  lot_no?: string | null
  supplier_batch_no?: string | null
  remark?: string | null
}

/** 获取数据管理状态 */
export async function getDataManagementStatus(): Promise<DataManagementStatus> {
  if (isTauriEnv()) {
    return invoke<DataManagementStatus>('get_data_management_status')
  }
  return {
    db_path: 'web-preview/cloudpivot.db',
    db_size_bytes: 0,
    backup_dir: 'web-preview/backups',
    last_backup_at: null,
    backups: [],
  }
}

/** 创建数据库备份 */
export async function createDatabaseBackup(): Promise<BackupFileInfo> {
  return invoke<BackupFileInfo>('create_database_backup')
}

/** 恢复数据库备份 */
export async function restoreDatabaseBackup(fileName: string): Promise<void> {
  return invoke<void>('restore_database_backup', { fileName })
}

/** 删除数据库备份 */
export async function deleteDatabaseBackup(fileName: string): Promise<void> {
  return invoke<void>('delete_database_backup', { fileName })
}

/** 导入物料主数据 */
export async function importMaterials(rows: MaterialImportRow[]): Promise<ImportResult> {
  return invoke<ImportResult>('import_materials', { rows })
}

/** 导出物料主数据 */
export async function exportMaterials(): Promise<MaterialExportRow[]> {
  return invoke<MaterialExportRow[]>('export_materials')
}

/** 导入期初库存 */
export async function importInitialInventory(rows: InitialInventoryImportRow[]): Promise<ImportResult> {
  return invoke<ImportResult>('import_initial_inventory', { rows })
}

// ================================================================
// 仓库命令（向导专用）
// ================================================================

/** 向导：仓库创建参数 */
export interface WarehouseSetupItem {
  name: string
  warehouse_type: 'raw' | 'semi' | 'finished'
  manager?: string
}

/**
 * 向导：批量创建仓库并生成默认仓映射
 *
 * Tauri 环境调用后端 IPC；web 调试模式写入 localStorage 模拟。
 */
export async function setupCreateWarehouses(warehouses: WarehouseSetupItem[]): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('setup_create_warehouses', { warehouses })
  }

  // Web 调试模式：模拟仓库创建
  const existing = localStorage.getItem('cloudpivot_warehouses')
  const list = existing ? JSON.parse(existing) : []
  for (const wh of warehouses) {
    list.push({ ...wh, id: Date.now() + Math.random() })
  }
  localStorage.setItem('cloudpivot_warehouses', JSON.stringify(list))
}
