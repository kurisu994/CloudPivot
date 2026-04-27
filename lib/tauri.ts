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
    // 智能 mock 常见的数据结构，避免 dev-web 下页面崩溃

    // 1. 明确返回数组的命令
    const arrayCommands = [
      'get_bom_child_materials',
      'get_bom_parent_materials',
      'calculate_bom_demand',
      'reverse_lookup_material',
      'get_category_tree',
      'get_warehouses',
      'get_system_configs',
      'get_supplier_categories',
      'get_material_reference_options',
      'get_default_warehouses',
      'get_all_units',
      'get_supplier_materials_for_purchase',
      'get_pending_inbound_items',
      'get_returnable_inbound_items',
      'get_pending_outbound_items',
      'get_returnable_outbound_items',
      'get_replenishment_suggestions',
      'get_consumption_trend',
    ]
    if (arrayCommands.includes(command)) {
      return [] as unknown as T
    }

    // 2. 明确返回带有 items 的对象的命令（非分页）
    if (command === 'get_boms') {
      return { items: [] } as unknown as T
    }

    // 3. 详情查询与分页列表的混合探测策略
    if (command.startsWith('get_') || command.includes('_list')) {
      if (args && ('filter' in args || 'page' in args)) {
        return { total: 0, items: [], page: 1, pageSize: 10, page_size: 10 } as unknown as T
      }
      // 如果不是分页列表，默认当做返回空对象详情
      return {} as unknown as T
    }

    if (command.startsWith('calculate_')) {
      return {} as unknown as T
    }

    // 5. 其余写操作命令默认返回 null
    console.warn(`[Tauri] 未匹配到 Mock 策略的命令: ${command}`, args)
    return null as unknown as T
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

/** 认证数据在 localStorage 中的存储键（Web 调试模式降级用） */
const AUTH_STORAGE_KEY = 'cloudpivot_auth'

/** 保存认证信息到系统钥匙串（Tauri 环境）或 localStorage（Web 调试模式） */
export async function saveAuthKeychain(data: string): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('save_auth_keychain', { data })
  }
  localStorage.setItem(AUTH_STORAGE_KEY, data)
}

/** 从系统钥匙串读取认证信息 */
export async function readAuthKeychain(): Promise<string | null> {
  if (isTauriEnv()) {
    return invoke<string | null>('read_auth_keychain')
  }
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

/** 清除系统钥匙串中的认证信息 */
export async function clearAuthKeychain(): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('clear_auth_keychain')
  }
  localStorage.removeItem(AUTH_STORAGE_KEY)
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
  payableBalance: number
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

export interface SupplierMaterialItem {
  id: number
  supplierId: number
  materialId: number
  materialCode: string
  materialName: string
  materialSpec: string | null
  unitName: string | null
  supplyPrice: number | null
  currency: 'VND' | 'CNY' | 'USD'
  leadDays: number
  minOrderQty: number | null
  isPreferred: boolean
  validFrom: string | null
  validTo: string | null
  lastPurchaseDate: string | null
  remark: string | null
}

export interface SaveSupplierMaterialParams {
  id?: number | null
  supplierId: number
  materialId: number
  supplyPrice: number
  currency: 'VND' | 'CNY' | 'USD'
  leadDays: number
  minOrderQty?: number | null
  validFrom?: string | null
  validTo?: string | null
  isPreferred: boolean
  remark?: string | null
}

export interface MaterialReferenceOption {
  id: number
  code: string
  name: string
  spec: string | null
  unitName: string | null
}

export interface SupplierPurchaseRecord {
  id: number
  orderNo: string
  orderDate: string
  status: string
  currency: 'VND' | 'CNY' | 'USD'
  totalAmount: number
}

export interface SupplierPayableRecord {
  id: number
  orderNo: string | null
  payableDate: string
  dueDate: string | null
  currency: 'VND' | 'CNY' | 'USD'
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  status: 'unpaid' | 'partial' | 'paid'
}

export interface SupplierPayablesSummary {
  totalUnpaidAmount: number
  overdueCount: number
  openCount: number
  records: SupplierPayableRecord[]
}

export interface SupplierDetailResponse {
  supplier: SaveSupplierParams
  supplyMaterials: SupplierMaterialItem[]
  recentPurchases: SupplierPurchaseRecord[]
  payablesSummary: SupplierPayablesSummary
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
    payableBalance: 12500000,
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
    payableBalance: 820000,
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
    payableBalance: 3500000,
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
    payableBalance: 0,
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
    payableBalance: 248000,
    isEnabled: true,
  },
]

/** Mock 供应商详情（Web 调试模式） */
const MOCK_MATERIAL_REFERENCE_OPTIONS: MaterialReferenceOption[] = [
  { id: 1, code: 'M-0001', name: '白橡实木板', spec: '2440×1220', unitName: '张' },
  { id: 2, code: 'M-0002', name: '不锈钢铰链', spec: '40mm', unitName: '个' },
  { id: 3, code: 'M-0015', name: 'NC 底漆', spec: '18L', unitName: '桶' },
  { id: 4, code: 'M-0032', name: '真皮面料', spec: '1.4mm', unitName: '米' },
]

const MOCK_SUPPLIER_DETAILS: Record<number, SupplierDetailResponse> = {
  1: {
    supplier: {
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
      remark: '越南本地板材核心供应商',
      isEnabled: true,
    },
    supplyMaterials: [
      {
        id: 11,
        supplierId: 1,
        materialId: 1,
        materialCode: 'M-0001',
        materialName: '白橡实木板',
        materialSpec: '2440×1220',
        unitName: '张',
        supplyPrice: 385000,
        currency: 'VND',
        leadDays: 5,
        minOrderQty: 50,
        isPreferred: true,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        lastPurchaseDate: '2026-04-10',
        remark: '含税到厂价',
      },
    ],
    recentPurchases: [
      { id: 101, orderNo: 'PO-20260410-001', orderDate: '2026-04-10', status: 'approved', currency: 'VND', totalAmount: 12500000 },
      { id: 102, orderNo: 'PO-20260403-002', orderDate: '2026-04-03', status: 'partial_in', currency: 'VND', totalAmount: 6800000 },
    ],
    payablesSummary: {
      totalUnpaidAmount: 12500000,
      overdueCount: 1,
      openCount: 2,
      records: [
        {
          id: 201,
          orderNo: 'PI-20260410-001',
          payableDate: '2026-04-10',
          dueDate: '2026-04-15',
          currency: 'VND',
          payableAmount: 12500000,
          paidAmount: 0,
          unpaidAmount: 12500000,
          status: 'unpaid',
        },
        {
          id: 202,
          orderNo: 'PI-20260322-004',
          payableDate: '2026-03-22',
          dueDate: '2026-04-05',
          currency: 'VND',
          payableAmount: 4500000,
          paidAmount: 2000000,
          unpaidAmount: 2500000,
          status: 'partial',
        },
      ],
    },
  },
  2: {
    supplier: {
      id: 2,
      code: 'SUP-2024-002',
      name: '东莞市恒达五金有限公司',
      shortName: '恒达五金',
      country: 'CN',
      contactPerson: '张明华',
      contactPhone: '+86 769-8888-7777',
      email: 'sales@hengda.cn',
      businessCategory: '五金配件',
      province: '广东省',
      city: '东莞市',
      address: '长安镇锦厦五金路 18 号',
      bankName: '中国银行东莞长安支行',
      bankAccount: '6217001234567890',
      taxId: '91441900778312345X',
      currency: 'CNY',
      settlementType: 'monthly',
      creditDays: 45,
      grade: 'A',
      remark: '铰链/滑轨主力供应商',
      isEnabled: true,
    },
    supplyMaterials: [
      {
        id: 12,
        supplierId: 2,
        materialId: 2,
        materialCode: 'M-0002',
        materialName: '不锈钢铰链',
        materialSpec: '40mm',
        unitName: '个',
        supplyPrice: 480,
        currency: 'CNY',
        leadDays: 12,
        minOrderQty: 1000,
        isPreferred: true,
        validFrom: '2026-02-01',
        validTo: '2026-06-30',
        lastPurchaseDate: '2026-04-01',
        remark: '',
      },
    ],
    recentPurchases: [{ id: 103, orderNo: 'PO-20260401-006', orderDate: '2026-04-01', status: 'completed', currency: 'CNY', totalAmount: 820000 }],
    payablesSummary: {
      totalUnpaidAmount: 820000,
      overdueCount: 0,
      openCount: 1,
      records: [
        {
          id: 203,
          orderNo: 'PI-20260402-003',
          payableDate: '2026-04-02',
          dueDate: '2026-05-17',
          currency: 'CNY',
          payableAmount: 820000,
          paidAmount: 0,
          unpaidAmount: 820000,
          status: 'unpaid',
        },
      ],
    },
  },
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
  let filtered = [...MOCK_SUPPLIERS].sort((left, right) => right.id - left.id)
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase()
    filtered = filtered.filter(
      supplier =>
        supplier.code.toLowerCase().includes(kw) || supplier.name.toLowerCase().includes(kw) || supplier.shortName?.toLowerCase().includes(kw),
    )
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
  const found = MOCK_SUPPLIER_DETAILS[id]
  if (found) return structuredClone(found.supplier)

  return {
    id,
    code: `SUP-${new Date().getFullYear()}-999`,
    name: '',
    shortName: '',
    country: 'VN',
    contactPerson: '',
    contactPhone: '',
    email: '',
    businessCategory: '',
    province: '',
    city: '',
    address: '',
    bankName: '',
    bankAccount: '',
    taxId: '',
    currency: 'USD',
    settlementType: 'cash',
    creditDays: 0,
    grade: 'B',
    remark: '',
    isEnabled: true,
  }
}

export async function getSupplierDetail(id: number): Promise<SupplierDetailResponse> {
  if (isTauriEnv()) {
    return invoke<SupplierDetailResponse>('get_supplier_detail', { id })
  }

  const detail = MOCK_SUPPLIER_DETAILS[id]
  if (detail) {
    return structuredClone(detail)
  }

  const supplier = await getSupplierById(id)
  return {
    supplier,
    supplyMaterials: [],
    recentPurchases: [],
    payablesSummary: {
      totalUnpaidAmount: 0,
      overdueCount: 0,
      openCount: 0,
      records: [],
    },
  }
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

  const id = params.id ?? Date.now()
  const base = MOCK_SUPPLIER_DETAILS[id]
  const mergedSupplier: SaveSupplierParams = {
    ...(base?.supplier ?? {}),
    ...params,
    id,
  }

  MOCK_SUPPLIER_DETAILS[id] = {
    supplier: mergedSupplier,
    supplyMaterials: base?.supplyMaterials ?? [],
    recentPurchases: base?.recentPurchases ?? [],
    payablesSummary: base?.payablesSummary ?? {
      totalUnpaidAmount: 0,
      overdueCount: 0,
      openCount: 0,
      records: [],
    },
  }

  const listIndex = MOCK_SUPPLIERS.findIndex(item => item.id === id)
  const listItem: SupplierListItem = {
    id,
    code: mergedSupplier.code,
    name: mergedSupplier.name,
    shortName: mergedSupplier.shortName ?? null,
    country: mergedSupplier.country,
    contactPerson: mergedSupplier.contactPerson ?? null,
    contactPhone: mergedSupplier.contactPhone ?? null,
    businessCategory: mergedSupplier.businessCategory ?? null,
    grade: mergedSupplier.grade,
    currency: mergedSupplier.currency,
    payableBalance: MOCK_SUPPLIER_DETAILS[id].payablesSummary.totalUnpaidAmount,
    isEnabled: mergedSupplier.isEnabled,
  }

  if (listIndex >= 0) {
    MOCK_SUPPLIERS[listIndex] = listItem
  } else {
    MOCK_SUPPLIERS.unshift(listItem)
  }

  return id
}

export async function deleteSupplier(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_supplier', { id })
  }

  const detail = MOCK_SUPPLIER_DETAILS[id]
  if (detail && (detail.recentPurchases.length > 0 || detail.payablesSummary.records.length > 0)) {
    throw new Error('该供应商已有采购或账款记录，不能删除')
  }

  const listIndex = MOCK_SUPPLIERS.findIndex(item => item.id === id)
  if (listIndex >= 0) {
    MOCK_SUPPLIERS.splice(listIndex, 1)
  }
  delete MOCK_SUPPLIER_DETAILS[id]
}

/**
 * 切换供应商启用/禁用状态
 */
export async function toggleSupplierStatus(id: number, isEnabled: boolean): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('toggle_supplier_status', { id, is_enabled: isEnabled })
  }
  const listItem = MOCK_SUPPLIERS.find(item => item.id === id)
  if (listItem) {
    listItem.isEnabled = isEnabled
  }

  const detail = MOCK_SUPPLIER_DETAILS[id]
  if (detail) {
    detail.supplier.isEnabled = isEnabled
  }
}

/**
 * 生成下一个供应商编码
 */
export async function generateSupplierCode(): Promise<string> {
  if (isTauriEnv()) {
    return invoke<string>('generate_supplier_code')
  }

  const year = new Date().getFullYear()
  const maxSeq = MOCK_SUPPLIERS.reduce((currentMax, supplier) => {
    const match = supplier.code.match(new RegExp(`^SUP-${year}-(\\d+)$`))
    if (!match) {
      return currentMax
    }
    return Math.max(currentMax, Number(match[1]))
  }, 0)
  const seq = String(maxSeq + 1).padStart(3, '0')
  return `SUP-${year}-${seq}`
}

/**
 * 获取经营类别去重列表（用于筛选下拉框）
 */
export async function getSupplierCategories(): Promise<string[]> {
  if (isTauriEnv()) {
    return invoke<string[]>('get_supplier_categories')
  }
  return [...new Set(MOCK_SUPPLIERS.map(s => s.businessCategory).filter(Boolean) as string[])]
}

export async function getMaterialReferenceOptions(): Promise<MaterialReferenceOption[]> {
  if (isTauriEnv()) {
    return invoke<MaterialReferenceOption[]>('get_material_reference_options')
  }

  return structuredClone(MOCK_MATERIAL_REFERENCE_OPTIONS)
}

export async function saveSupplierMaterial(params: SaveSupplierMaterialParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_supplier_material', { params })
  }

  const detail = MOCK_SUPPLIER_DETAILS[params.supplierId]
  if (!detail) {
    throw new Error('Supplier not found')
  }

  const materialRef = MOCK_MATERIAL_REFERENCE_OPTIONS.find(item => item.id === params.materialId)
  if (!materialRef) {
    throw new Error('Material not found')
  }

  if (params.supplyPrice < 0) {
    throw new Error('报价不能为负数')
  }

  if (params.leadDays < 0) {
    throw new Error('交货周期不能为负数')
  }

  if (params.minOrderQty !== undefined && params.minOrderQty !== null && params.minOrderQty <= 0) {
    throw new Error('最小起订量必须大于 0')
  }

  if (params.validFrom && params.validTo && params.validFrom > params.validTo) {
    throw new Error('报价有效期起不能晚于有效期止')
  }

  const duplicate = detail.supplyMaterials.find(item => item.materialId === params.materialId && item.id !== params.id)
  if (duplicate) {
    throw new Error('该供应商已存在此物料报价，请直接编辑')
  }

  const id = params.id ?? Date.now()
  const material: SupplierMaterialItem = {
    id,
    supplierId: params.supplierId,
    materialId: params.materialId,
    materialCode: materialRef.code,
    materialName: materialRef.name,
    materialSpec: materialRef.spec,
    unitName: materialRef.unitName,
    supplyPrice: params.supplyPrice,
    currency: params.currency,
    leadDays: params.leadDays,
    minOrderQty: params.minOrderQty ?? null,
    isPreferred: params.isPreferred,
    validFrom: params.validFrom ?? null,
    validTo: params.validTo ?? null,
    lastPurchaseDate: null,
    remark: params.remark ?? null,
  }

  if (material.isPreferred) {
    detail.supplyMaterials = detail.supplyMaterials.map(item => (item.materialId === material.materialId ? { ...item, isPreferred: false } : item))
  }

  const index = detail.supplyMaterials.findIndex(item => item.id === id)
  if (index >= 0) {
    detail.supplyMaterials[index] = material
  } else {
    detail.supplyMaterials.unshift(material)
  }

  return id
}

export async function deleteSupplierMaterial(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_supplier_material', { id })
  }

  Object.values(MOCK_SUPPLIER_DETAILS).forEach(detail => {
    detail.supplyMaterials = detail.supplyMaterials.filter(item => item.id !== id)
  })
}

// ================================================================
// 客户管理命令
// ================================================================

/** 客户列表项（对应 Rust CustomerListItem） */
export interface CustomerListItem {
  id: number
  code: string
  name: string
  customerType: string
  country: string
  contactPerson: string | null
  contactPhone: string | null
  grade: string
  currency: string
  receivableBalance: number
  isEnabled: boolean
}

/** 客户保存参数（对应 Rust SaveCustomerParams） */
export interface SaveCustomerParams {
  id?: number | null
  code: string
  name: string
  customerType: string
  country: string
  contactPerson?: string | null
  contactPhone?: string | null
  email?: string | null
  shippingAddress?: string | null
  currency: string
  creditLimit: number
  settlementType: string
  creditDays: number
  grade: string
  defaultDiscount: number
  remark?: string | null
  isEnabled: boolean
}

/** 客户筛选参数 */
export interface CustomerFilter {
  keyword?: string
  customerType?: string
  grade?: string
  country?: string
  page: number
  pageSize: number
}

/** 销售记录摘要 */
export interface CustomerSalesRecord {
  id: number
  orderNo: string
  orderDate: string
  status: string
  currency: 'VND' | 'CNY' | 'USD'
  totalAmount: number
}

/** 应收记录 */
export interface CustomerReceivableRecord {
  id: number
  orderNo: string | null
  receivableDate: string
  dueDate: string | null
  currency: 'VND' | 'CNY' | 'USD'
  receivableAmount: number
  receivedAmount: number
  unpaidAmount: number
  status: 'unpaid' | 'partial' | 'paid'
}

/** 应收摘要 */
export interface CustomerReceivablesSummary {
  totalUnpaidAmount: number
  overdueCount: number
  openCount: number
  records: CustomerReceivableRecord[]
}

/** 客户详情响应 */
export interface CustomerDetailResponse {
  customer: SaveCustomerParams
  recentSalesOrders: CustomerSalesRecord[]
  receivablesSummary: CustomerReceivablesSummary
}

/** Mock 客户数据（Web 调试模式） */
const MOCK_CUSTOMERS: CustomerListItem[] = [
  {
    id: 1,
    code: 'CUS-2025-001',
    name: 'Công ty Nội thất Phú Mỹ',
    customerType: 'dealer',
    country: 'VN',
    contactPerson: 'Lê Văn Hùng',
    contactPhone: '+84 28-3456-7890',
    grade: 'vip',
    currency: 'VND',
    receivableBalance: 45000000,
    isEnabled: true,
  },
  {
    id: 2,
    code: 'CUS-2025-002',
    name: '广州市美居家具贸易有限公司',
    customerType: 'export',
    country: 'CN',
    contactPerson: '王建国',
    contactPhone: '+86 20-8888-6666',
    grade: 'vip',
    currency: 'CNY',
    receivableBalance: 1280000,
    isEnabled: true,
  },
  {
    id: 3,
    code: 'CUS-2025-003',
    name: 'Pacific Home Furnishings LLC',
    customerType: 'export',
    country: 'US',
    contactPerson: 'John Smith',
    contactPhone: '+1 310-555-0199',
    grade: 'normal',
    currency: 'USD',
    receivableBalance: 58000,
    isEnabled: true,
  },
  {
    id: 4,
    code: 'CUS-2025-004',
    name: 'Chị Nguyễn Thị Mai',
    customerType: 'retail',
    country: 'VN',
    contactPerson: 'Nguyễn Thị Mai',
    contactPhone: '+84 90-123-4567',
    grade: 'new',
    currency: 'VND',
    receivableBalance: 0,
    isEnabled: true,
  },
  {
    id: 5,
    code: 'CUS-2025-005',
    name: 'Dự án Khách sạn Sunrise',
    customerType: 'project',
    country: 'VN',
    contactPerson: 'Trần Minh Đức',
    contactPhone: '+84 28-7777-8888',
    grade: 'normal',
    currency: 'VND',
    receivableBalance: 120000000,
    isEnabled: true,
  },
  {
    id: 6,
    code: 'CUS-2025-006',
    name: 'EuroDesign GmbH',
    customerType: 'export',
    country: 'EU',
    contactPerson: 'Hans Müller',
    contactPhone: '+49 30-1234-5678',
    grade: 'normal',
    currency: 'USD',
    receivableBalance: 32000,
    isEnabled: false,
  },
  {
    id: 7,
    code: 'CUS-2025-007',
    name: 'Cửa hàng Gỗ Việt',
    customerType: 'dealer',
    country: 'VN',
    contactPerson: 'Phạm Quốc Bảo',
    contactPhone: '+84 236-123-4567',
    grade: 'new',
    currency: 'VND',
    receivableBalance: 8500000,
    isEnabled: true,
  },
]

/** Mock 客户详情（Web 调试模式） */
const MOCK_CUSTOMER_DETAILS: Record<number, CustomerDetailResponse> = {
  1: {
    customer: {
      id: 1,
      code: 'CUS-2025-001',
      name: 'Công ty Nội thất Phú Mỹ',
      customerType: 'dealer',
      country: 'VN',
      contactPerson: 'Lê Văn Hùng',
      contactPhone: '+84 28-3456-7890',
      email: 'hung@phumyfurniture.vn',
      shippingAddress: '456 Nguyễn Văn Linh, Quận 7, TP.HCM',
      currency: 'VND',
      creditLimit: 100000000,
      settlementType: 'monthly',
      creditDays: 30,
      grade: 'vip',
      defaultDiscount: 5,
      remark: '长期合作经销商，信誉良好',
      isEnabled: true,
    },
    recentSalesOrders: [
      { id: 301, orderNo: 'SO-20260415-001', orderDate: '2026-04-15', status: 'approved', currency: 'VND', totalAmount: 25000000 },
      { id: 302, orderNo: 'SO-20260408-003', orderDate: '2026-04-08', status: 'completed', currency: 'VND', totalAmount: 18500000 },
      { id: 303, orderNo: 'SO-20260325-002', orderDate: '2026-03-25', status: 'completed', currency: 'VND', totalAmount: 32000000 },
    ],
    receivablesSummary: {
      totalUnpaidAmount: 45000000,
      overdueCount: 1,
      openCount: 2,
      records: [
        {
          id: 401,
          orderNo: 'SO-20260415-001',
          receivableDate: '2026-04-15',
          dueDate: '2026-05-15',
          currency: 'VND',
          receivableAmount: 25000000,
          receivedAmount: 0,
          unpaidAmount: 25000000,
          status: 'unpaid',
        },
        {
          id: 402,
          orderNo: 'SO-20260408-003',
          receivableDate: '2026-04-08',
          dueDate: '2026-04-20',
          currency: 'VND',
          receivableAmount: 18500000,
          receivedAmount: 0,
          unpaidAmount: 18500000,
          status: 'unpaid',
        },
        {
          id: 403,
          orderNo: 'SO-20260325-002',
          receivableDate: '2026-03-25',
          dueDate: '2026-04-10',
          currency: 'VND',
          receivableAmount: 32000000,
          receivedAmount: 30500000,
          unpaidAmount: 1500000,
          status: 'partial',
        },
      ],
    },
  },
  2: {
    customer: {
      id: 2,
      code: 'CUS-2025-002',
      name: '广州市美居家具贸易有限公司',
      customerType: 'export',
      country: 'CN',
      contactPerson: '王建国',
      contactPhone: '+86 20-8888-6666',
      email: 'wang@meiju-trade.cn',
      shippingAddress: '广州市白云区太和镇永兴工业区 88 号',
      currency: 'CNY',
      creditLimit: 2000000,
      settlementType: 'quarterly',
      creditDays: 60,
      grade: 'vip',
      defaultDiscount: 8,
      remark: '中国出口大客户，季度结算',
      isEnabled: true,
    },
    recentSalesOrders: [
      { id: 304, orderNo: 'SO-20260410-005', orderDate: '2026-04-10', status: 'approved', currency: 'CNY', totalAmount: 680000 },
      { id: 305, orderNo: 'SO-20260320-008', orderDate: '2026-03-20', status: 'completed', currency: 'CNY', totalAmount: 520000 },
    ],
    receivablesSummary: {
      totalUnpaidAmount: 1280000,
      overdueCount: 0,
      openCount: 1,
      records: [
        {
          id: 404,
          orderNo: 'SO-20260410-005',
          receivableDate: '2026-04-10',
          dueDate: '2026-06-30',
          currency: 'CNY',
          receivableAmount: 680000,
          receivedAmount: 0,
          unpaidAmount: 680000,
          status: 'unpaid',
        },
        {
          id: 405,
          orderNo: 'SO-20260320-008',
          receivableDate: '2026-03-20',
          dueDate: '2026-06-30',
          currency: 'CNY',
          receivableAmount: 520000,
          receivedAmount: 0,
          unpaidAmount: 520000,
          status: 'unpaid',
        },
        {
          id: 406,
          orderNo: 'SO-20260115-012',
          receivableDate: '2026-01-15',
          dueDate: '2026-03-31',
          currency: 'CNY',
          receivableAmount: 450000,
          receivedAmount: 450000,
          unpaidAmount: 0,
          status: 'paid',
        },
      ],
    },
  },
}

/**
 * 查询客户列表（支持筛选 + 分页）
 *
 * Tauri 环境调用后端 IPC；web 调试模式返回 mock 数据。
 */
export async function getCustomers(filter: CustomerFilter): Promise<PaginatedResponse<CustomerListItem>> {
  if (isTauriEnv()) {
    return invoke<PaginatedResponse<CustomerListItem>>('get_customers', { filter })
  }

  // Web mock：客户端模拟筛选 + 分页
  let filtered = [...MOCK_CUSTOMERS].sort((left, right) => right.id - left.id)
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase()
    filtered = filtered.filter(
      customer =>
        customer.code.toLowerCase().includes(kw) || customer.name.toLowerCase().includes(kw) || customer.contactPerson?.toLowerCase().includes(kw),
    )
  }
  if (filter.customerType) {
    filtered = filtered.filter(c => c.customerType === filter.customerType)
  }
  if (filter.grade) {
    filtered = filtered.filter(c => c.grade === filter.grade)
  }
  if (filter.country) {
    filtered = filtered.filter(c => c.country === filter.country)
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
 * 获取客户详情（用于编辑表单）
 */
export async function getCustomerById(id: number): Promise<SaveCustomerParams> {
  if (isTauriEnv()) {
    return invoke<SaveCustomerParams>('get_customer_by_id', { id })
  }

  const found = MOCK_CUSTOMER_DETAILS[id]
  if (found) return structuredClone(found.customer)

  return {
    id,
    code: `CUS-${new Date().getFullYear()}-999`,
    name: '',
    customerType: 'dealer',
    country: 'VN',
    contactPerson: '',
    contactPhone: '',
    email: '',
    shippingAddress: '',
    currency: 'VND',
    creditLimit: 0,
    settlementType: 'cash',
    creditDays: 0,
    grade: 'normal',
    defaultDiscount: 0,
    remark: '',
    isEnabled: true,
  }
}

/**
 * 获取客户详情聚合（详情弹窗）
 */
export async function getCustomerDetail(id: number): Promise<CustomerDetailResponse> {
  if (isTauriEnv()) {
    return invoke<CustomerDetailResponse>('get_customer_detail', { id })
  }

  const detail = MOCK_CUSTOMER_DETAILS[id]
  if (detail) {
    return structuredClone(detail)
  }

  const customer = await getCustomerById(id)
  return {
    customer,
    recentSalesOrders: [],
    receivablesSummary: {
      totalUnpaidAmount: 0,
      overdueCount: 0,
      openCount: 0,
      records: [],
    },
  }
}

/**
 * 保存客户（新增或更新）
 *
 * @returns 客户 ID
 */
export async function saveCustomer(params: SaveCustomerParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_customer', { params })
  }

  const id = params.id ?? Date.now()
  const base = MOCK_CUSTOMER_DETAILS[id]
  const mergedCustomer: SaveCustomerParams = {
    ...(base?.customer ?? {}),
    ...params,
    id,
  }

  MOCK_CUSTOMER_DETAILS[id] = {
    customer: mergedCustomer,
    recentSalesOrders: base?.recentSalesOrders ?? [],
    receivablesSummary: base?.receivablesSummary ?? {
      totalUnpaidAmount: 0,
      overdueCount: 0,
      openCount: 0,
      records: [],
    },
  }

  const listIndex = MOCK_CUSTOMERS.findIndex(item => item.id === id)
  const listItem: CustomerListItem = {
    id,
    code: mergedCustomer.code,
    name: mergedCustomer.name,
    customerType: mergedCustomer.customerType,
    country: mergedCustomer.country,
    contactPerson: mergedCustomer.contactPerson ?? null,
    contactPhone: mergedCustomer.contactPhone ?? null,
    grade: mergedCustomer.grade,
    currency: mergedCustomer.currency,
    receivableBalance: MOCK_CUSTOMER_DETAILS[id].receivablesSummary.totalUnpaidAmount,
    isEnabled: mergedCustomer.isEnabled,
  }

  if (listIndex >= 0) {
    MOCK_CUSTOMERS[listIndex] = listItem
  } else {
    MOCK_CUSTOMERS.unshift(listItem)
  }

  return id
}

/**
 * 删除客户
 *
 * 检查是否有关联的销售或账款记录，有则拒绝删除。
 */
export async function deleteCustomer(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_customer', { id })
  }

  const detail = MOCK_CUSTOMER_DETAILS[id]
  if (detail && (detail.recentSalesOrders.length > 0 || detail.receivablesSummary.records.length > 0)) {
    throw new Error('该客户已有销售或账款记录，不能删除')
  }

  const listIndex = MOCK_CUSTOMERS.findIndex(item => item.id === id)
  if (listIndex >= 0) {
    MOCK_CUSTOMERS.splice(listIndex, 1)
  }
  delete MOCK_CUSTOMER_DETAILS[id]
}

/**
 * 切换客户启用/禁用状态
 */
export async function toggleCustomerStatus(id: number, isEnabled: boolean): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('toggle_customer_status', { id, is_enabled: isEnabled })
  }

  const listItem = MOCK_CUSTOMERS.find(item => item.id === id)
  if (listItem) {
    listItem.isEnabled = isEnabled
  }

  const detail = MOCK_CUSTOMER_DETAILS[id]
  if (detail) {
    detail.customer.isEnabled = isEnabled
  }
}

/**
 * 生成下一个客户编码
 */
export async function generateCustomerCode(): Promise<string> {
  if (isTauriEnv()) {
    return invoke<string>('generate_customer_code')
  }

  const year = new Date().getFullYear()
  const maxSeq = MOCK_CUSTOMERS.reduce((currentMax, customer) => {
    const match = customer.code.match(new RegExp(`^CUS-${year}-(\\d+)$`))
    if (!match) {
      return currentMax
    }
    return Math.max(currentMax, Number(match[1]))
  }, 0)
  const seq = String(maxSeq + 1).padStart(3, '0')
  return `CUS-${year}-${seq}`
}

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

// ================================================================
// 单位管理
// ================================================================

/** 单位记录（管理页面用，含全部字段） */
export interface UnitItem {
  id: number
  name: string
  name_en: string | null
  name_vi: string | null
  symbol: string | null
  decimal_places: number
  sort_order: number
  is_enabled: boolean
  created_at: string | null
  updated_at: string | null
}

/** 单位保存参数 */
export interface SaveUnitParams {
  id?: number | null
  name: string
  name_en?: string | null
  name_vi?: string | null
  symbol?: string | null
  decimal_places: number
  sort_order?: number
  is_enabled?: boolean
}

/** mock 单位数据 */
const MOCK_UNITS: UnitItem[] = [
  {
    id: 1,
    name: '张',
    name_en: 'sheet',
    name_vi: 'tấm',
    symbol: null,
    decimal_places: 0,
    sort_order: 1,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 2,
    name: '个',
    name_en: 'pcs',
    name_vi: 'cái',
    symbol: null,
    decimal_places: 0,
    sort_order: 2,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 3,
    name: '千克',
    name_en: 'kg',
    name_vi: 'kg',
    symbol: 'kg',
    decimal_places: 2,
    sort_order: 3,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 4,
    name: '米',
    name_en: 'm',
    name_vi: 'm',
    symbol: 'm',
    decimal_places: 2,
    sort_order: 4,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 5,
    name: '套',
    name_en: 'set',
    name_vi: 'bộ',
    symbol: null,
    decimal_places: 0,
    sort_order: 5,
    is_enabled: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

/** 获取全部单位列表（管理页面用） */
export async function getAllUnits(includeDisabled: boolean = true): Promise<UnitItem[]> {
  if (isTauriEnv()) {
    return invoke<UnitItem[]>('get_all_units', { includeDisabled })
  }
  if (includeDisabled) return [...MOCK_UNITS]
  return MOCK_UNITS.filter(u => u.is_enabled)
}

/** 获取单个单位 */
export async function getUnitById(id: number): Promise<UnitItem> {
  if (isTauriEnv()) {
    return invoke<UnitItem>('get_unit_by_id', { id })
  }
  const item = MOCK_UNITS.find(u => u.id === id)
  if (!item) throw new Error('单位不存在')
  return { ...item }
}

/** 保存单位（新增或更新） */
export async function saveUnit(params: SaveUnitParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_unit', { params })
  }
  return params.id ?? Date.now()
}

/** 删除单位 */
export async function deleteUnit(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('delete_unit', { id })
  }
}

/** 启用/禁用单位 */
export async function toggleUnitStatus(id: number): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('toggle_unit_status', { id })
  }
}

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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
}

/** 保存并确认采购退货 */
export async function saveAndConfirmPurchaseReturn(params: SavePurchaseReturnParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_and_confirm_purchase_return', { params })
  }
  return Date.now()
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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
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
  return { total: 0, items: [], page: filter.page, page_size: filter.pageSize }
}

/** 保存并确认销售退货 */
export async function saveAndConfirmSalesReturn(params: SaveSalesReturnParams): Promise<number> {
  if (isTauriEnv()) {
    return invoke<number>('save_and_confirm_sales_return', { params })
  }
  return Date.now()
}

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

// ================================================================
// 智能补货命令
// ================================================================

/** 补货建议项 */
export interface ReplenishmentSuggestion {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  category_name: string | null
  unit_name: string | null
  material_type: string
  physical_qty: number
  reserved_qty: number
  available_qty: number
  safety_stock: number
  gap_qty: number
  daily_consumption: number
  days_until_stockout: number
  suggested_qty: number
  supplier_id: number | null
  supplier_name: string | null
  ref_price: number | null
  ref_currency: string
  urgency: 'urgent' | 'warning' | 'normal'
  log_id: number | null
}

/** 补货建议筛选参数 */
export interface SuggestionFilter {
  urgency?: string
  category_id?: number
  keyword?: string
}

/** 补货策略配置项 */
export interface ReplenishmentRule {
  id: number
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  analysis_days: number
  lead_days: number
  safety_days: number
  batch_multiple: number
  preferred_supplier_id: number | null
  supplier_name: string | null
  is_enabled: boolean
}

/** 策略列表筛选参数 */
export interface RuleFilter {
  keyword?: string
  page: number
  page_size: number
}

/** 策略更新参数 */
export interface UpdateRuleParams {
  analysis_days: number
  lead_days: number
  safety_days: number
  batch_multiple: number
  preferred_supplier_id: number | null
  is_enabled: boolean
}

/** 消耗趋势数据点 */
export interface ConsumptionTrendPoint {
  date: string
  qty: number
}

/** 批量生成采购单结果 */
export interface BulkCreatePoResult {
  created_orders: number[]
  errors: string[]
}

/** 补齐缺失的补货策略规则 */
export async function ensureReplenishmentRules(): Promise<number> {
  if (!isTauriEnv()) return 0
  return invoke<number>('ensure_replenishment_rules')
}

/** 获取补货建议列表 */
export async function getReplenishmentSuggestions(filter: SuggestionFilter): Promise<ReplenishmentSuggestion[]> {
  if (!isTauriEnv()) return []
  return invoke<ReplenishmentSuggestion[]>('get_replenishment_suggestions', { filter })
}

/** 获取补货策略配置列表 */
export async function getReplenishmentRules(filter: RuleFilter): Promise<PaginatedResponse<ReplenishmentRule>> {
  if (!isTauriEnv()) return { total: 0, items: [], page: 1, page_size: 20 }
  return invoke<PaginatedResponse<ReplenishmentRule>>('get_replenishment_rules', { filter })
}

/** 更新补货策略配置 */
export async function updateReplenishmentRule(id: number, params: UpdateRuleParams): Promise<void> {
  if (!isTauriEnv()) return
  return invoke<void>('update_replenishment_rule', { id, params })
}

/** 获取消耗趋势数据 */
export async function getConsumptionTrend(materialId: number, days: number): Promise<ConsumptionTrendPoint[]> {
  if (!isTauriEnv()) return []
  return invoke<ConsumptionTrendPoint[]>('get_consumption_trend', { materialId, days })
}

/** 一键生成采购单 */
export async function createPurchaseOrdersFromSuggestions(materialIds: number[], userId?: number, userName?: string): Promise<BulkCreatePoResult> {
  if (!isTauriEnv()) return { created_orders: [], errors: ['仅 Tauri 环境可用'] }
  return invoke<BulkCreatePoResult>('create_purchase_orders_from_suggestions', {
    materialIds,
    userId: userId ?? null,
    userName: userName ?? null,
  })
}

/** 忽略补货建议 */
export async function ignoreSuggestion(logId: number): Promise<void> {
  if (!isTauriEnv()) return
  return invoke<void>('ignore_suggestion', { logId })
}

// ================================================================
// 财务管理命令
// ================================================================

/** 应付账款概览 KPI */
export interface PayablesSummary {
  total_payable: number
  total_paid: number
  total_partial: number
  total_overdue: number
}

/** 应付账款列表项 */
export interface PayableListItem {
  id: number
  supplier_id: number
  supplier_name: string
  inbound_id: number | null
  return_id: number | null
  adjustment_type: string
  order_no: string | null
  payable_date: string
  currency: string
  exchange_rate: number
  payable_amount: number
  paid_amount: number
  unpaid_amount: number
  due_date: string | null
  status: string
  remark: string | null
  created_at: string | null
}

/** 应付账款列表响应 */
export interface PayablesResponse {
  summary: PayablesSummary
  list: PaginatedResponse<PayableListItem>
}

/** 应付账款筛选参数 */
export interface PayablesFilter {
  keyword?: string
  supplier_id?: number
  status?: string
  date_from?: string
  date_to?: string
  page: number
  page_size: number
}

/** 付款记录项 */
export interface PaymentRecordItem {
  id: number
  payable_id: number
  payment_date: string
  payment_amount: number
  currency: string
  payment_method: string | null
  remark: string | null
  created_at: string | null
}

/** 登记付款参数 */
export interface RecordPaymentParams {
  payable_id: number
  payment_date: string
  payment_amount: number
  payment_method?: string | null
  remark?: string | null
}

/** 应收账款概览 KPI */
export interface ReceivablesSummary {
  total_receivable: number
  total_received: number
  total_partial: number
  total_overdue: number
}

/** 应收账款列表项 */
export interface ReceivableListItem {
  id: number
  customer_id: number
  customer_name: string
  outbound_id: number | null
  return_id: number | null
  adjustment_type: string
  order_no: string | null
  receivable_date: string
  currency: string
  exchange_rate: number
  receivable_amount: number
  received_amount: number
  unreceived_amount: number
  due_date: string | null
  status: string
  remark: string | null
  created_at: string | null
}

/** 应收账款列表响应 */
export interface ReceivablesResponse {
  summary: ReceivablesSummary
  list: PaginatedResponse<ReceivableListItem>
}

/** 应收账款筛选参数 */
export interface ReceivablesFilter {
  keyword?: string
  customer_id?: number
  status?: string
  date_from?: string
  date_to?: string
  page: number
  page_size: number
}

/** 收款记录项 */
export interface ReceiptRecordItem {
  id: number
  receivable_id: number
  receipt_date: string
  receipt_amount: number
  currency: string
  receipt_method: string | null
  remark: string | null
  created_at: string | null
}

/** 登记收款参数 */
export interface RecordReceiptParams {
  receivable_id: number
  receipt_date: string
  receipt_amount: number
  receipt_method?: string | null
  remark?: string | null
}

// ---- 应付账款 ----

/** 获取应付账款列表（含 KPI 概览） */
export async function getPayables(filter: PayablesFilter): Promise<PayablesResponse> {
  if (!isTauriEnv()) {
    return {
      summary: { total_payable: 0, total_paid: 0, total_partial: 0, total_overdue: 0 },
      list: { total: 0, items: [], page: filter.page, page_size: filter.page_size },
    }
  }
  return invoke<PayablesResponse>('get_payables', { filter })
}

/** 获取指定应付的付款记录 */
export async function getPaymentRecords(payableId: number): Promise<PaymentRecordItem[]> {
  if (!isTauriEnv()) return []
  return invoke<PaymentRecordItem[]>('get_payment_records', { payableId })
}

/** 登记付款 */
export async function recordPayment(params: RecordPaymentParams): Promise<number> {
  return invoke<number>('record_payment', { params })
}

// ---- 应收账款 ----

/** 获取应收账款列表（含 KPI 概览） */
export async function getReceivables(filter: ReceivablesFilter): Promise<ReceivablesResponse> {
  if (!isTauriEnv()) {
    return {
      summary: { total_receivable: 0, total_received: 0, total_partial: 0, total_overdue: 0 },
      list: { total: 0, items: [], page: filter.page, page_size: filter.page_size },
    }
  }
  return invoke<ReceivablesResponse>('get_receivables', { filter })
}

/** 获取指定应收的收款记录 */
export async function getReceiptRecords(receivableId: number): Promise<ReceiptRecordItem[]> {
  if (!isTauriEnv()) return []
  return invoke<ReceiptRecordItem[]>('get_receipt_records', { receivableId })
}

/** 登记收款 */
export async function recordReceipt(params: RecordReceiptParams): Promise<number> {
  return invoke<number>('record_receipt', { params })
}

// ================================================================
// 报表中心命令
// ================================================================

/** 收发存汇总项 */
export interface InventoryReportItem {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  category_name: string | null
  unit_name: string | null
  opening_qty: number
  opening_value: number
  inbound_qty: number
  inbound_value: number
  outbound_qty: number
  outbound_value: number
  closing_qty: number
  closing_value: number
}

/** 报表 KPI 统计 */
export interface ReportStats {
  opening_value: number
  inbound_value: number
  outbound_value: number
  closing_value: number
}

/** 库存报表响应 */
export interface InventoryReportResponse {
  generated_at: string
  stats: ReportStats
  items: InventoryReportItem[]
  total: number
  page: number
  page_size: number
}

/** 库龄分析项 */
export interface InventoryAgingItem {
  material_id: number
  material_code: string
  material_name: string
  lot_no: string
  received_date: string
  days_in_stock: number
  qty_on_hand: number
  unit_cost: number
  value: number
}

/** 滞销预警项 */
export interface InventorySlowMovingItem {
  material_id: number
  material_code: string
  material_name: string
  category_name: string | null
  current_qty: number
  last_out_date: string | null
  days_since_last_out: number
  avg_monthly_outbound: number
}

/** 库存趋势数据点 */
export interface InventoryTrendPoint {
  date: string
  total_qty: number
  total_value: number
}

/** 库存趋势响应 */
export interface InventoryTrendResponse {
  generated_at: string
  points: InventoryTrendPoint[]
}

/** 收发存筛选条件 */
export interface InventoryReportFilter {
  start_date?: string | null
  end_date?: string | null
  warehouse_id?: number | null
  category_id?: number | null
  material_type?: string | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 库龄筛选 */
export interface AgingFilter {
  warehouse_id?: number | null
  category_id?: number | null
  min_days?: number | null
  max_days?: number | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 滞销筛选 */
export interface SlowMovingFilter {
  days_threshold: number
  warehouse_id?: number | null
  category_id?: number | null
  page: number
  page_size: number
}

/** 趋势筛选 */
export interface TrendFilter {
  days?: number | null
  warehouse_id?: number | null
}

/** 采购报表筛选 */
export interface PurchaseReportFilter {
  start_date?: string | null
  end_date?: string | null
  supplier_id?: number | null
  warehouse_id?: number | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 销售报表筛选 */
export interface SalesReportFilter {
  start_date?: string | null
  end_date?: string | null
  customer_id?: number | null
  warehouse_id?: number | null
  keyword?: string | null
  page: number
  page_size: number
}

/** 业务报表 KPI */
export interface BusinessReportStats {
  total_amount: number
  order_count: number
  partner_count: number
  material_count: number
}

/** 业务报表趋势点 */
export interface BusinessTrendPoint {
  date: string
  amount: number
  order_count: number
}

/** 往来单位排行项 */
export interface PartnerRankItem {
  partner_id: number
  partner_code: string
  partner_name: string
  amount: number
  order_count: number
  ratio: number
}

/** 物料报表明细项 */
export interface MaterialReportItem {
  material_id: number
  material_code: string
  material_name: string
  spec: string | null
  unit_name: string
  quantity: number
  amount: number
  avg_price: number
}

/** 业务报表响应 */
export interface BusinessReportResponse<T> {
  generated_at: string
  stats: BusinessReportStats
  trend: BusinessTrendPoint[]
  items: T[]
  total: number
  page: number
  page_size: number
}

// ---- 报表查询 ----

/** 获取库存收发存汇总 */
export async function getInventoryReportSummary(filter: InventoryReportFilter): Promise<InventoryReportResponse> {
  if (!isTauriEnv()) {
    return {
      generated_at: new Date().toISOString(),
      stats: { opening_value: 0, inbound_value: 0, outbound_value: 0, closing_value: 0 },
      items: [],
      total: 0,
      page: filter.page,
      page_size: filter.page_size,
    }
  }
  return invoke<InventoryReportResponse>('get_inventory_report_summary', { filter })
}

/** 获取库龄分析 */
export async function getInventoryAgingAnalysis(filter: AgingFilter): Promise<PaginatedResponse<InventoryAgingItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, page_size: filter.page_size }
  }
  return invoke<PaginatedResponse<InventoryAgingItem>>('get_inventory_aging_analysis', { filter })
}

/** 获取滞销预警 */
export async function getInventorySlowMoving(filter: SlowMovingFilter): Promise<PaginatedResponse<InventorySlowMovingItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, page_size: filter.page_size }
  }
  return invoke<PaginatedResponse<InventorySlowMovingItem>>('get_inventory_slow_moving', { filter })
}

/** 获取库存趋势 */
export async function getInventoryTrend(filter: TrendFilter): Promise<InventoryTrendResponse> {
  if (!isTauriEnv()) {
    return { generated_at: new Date().toISOString(), points: [] }
  }
  return invoke<InventoryTrendResponse>('get_inventory_trend', { filter })
}

function emptyBusinessReport<T>(page: number, pageSize: number): BusinessReportResponse<T> {
  return {
    generated_at: new Date().toISOString(),
    stats: { total_amount: 0, order_count: 0, partner_count: 0, material_count: 0 },
    trend: [],
    items: [],
    total: 0,
    page,
    page_size: pageSize,
  }
}

/** 获取采购汇总趋势 */
export async function getPurchaseReportSummary(filter: PurchaseReportFilter): Promise<BusinessReportResponse<BusinessTrendPoint>> {
  if (!isTauriEnv()) return emptyBusinessReport<BusinessTrendPoint>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<BusinessTrendPoint>>('get_purchase_report_summary', { filter })
}

/** 获取供应商采购排行 */
export async function getPurchaseSupplierRanking(filter: PurchaseReportFilter): Promise<BusinessReportResponse<PartnerRankItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<PartnerRankItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<PartnerRankItem>>('get_purchase_supplier_ranking', { filter })
}

/** 获取采购物料明细 */
export async function getPurchaseMaterialDetail(filter: PurchaseReportFilter): Promise<BusinessReportResponse<MaterialReportItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<MaterialReportItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<MaterialReportItem>>('get_purchase_material_detail', { filter })
}

/** 获取销售汇总趋势 */
export async function getSalesReportSummary(filter: SalesReportFilter): Promise<BusinessReportResponse<BusinessTrendPoint>> {
  if (!isTauriEnv()) return emptyBusinessReport<BusinessTrendPoint>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<BusinessTrendPoint>>('get_sales_report_summary', { filter })
}

/** 获取客户销售排行 */
export async function getSalesCustomerRanking(filter: SalesReportFilter): Promise<BusinessReportResponse<PartnerRankItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<PartnerRankItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<PartnerRankItem>>('get_sales_customer_ranking', { filter })
}

/** 获取销售物料明细 */
export async function getSalesMaterialDetail(filter: SalesReportFilter): Promise<BusinessReportResponse<MaterialReportItem>> {
  if (!isTauriEnv()) return emptyBusinessReport<MaterialReportItem>(filter.page, filter.page_size)
  return invoke<BusinessReportResponse<MaterialReportItem>>('get_sales_material_detail', { filter })
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

// ================================================================
// 操作日志命令
// ================================================================

/** 操作日志项 */
export interface OperationLogItem {
  id: number
  module: string
  action: string
  target_type: string | null
  target_id: number | null
  target_no: string | null
  detail: string
  operator_user_id: number | null
  operator_name: string | null
  created_at: string
}

/** 操作日志筛选参数 */
export interface OperationLogFilter {
  module?: string | null
  action?: string | null
  operator_user_id?: number | null
  date_from?: string | null
  date_to?: string | null
  page: number
  page_size: number
}

/** 查询操作日志列表 */
export async function getOperationLogs(filter: OperationLogFilter): Promise<PaginatedResponse<OperationLogItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, page_size: filter.page_size }
  }
  return invoke<PaginatedResponse<OperationLogItem>>('get_operation_logs', { filter })
}
