import type { LoginResponse, UserInfo } from './core'
import { invoke, isTauriEnv } from './core'

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
    request: { userId, newPassword },
  })
}

/** 获取用户信息 */
export async function getUserInfo(userId: number): Promise<UserInfo> {
  return invoke<UserInfo>('get_user_info', { userId })
}

/** 认证数据在 localStorage 中的存储键（Web 调试模式降级用） */
const AUTH_STORAGE_KEY = 'cloudpivot_auth'

/** 保存认证会话（Tauri 环境写入应用数据目录，Web 调试模式写入 localStorage） */
export async function saveAuthSession(data: string): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('save_auth_keychain', { data })
  }
  localStorage.setItem(AUTH_STORAGE_KEY, data)
}

/** 读取认证会话 */
export async function readAuthSession(): Promise<string | null> {
  if (isTauriEnv()) {
    return invoke<string | null>('read_auth_keychain')
  }
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

/** 清除认证会话 */
export async function clearAuthSession(): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('clear_auth_keychain')
  }
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

// 兼容旧调用名：底层 IPC 名称暂不变，但语义已降级为认证会话文件。
export const saveAuthKeychain = saveAuthSession
export const readAuthKeychain = readAuthSession
export const clearAuthKeychain = clearAuthSession
