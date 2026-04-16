/**
 * Tauri IPC 通信封装
 *
 * 封装前端与 Rust 后端的通信接口。
 * 在浏览器环境下（开发模式无 Tauri）提供 mock 降级。
 */

// ================================================================
// 类型定义
// ================================================================

/** 用户信息（对应 Rust UserInfo） */
export interface UserInfo {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'operator'
  must_change_password: boolean
  session_version: number
}

/** 登录响应 */
export interface LoginResponse {
  user: UserInfo
  must_change_password: boolean
}

// ================================================================
// 底层通信
// ================================================================

/**
 * 判断是否运行在 Tauri 环境中
 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 调用 Tauri IPC 命令
 *
 * @param command - 命令名称（对应 Rust #[tauri::command] 函数名）
 * @param args - 传递给命令的参数
 * @returns 命令返回值
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnv()) {
    console.warn(`[Tauri] 非 Tauri 环境，跳过命令: ${command}`)
    throw new Error(`Command "${command}" is not available outside Tauri environment`)
  }

  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

// ================================================================
// 通用命令
// ================================================================

/** ping 测试 — 验证前后端通信链路 */
export async function ping(): Promise<string> {
  return invoke<string>('ping')
}

/** 获取数据库版本号 */
export async function getDbVersion(): Promise<number> {
  return invoke<number>('get_db_version')
}

// ================================================================
// 认证命令
// ================================================================

/** 用户登录 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  return invoke<LoginResponse>('login', {
    request: { username, password },
  })
}

/** 修改密码 */
export async function changePassword(userId: number, newPassword: string): Promise<void> {
  return invoke<void>('change_password', {
    request: { user_id: userId, new_password: newPassword },
  })
}

/** 获取用户信息 */
export async function getUserInfo(userId: number): Promise<UserInfo> {
  return invoke<UserInfo>('get_user_info', { user_id: userId })
}

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

// ================================================================
// 分类管理命令
// ================================================================

/** 分类树节点（扁平结构，前端组装层级） */
export interface CategoryNode {
  id: number
  parent_id: number | null
  name: string
  code: string
  sort_order: number
  level: number
  path: string | null
  remark: string | null
  is_enabled: boolean
  created_at: string | null
  updated_at: string | null
}

/** 创建分类参数 */
export interface CreateCategoryParams {
  name: string
  parent_id?: number | null
  sort_order?: number
  remark?: string
}

/** 更新分类参数 */
export interface UpdateCategoryParams {
  id: number
  name: string
  parent_id?: number | null
  sort_order?: number
  remark?: string
}

/** 排序项 */
export interface CategorySortItem {
  id: number
  parent_id: number | null
  sort_order: number
}

/** Mock 分类数据（Web 调试模式） */
const MOCK_CATEGORIES: CategoryNode[] = [
  {
    id: 1,
    parent_id: null,
    name: '木材',
    code: 'CAT-WOOD',
    sort_order: 0,
    level: 1,
    path: '1',
    remark: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 2,
    parent_id: 1,
    name: '实木板材',
    code: 'CAT-SOLID',
    sort_order: 0,
    level: 2,
    path: '1/2',
    remark: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 3,
    parent_id: 1,
    name: '人造板材',
    code: 'CAT-MAN',
    sort_order: 1,
    level: 2,
    path: '1/3',
    remark: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 4,
    parent_id: null,
    name: '五金配件',
    code: 'CAT-HARDWARE',
    sort_order: 1,
    level: 1,
    path: '4',
    remark: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 5,
    parent_id: 4,
    name: '铰链/合页',
    code: 'CAT-HINGE',
    sort_order: 0,
    level: 2,
    path: '4/5',
    remark: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 6,
    parent_id: null,
    name: '成品家具',
    code: 'CAT-FINISHED',
    sort_order: 2,
    level: 1,
    path: '6',
    remark: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

/**
 * 获取分类树（扁平列表）
 *
 * Tauri 环境调用后端 IPC；web 调试模式返回 mock 数据。
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  if (isTauriEnv()) {
    return invoke<CategoryNode[]>('get_category_tree')
  }
  return MOCK_CATEGORIES
}

/**
 * 创建分类
 *
 * @returns 新分类 ID
 */
export async function createCategory(params: CreateCategoryParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('create_category', { params })
  }
  // Web mock
  const id = Date.now()
  console.log('[Mock] createCategory', id, params)
  return id
}

/**
 * 更新分类
 */
export async function updateCategory(params: UpdateCategoryParams): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('update_category', { params })
  }
  console.log('[Mock] updateCategory', params)
}

/**
 * 删除分类
 */
export async function deleteCategory(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_category', { id })
  }
  console.log('[Mock] deleteCategory', id)
}

/**
 * 批量更新分类排序（拖拽后持久化）
 */
export async function updateCategoryOrder(items: CategorySortItem[]): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('update_category_order', { items })
  }
  console.log('[Mock] updateCategoryOrder', items)
}

// ================================================================
// 供应商管理命令
// ================================================================

/** 分页响应（通用，对应 Rust PaginatedResponse<T>） */
export interface PaginatedResponse<T> {
  total: number
  items: T[]
  page: number
  page_size: number
}

/** 供应商列表项（对应 Rust SupplierListItem） */
export interface SupplierListItem {
  id: number
  code: string
  name: string
  shortName: string | null
  country: string
  contactPerson: string | null
  contactPhone: string | null
  businessCategory: string | null
  grade: string
  currency: string
  isEnabled: boolean
}

/** 供应商保存参数（对应 Rust SaveSupplierParams） */
export interface SaveSupplierParams {
  id?: number | null
  code: string
  name: string
  shortName?: string | null
  country: string
  contactPerson?: string | null
  contactPhone?: string | null
  email?: string | null
  businessCategory?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  bankName?: string | null
  bankAccount?: string | null
  taxId?: string | null
  currency: string
  settlementType: string
  creditDays: number
  grade: string
  remark?: string | null
  isEnabled: boolean
}

/** 供应商筛选参数 */
export interface SupplierFilter {
  keyword?: string
  country?: string
  businessCategory?: string
  grade?: string
  page: number
  pageSize: number
}

/** Mock 供应商数据（Web 调试模式） */
const MOCK_SUPPLIERS: SupplierListItem[] = [
  {
    id: 1,
    code: 'SUP-2024-001',
    name: 'Công ty TNHH Gỗ Bình Dương',
    shortName: 'Gỗ Bình Dương',
    country: 'VN',
    contactPerson: 'Nguyễn Văn A',
    contactPhone: '+84 274-123-4567',
    businessCategory: '木材',
    grade: 'A',
    currency: 'VND',
    isEnabled: true,
  },
  {
    id: 2,
    code: 'SUP-2024-002',
    name: '东莞市恒达五金有限公司',
    shortName: '恒达五金',
    country: 'CN',
    contactPerson: '张明华',
    contactPhone: '+86 769-8888-7777',
    businessCategory: '五金配件',
    grade: 'A',
    currency: 'CNY',
    isEnabled: true,
  },
  {
    id: 3,
    code: 'SUP-2024-003',
    name: 'Saigon Timber Trading Co., Ltd',
    shortName: 'Saigon Timber',
    country: 'VN',
    contactPerson: 'Trần Thị B',
    contactPhone: '+84 28-3456-7890',
    businessCategory: '木材',
    grade: 'B',
    currency: 'VND',
    isEnabled: true,
  },
  {
    id: 4,
    code: 'SUP-2024-004',
    name: '佛山市顺德区欧瑞油漆有限公司',
    shortName: '欧瑞油漆',
    country: 'CN',
    contactPerson: '李强',
    contactPhone: '+86 757-2222-3333',
    businessCategory: '油漆涂料',
    grade: 'B',
    currency: 'CNY',
    isEnabled: true,
  },
  {
    id: 5,
    code: 'SUP-2024-005',
    name: 'Malaysian Rubber Industries Sdn Bhd',
    shortName: 'MRI Rubber',
    country: 'MY',
    contactPerson: 'Ahmad bin Hassan',
    contactPhone: '+60 3-7890-1234',
    businessCategory: '橡胶制品',
    grade: 'A',
    currency: 'USD',
    isEnabled: true,
  },
]

/** Mock 供应商详情（Web 调试模式） */
const MOCK_SUPPLIER_DETAIL: SaveSupplierParams = {
  id: 1,
  code: 'SUP-2024-001',
  name: 'Công ty TNHH Gỗ Bình Dương',
  shortName: 'Gỗ Bình Dương',
  country: 'VN',
  contactPerson: 'Nguyễn Văn A',
  contactPhone: '+84 274-123-4567',
  email: 'contact@gobinhduong.vn',
  businessCategory: '木材',
  province: 'Bình Dương',
  city: 'Thủ Dầu Một',
  address: '123 Đại lộ Bình Dương, KCN Sóng Thần',
  bankName: 'Vietcombank',
  bankAccount: '0071001234567',
  taxId: '3702345678',
  currency: 'VND',
  settlementType: 'monthly',
  creditDays: 30,
  grade: 'A',
  remark: '',
  isEnabled: true,
}

/**
 * 查询供应商列表（支持筛选 + 分页）
 *
 * Tauri 环境调用后端 IPC；web 调试模式返回 mock 数据。
 */
export async function getSuppliers(filter: SupplierFilter): Promise<PaginatedResponse<SupplierListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<SupplierListItem>>('get_suppliers', { filter })
  }

  // Web mock：客户端模拟筛选 + 分页
  let filtered = [...MOCK_SUPPLIERS]
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase()
    filtered = filtered.filter(s => s.code.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw))
  }
  if (filter.country) {
    filtered = filtered.filter(s => s.country === filter.country)
  }
  if (filter.grade) {
    filtered = filtered.filter(s => s.grade === filter.grade)
  }
  if (filter.businessCategory) {
    filtered = filtered.filter(s => s.businessCategory === filter.businessCategory)
  }
  const start = (filter.page - 1) * filter.pageSize
  return {
    total: filtered.length,
    items: filtered.slice(start, start + filter.pageSize),
    page: filter.page,
    page_size: filter.pageSize,
  }
}

/**
 * 获取供应商详情（用于编辑表单）
 */
export async function getSupplierById(id: number): Promise<SaveSupplierParams> {
  if (isTauriEnv()) {
    return invoke<SaveSupplierParams>('get_supplier_by_id', { id })
  }
  // Web mock：找到匹配的或返回默认
  const found = MOCK_SUPPLIERS.find(s => s.id === id)
  if (found) {
    return { ...MOCK_SUPPLIER_DETAIL, ...found }
  }
  return { ...MOCK_SUPPLIER_DETAIL }
}

/**
 * 保存供应商（新增或更新）
 *
 * @returns 供应商 ID
 */
export async function saveSupplier(params: SaveSupplierParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_supplier', { params })
  }
  // Web mock
  const id = params.id ?? Date.now()
  console.log('[Mock] saveSupplier', id, params)
  return id
}

/**
 * 切换供应商启用/禁用状态
 */
export async function toggleSupplierStatus(id: number, isEnabled: boolean): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('toggle_supplier_status', { id, is_enabled: isEnabled })
  }
  console.log('[Mock] toggleSupplierStatus', id, isEnabled)
}

/**
 * 生成下一个供应商编码
 */
export async function generateSupplierCode(): Promise<string> {
  if (isTauriEnv()) {
    return invoke<string>('generate_supplier_code')
  }
  // Web mock：随机编码
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `SUP-${year}-${seq}`
}

/**
 * 获取经营类别去重列表（用于筛选下拉框）
 */
export async function getSupplierCategories(): Promise<string[]> {
  if (isTauriEnv()) {
    return invoke<string[]>('get_supplier_categories')
  }
  // Web mock
  return [...new Set(MOCK_SUPPLIERS.map(s => s.businessCategory).filter(Boolean) as string[])]
}
