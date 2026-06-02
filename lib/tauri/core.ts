import type { AppErrorResponse } from '../error'

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
  role: 'admin' | 'operator' | 'viewer'
  role_id: number
  must_change_password: boolean
  session_version: number
}

/** 权限项 */
export interface PermissionItem {
  module: string
  action: string
}

/** 登录响应 */
export interface LoginResponse {
  user: UserInfo
  must_change_password: boolean
  permissions: PermissionItem[]
}

/** 分页响应（通用，对应 Rust PaginatedResponse<T>） */
export interface PaginatedResponse<T> {
  total: number
  items: T[]
  page: number
  pageSize: number
}

// ================================================================
// 底层通信
// ================================================================

/**
 * 判断是否运行在 Tauri 环境中
 */
export function isTauriEnv(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const tauriGlobal = globalThis as typeof globalThis & {
    isTauri?: boolean
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: { invoke?: unknown }
  }

  return tauriGlobal.isTauri === true || typeof tauriGlobal.__TAURI_INTERNALS__?.invoke === 'function' || '__TAURI__' in tauriGlobal
}

/**
 * 调用 Tauri IPC 命令
 *
 * @param command - 命令名称（对应 Rust #[tauri::command] 函数名）
 * @param args - 传递给命令的参数
 * @returns 命令返回值
 */
/** 认证失效处理器：由 AuthProvider 注册，IPC 返回 AUTH 错误时触发（清会话并跳登录页） */
type AuthErrorHandler = () => void
let authErrorHandler: AuthErrorHandler | null = null

/** 注册认证失效处理器（AuthProvider 挂载时调用，卸载时传 null 注销） */
export function setAuthErrorHandler(handler: AuthErrorHandler | null): void {
  authErrorHandler = handler
}

/** 这些命令本身就是凭证操作，其 AUTH 失败（密码错误/会话校验）不应触发"跳登录页" */
const AUTH_REDIRECT_EXCLUDED = new Set(['login', 'change_password', 'restore_session'])

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
      'get_roles',
      'get_current_user_permissions',
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
        return { total: 0, items: [], page: 1, pageSize: 10 } as unknown as T
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
  try {
    return await tauriInvoke<T>(command, args)
  } catch (error: unknown) {
    // Tauri 2 将后端 Err 序列化后作为 rejected value 传递
    // 新的结构化格式为 { code, message, details? }
    // 直接抛出，前端使用 getErrorMessage() 解析
    console.error(`[Tauri IPC] 命令 "${command}" 调用失败:`, error)
    // 认证失效（后端 require_auth 拒绝，code=AUTH）：通知上层清会话并跳转登录页。
    // 排除登录/改密/恢复会话等凭证命令，避免输错密码也被踢到登录页。
    if (authErrorHandler && !AUTH_REDIRECT_EXCLUDED.has(command) && (error as AppErrorResponse | null)?.code === 'AUTH') {
      authErrorHandler()
    }
    throw error as AppErrorResponse
  }
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
