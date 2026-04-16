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
