/**
 * 权限检查 Hook
 *
 * 基于 AuthProvider 的权限缓存，提供便捷的权限检查方法。
 */

import { useAuth } from '@/components/providers/auth-provider'
import { userHasRole } from '@/lib/tauri'

/** 权限检查 Hook */
export function usePermission() {
  const { hasPermission, user } = useAuth()

  return {
    /** 是否持有管理员角色（多角色下任一角色为 admin 即成立） */
    isAdmin: userHasRole(user, 'admin'),
    /** 检查是否有指定权限 */
    can: (module: string, action: string) => hasPermission(module, action),
    /** 检查是否能访问指定模块 */
    canAccess: (module: string) => hasPermission(module, 'view'),
  }
}
