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
  fileName: string
  filePath: string
  sizeBytes: number
  createdAt: string
}

/** 数据管理状态 */
export interface DataManagementStatus {
  dbPath: string
  dbSizeBytes: number
  backupDir: string
  lastBackupAt: string | null
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
  materialType: string
  categoryCode?: string | null
  categoryName?: string | null
  spec?: string | null
  baseUnitName: string
  auxUnitName?: string | null
  conversionRate?: number | null
  refCostPrice?: number | null
  salePrice?: number | null
  safetyStock?: number | null
  maxStock?: number | null
  lotTrackingMode?: string | null
  texture?: string | null
  color?: string | null
  surfaceCraft?: string | null
  lengthMm?: number | null
  widthMm?: number | null
  heightMm?: number | null
  barcode?: string | null
  remark?: string | null
}

/** 物料导出行 */
export interface MaterialExportRow extends MaterialImportRow {
  categoryCode: string | null
  categoryName: string | null
  spec: string | null
  auxUnitName: string | null
  conversionRate: number | null
  refCostPrice: number
  salePrice: number
  safetyStock: number
  maxStock: number
  lotTrackingMode: string
  texture: string | null
  color: string | null
  surfaceCraft: string | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  barcode: string | null
  remark: string | null
  isEnabled: boolean
}

/** 期初库存导入行 */
export interface InitialInventoryImportRow {
  materialCode: string
  warehouseCode: string
  quantity: number
  unitCostUsd: number
  receivedDate: string
  lotNo?: string | null
  supplier_batch_no?: string | null
  remark?: string | null
}

/** 获取数据管理状态 */
export async function getDataManagementStatus(): Promise<DataManagementStatus> {
  if (isTauriEnv()) {
    return invoke<DataManagementStatus>('get_data_management_status')
  }
  return {
    dbPath: 'web-preview/cloudpivot.db',
    dbSizeBytes: 0,
    backupDir: 'web-preview/backups',
    lastBackupAt: null,
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
  warehouseType: 'raw' | 'semi' | 'finished'
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
