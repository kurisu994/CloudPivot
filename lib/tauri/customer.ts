import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

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
