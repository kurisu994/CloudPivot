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

/** 保存认证信息到系统钥匙串（Tauri 环境）或 localStorage（Web 调试模式） */
export async function saveAuthKeychain(data: string): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('save_auth_keychain', { data })
  }
  localStorage.setItem(AUTH_STORAGE_KEY, data)
}

/** 从系统钥匙串读取认证信息 */
export async function readAuthKeychain(): Promise<string | null> {
  if (isTauriEnv()) {
    return invoke<string | null>('read_auth_keychain')
  }
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

/** 清除系统钥匙串中的认证信息 */
export async function clearAuthKeychain(): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('clear_auth_keychain')
  }
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
