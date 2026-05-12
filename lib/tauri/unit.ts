import { invoke, isTauriEnv } from './core'

// ================================================================
// 单位管理
// ================================================================

/** 单位记录（管理页面用，含全部字段） */
export interface UnitItem {
  id: number
  name: string
  nameEn: string | null
  nameVi: string | null
  symbol: string | null
  decimalPlaces: number
  sortOrder: number
  isEnabled: boolean
  createdAt: string | null
  updatedAt: string | null
}

/** 单位保存参数 */
export interface SaveUnitParams {
  id?: number | null
  name: string
  nameEn?: string | null
  nameVi?: string | null
  symbol?: string | null
  decimalPlaces: number
  sortOrder?: number
  isEnabled?: boolean
}

/** mock 单位数据 */
const MOCK_UNITS: UnitItem[] = [
  {
    id: 1,
    name: '张',
    nameEn: 'sheet',
    nameVi: 'tấm',
    symbol: null,
    decimalPlaces: 0,
    sortOrder: 1,
    isEnabled: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 2,
    name: '个',
    nameEn: 'pcs',
    nameVi: 'cái',
    symbol: null,
    decimalPlaces: 0,
    sortOrder: 2,
    isEnabled: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 3,
    name: '千克',
    nameEn: 'kg',
    nameVi: 'kg',
    symbol: 'kg',
    decimalPlaces: 2,
    sortOrder: 3,
    isEnabled: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 4,
    name: '米',
    nameEn: 'm',
    nameVi: 'm',
    symbol: 'm',
    decimalPlaces: 2,
    sortOrder: 4,
    isEnabled: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 5,
    name: '套',
    nameEn: 'set',
    nameVi: 'bộ',
    symbol: null,
    decimalPlaces: 0,
    sortOrder: 5,
    isEnabled: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
]

/** 获取全部单位列表（管理页面用） */
export async function getAllUnits(includeDisabled: boolean = true): Promise<UnitItem[]> {
  if (isTauriEnv()) {
    return invoke<UnitItem[]>('get_all_units', { includeDisabled })
  }
  if (includeDisabled) return [...MOCK_UNITS]
  return MOCK_UNITS.filter(u => u.isEnabled)
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
