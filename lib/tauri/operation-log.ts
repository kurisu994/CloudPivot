import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

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
