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
  targetType: string | null
  targetId: number | null
  targetNo: string | null
  detail: string
  operatorUserId: number | null
  operatorName: string | null
  createdAt: string
}

/** 操作日志筛选参数 */
export interface OperationLogFilter {
  module?: string | null
  action?: string | null
  operatorUserId?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  page: number
  pageSize: number
}

/** 查询操作日志列表 */
export async function getOperationLogs(filter: OperationLogFilter): Promise<PaginatedResponse<OperationLogItem>> {
  if (!isTauriEnv()) {
    return { total: 0, items: [], page: filter.page, pageSize: filter.pageSize }
  }
  return invoke<PaginatedResponse<OperationLogItem>>('get_operation_logs', { filter })
}
