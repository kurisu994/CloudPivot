/**
 * 打印模板 key → datasource 映射注册表
 *
 * v1 仅 manual_stock_movement 接入；后续模板按相同模式 register 即可。
 */

import type { PrintTemplateKey } from '@/lib/tauri/print-template'
import { manualStockMovementDatasource } from './datasources/manual-stock-movement'
import type { PrintDatasource } from './types'

/** key → datasource 映射 */
const REGISTRY: Partial<Record<PrintTemplateKey, PrintDatasource<unknown>>> = {
  manual_stock_movement: manualStockMovementDatasource as PrintDatasource<unknown>,
}

/** 取指定 key 的 datasource，未注册返回 null（前端应优雅降级） */
export function getDatasource(key: PrintTemplateKey): PrintDatasource<unknown> | null {
  return REGISTRY[key] ?? null
}

/** 已注册的全部 key */
export function getRegisteredKeys(): PrintTemplateKey[] {
  return Object.keys(REGISTRY) as PrintTemplateKey[]
}
