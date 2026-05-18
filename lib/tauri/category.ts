import { invoke, isTauriEnv } from './core'

// ================================================================
// 分类管理命令
// ================================================================

/** 分类树节点（扁平结构，前端组装层级） */
export interface CategoryNode {
  id: number
  parentId: number | null
  name: string
  code: string
  sortOrder: number
  level: number
  path: string | null
  remark: string | null
  isEnabled: boolean
  createdAt: string | null
  updatedAt: string | null
}

/** 创建分类参数 */
export interface CreateCategoryParams {
  name: string
  parentId?: number | null
  sortOrder?: number
  remark?: string
}

/** 更新分类参数 */
export interface UpdateCategoryParams {
  id: number
  name: string
  parentId?: number | null
  sortOrder?: number
  remark?: string
}

/** 排序项 */
export interface CategorySortItem {
  id: number
  parentId: number | null
  sortOrder: number
}

/** Mock 分类数据（Web 调试模式） */
const MOCK_CATEGORIES: CategoryNode[] = [
  {
    id: 1,
    parentId: null,
    name: '木材',
    code: 'CAT-WOOD',
    sortOrder: 0,
    level: 1,
    path: '1',
    remark: null,
    isEnabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 2,
    parentId: 1,
    name: '实木板材',
    code: 'CAT-SOLID',
    sortOrder: 0,
    level: 2,
    path: '1/2',
    remark: null,
    isEnabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 3,
    parentId: 1,
    name: '人造板材',
    code: 'CAT-MAN',
    sortOrder: 1,
    level: 2,
    path: '1/3',
    remark: null,
    isEnabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 4,
    parentId: null,
    name: '五金配件',
    code: 'CAT-HARDWARE',
    sortOrder: 1,
    level: 1,
    path: '4',
    remark: null,
    isEnabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 5,
    parentId: 4,
    name: '铰链/合页',
    code: 'CAT-HINGE',
    sortOrder: 0,
    level: 2,
    path: '4/5',
    remark: null,
    isEnabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 6,
    parentId: null,
    name: '成品家具',
    code: 'CAT-FINISHED',
    sortOrder: 2,
    level: 1,
    path: '6',
    remark: null,
    isEnabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
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
