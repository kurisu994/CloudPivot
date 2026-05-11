import { invoke, isTauriEnv } from './core'

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
