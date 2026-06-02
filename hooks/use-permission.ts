/**
 * 权限检查 Hook
 *
 * 基于 AuthProvider 的权限缓存，提供便捷的权限检查方法。
 */

import { useAuth } from '@/components/providers/auth-provider'

/** 权限检查 Hook */
export function usePermission() {
  const { hasPermission, user } = useAuth()

  return {
    /** 是否为管理员 */
    isAdmin: user?.role === 'admin',
    /** 是否为查看者（只读角色） */
    isViewer: user?.role === 'viewer',
    /** 检查是否有指定权限 */
    can: (module: string, action: string) => hasPermission(module, action),
    /** 检查是否能访问指定模块 */
    canAccess: (module: string) => hasPermission(module, 'view'),
  }
}
