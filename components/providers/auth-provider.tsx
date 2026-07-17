'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SplashScreen } from '@/components/common/splash-screen'
import { usePathname, useRouter } from '@/i18n/navigation'
import { getErrorMessage } from '@/lib/error'
import { initLogger } from '@/lib/logger'
import * as tauriApi from '@/lib/tauri'
import { isTauriEnv, type UserInfo, userHasRole } from '@/lib/tauri'
import { SystemConfigKeys } from '@/lib/types/system-config'

/** 认证状态 */
interface AuthState {
  /** 当前登录用户 */
  user: UserInfo | null
  /** 是否正在加载认证状态 */
  isLoading: boolean
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 是否需要完成向导 */
  needsSetup: boolean
  /** 权限缓存（格式 module:action） */
  permissions: Set<string>
}

/** 认证上下文接口 */
interface AuthContextValue extends AuthState {
  /** 登录（rememberMe=true 时持久化会话，7天未使用过期） */
  login: (username: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  /** 修改密码 */
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  /** 登出 */
  logout: () => void
  /** 完成向导 */
  completeSetup: () => void
  /** 检查是否有指定权限 */
  hasPermission: (module: string, action: string) => boolean
}

/** 登录结果 */
interface LoginResult {
  success: boolean
  mustChangePassword: boolean
  error?: string
}

/** 认证数据持久化结构 */
interface AuthStorage {
  userId: number
  sessionVersion: number
  /** 会话过期时间（Unix 时间戳 ms），超过此时间需重新登录 */
  expiresAt: number
  /** 是否为"记住我"会话 */
  rememberMe: boolean
}

/** "记住我"会话有效期：7天（毫秒） */
const REMEMBER_ME_DURATION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 模块级认证状态缓存
 *
 * 解决 locale 切换时 AuthProvider 重新挂载导致状态丢失的问题。
 * 组件重新挂载时可从此缓存同步恢复，避免异步 gap 期间路由守卫误判。
 */
let cachedUser: UserInfo | null = null
let cachedNeedsSetup = false
let cachedPermissions: Set<string> = new Set()
let authInitialized = false

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * 认证 Provider
 *
 * 提供全局认证状态管理、路由守卫和会话持久化。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // 如果模块缓存中有认证状态（locale 切换重新挂载），同步恢复，跳过异步加载
  const [user, setUser] = useState<UserInfo | null>(cachedUser)
  const [isLoading, setIsLoading] = useState(!authInitialized)
  const [needsSetup, setNeedsSetup] = useState(cachedNeedsSetup)
  const [permissions, setPermissions] = useState<Set<string>>(cachedPermissions)

  /** 认证相关页面，不需要鉴权 */
  const authRoutes = ['/login', '/change-password', '/setup-wizard']
  const isAuthRoute = authRoutes.includes(pathname)

  /** 更新用户状态并同步模块缓存 */
  const updateUser = useCallback((newUser: UserInfo | null) => {
    cachedUser = newUser
    setUser(newUser)
  }, [])

  /** 更新向导状态并同步模块缓存 */
  const updateNeedsSetup = useCallback((value: boolean) => {
    cachedNeedsSetup = value
    setNeedsSetup(value)
  }, [])

  /** 更新权限缓存 */
  const updatePermissions = useCallback((perms: Set<string>) => {
    cachedPermissions = perms
    setPermissions(perms)
  }, [])

  /** 检查是否有指定权限 */
  const hasPermission = useCallback(
    (module: string, action: string): boolean => {
      if (!user) return false
      // 持有 admin 角色即拥有全部权限（多角色下看 roles 数组，不再信 legacy role）
      if (userHasRole(user, 'admin')) return true
      return permissions.has(`${module}:${action}`)
    },
    [user, permissions],
  )

  /** 保存认证会话（Tauri 应用数据目录文件，Web 调试模式 localStorage） */
  const saveAuth = useCallback(async (userInfo: UserInfo, rememberMe: boolean) => {
    const data: AuthStorage = {
      userId: userInfo.id,
      sessionVersion: userInfo.session_version,
      expiresAt: Date.now() + REMEMBER_ME_DURATION_MS,
      rememberMe,
    }
    try {
      await tauriApi.saveAuthSession(JSON.stringify(data))
    } catch {
      // 认证会话文件或 localStorage 不可用（如隐私模式）
    }
  }, [])

  /** 清除认证信息 */
  const clearAuth = useCallback(async () => {
    updateUser(null)
    try {
      await tauriApi.clearAuthSession()
    } catch {
      // 忽略
    }
  }, [updateUser])

  /**
   * 检查系统是否已完成初始化配置
   *
   * 登录或恢复会话后调用，若 setup_completed !== '1' 则设 needsSetup=true
   */
  const checkSetupCompleted = useCallback(async () => {
    try {
      const configs = await tauriApi.getSystemConfigs([SystemConfigKeys.SETUP_COMPLETED])
      const setupConfig = configs.find(c => c.key === SystemConfigKeys.SETUP_COMPLETED)
      if (!setupConfig || setupConfig.value !== '1') {
        updateNeedsSetup(true)
      }
    } catch {
      // 查询失败时不阻塞用户
      console.warn('[Auth] 检查 setup_completed 失败')
    }
  }, [updateNeedsSetup])

  /** 登录 */
  const login = useCallback(
    async (username: string, password: string, rememberMe = false): Promise<LoginResult> => {
      if (!isTauriEnv()) {
        // 非 Tauri 环境：模拟登录（开发模式）
        const mockUser: UserInfo = {
          id: 1,
          username: 'admin',
          display_name: '管理员',
          role: 'admin',
          role_id: 1,
          roles: [{ id: 1, code: 'admin' }],
          position: null,
          must_change_password: false,
          session_version: 1,
        }
        updateUser(mockUser)
        updatePermissions(new Set()) // admin 角色不需要权限缓存
        // 开发模式下始终持久化，方便调试
        await saveAuth(mockUser, true)
        // 模拟环境也要检查向导状态
        await checkSetupCompleted()
        return { success: true, mustChangePassword: false }
      }

      try {
        const response = await tauriApi.login(username, password)
        updateUser(response.user)

        // 加载权限缓存
        const permSet = new Set(response.permissions.map(p => `${p.module}:${p.action}`))
        updatePermissions(permSet)

        if (rememberMe) {
          // 勾选"记住我"：持久化会话，7天有效
          await saveAuth(response.user, true)
        } else {
          // 未勾选：仅清除之前可能残留的持久化数据，内存中保持登录态
          // 注意：不能调用 clearAuth()，它会同时清空 user 导致路由守卫误判为未登录
          try {
            await tauriApi.clearAuthSession()
          } catch {
            // 持久化存储不可用时忽略
          }
        }

        // 不需要改密时检查向导状态（仅 admin 角色走向导）
        if (!response.must_change_password) {
          if (userHasRole(response.user, 'admin')) {
            await checkSetupCompleted()
          }
        }

        return {
          success: true,
          mustChangePassword: response.must_change_password,
        }
      } catch (err) {
        return {
          success: false,
          mustChangePassword: false,
          error: getErrorMessage(err),
        }
      }
    },
    [updateUser, updatePermissions, saveAuth, checkSetupCompleted],
  )

  /** 修改密码 */
  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!user) {
        throw new Error('未登录')
      }

      if (isTauriEnv()) {
        await tauriApi.changePassword(user.id, oldPassword, newPassword)
        // 刷新用户信息（session_version 已递增）；刷新失败不应反向判定为改密失败。
        let updated = { ...user, must_change_password: false, session_version: user.session_version + 1 }
        try {
          updated = await tauriApi.getUserInfo(user.id)
        } catch (error) {
          console.warn('[Auth] 改密成功后刷新用户信息失败，使用本地状态继续', error)
        }
        updateUser(updated)
        try {
          // 改密后保持之前的 rememberMe 状态
          const stored = await tauriApi.readAuthSession()
          const wasRemembered = stored ? (JSON.parse(stored) as AuthStorage).rememberMe : false
          if (wasRemembered) {
            await saveAuth(updated, true)
          }
        } catch (error) {
          console.warn('[Auth] 改密成功后保存认证信息失败', error)
        }
      } else {
        // 非 Tauri 环境：模拟改密
        const updated = { ...user, must_change_password: false }
        updateUser(updated)
        await saveAuth(updated, true)
      }
    },
    [user, updateUser, saveAuth],
  )

  /** 登出 */
  const logout = useCallback(async () => {
    // 先记录退出登录日志：clearAuth 会清空后端 CurrentUser，必须在其之前调用。
    // 记录失败不应阻塞登出流程。
    if (isTauriEnv()) {
      try {
        await tauriApi.logout()
      } catch (error) {
        console.warn('[Auth] 记录退出登录日志失败', error)
      }
    }
    await clearAuth()
    updateNeedsSetup(false)
    updatePermissions(new Set())
    authInitialized = false
    router.push('/login')
  }, [clearAuth, updateNeedsSetup, updatePermissions, router])

  /** 完成向导 — 由向导完成页调用 */
  const completeSetup = useCallback(() => {
    updateNeedsSetup(false)
  }, [updateNeedsSetup])

  /** 应用启动时初始化日志系统（最先执行，仅一次） */
  useEffect(() => {
    initLogger()
  }, [])

  /** 注册全局认证失效处理：任意 IPC 返回 AUTH 错误时清会话并跳转登录页 */
  useEffect(() => {
    tauriApi.setAuthErrorHandler(() => {
      // 仅在"自以为已登录"时处理，避免登录页或恢复阶段误触发
      if (!cachedUser) return
      void clearAuth()
      updateNeedsSetup(false)
      updatePermissions(new Set())
      authInitialized = false
      toast.error('登录已失效，请重新登录')
      router.push('/login')
    })
    return () => tauriApi.setAuthErrorHandler(null)
  }, [clearAuth, updateNeedsSetup, updatePermissions, router])

  /** 启动时恢复认证状态（仅首次挂载时执行，locale 切换时从缓存同步恢复） */
  useEffect(() => {
    // 如果已经初始化过（locale 切换导致重新挂载），跳过异步恢复
    if (authInitialized) {
      return
    }

    const restoreAuth = async () => {
      try {
        const stored = await tauriApi.readAuthSession()
        if (!stored) {
          authInitialized = true
          setIsLoading(false)
          return
        }

        const data: AuthStorage = JSON.parse(stored)

        // 检查会话是否已过期（7天未使用）
        if (data.expiresAt && Date.now() > data.expiresAt) {
          await clearAuth()
          authInitialized = true
          setIsLoading(false)
          return
        }

        let restoredUser: UserInfo | null = null

        if (isTauriEnv()) {
          // 校验会话并重新激活后端登录态（CurrentUser）。
          // 必须调用 restoreSession：进程重启后后端 is_authenticated 会重置，
          // 仅恢复前端状态会导致写命令报「未登录」。会话失效（已改密/停用）则抛错清除。
          try {
            restoredUser = await tauriApi.restoreSession(data.userId, data.sessionVersion)
          } catch {
            await clearAuth()
          }
        } else {
          // 非 Tauri 开发环境：直接恢复 mock 用户
          restoredUser = {
            id: data.userId,
            username: 'admin',
            display_name: '管理员',
            role: 'admin',
            role_id: 1,
            roles: [{ id: 1, code: 'admin' }],
            position: null,
            must_change_password: false,
            session_version: data.sessionVersion,
          }
        }

        if (restoredUser) {
          updateUser(restoredUser)
          // 恢复成功 → 刷新过期时间（用户活跃，重新计时7天）
          if (data.rememberMe) {
            await saveAuth(restoredUser, true)
          }
          // 已登录且不需要改密 → 检查是否需要向导（仅 admin）
          if (!restoredUser.must_change_password && userHasRole(restoredUser, 'admin')) {
            await checkSetupCompleted()
          }

          // 加载权限（Tauri 环境下 restore_session 不返回权限，需单独获取）
          if (isTauriEnv()) {
            try {
              const perms = await tauriApi.getCurrentUserPermissions()
              updatePermissions(new Set(perms.map(p => `${p.module}:${p.action}`)))
            } catch {
              console.warn('[Auth] 加载权限失败')
            }
          }
        }
      } catch {
        await clearAuth()
      } finally {
        authInitialized = true
        setIsLoading(false)
      }
    }

    restoreAuth()
  }, [clearAuth, checkSetupCompleted, saveAuth, updateUser])

  /** 路由守卫
   *
   * 优先级（从高到低）：
   * 1. 未登录 → /login
   * 2. 需要改密 → /change-password
   * 3. 需要向导 → /setup-wizard
   * 4. 已登录访问 /login → 首页
   */
  useEffect(() => {
    if (isLoading) return

    if (!user && !isAuthRoute) {
      // 未登录访问受保护页面 → 跳转登录
      router.push('/login')
    } else if (user && user.must_change_password && pathname !== '/change-password') {
      // 需要改密但不在改密页 → 强制跳转
      router.push('/change-password')
    } else if (user && !user.must_change_password && needsSetup && pathname !== '/setup-wizard') {
      // 需要向导但不在向导页 → 强制跳转
      router.push('/setup-wizard')
    } else if (user && !user.must_change_password && !needsSetup && pathname === '/login') {
      // 已登录且无待办事项，但仍在登录页 → 跳转首页
      router.push('/')
    }
  }, [user, isLoading, isAuthRoute, pathname, router, needsSetup])

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    needsSetup,
    permissions,
    login,
    changePassword,
    logout,
    completeSetup,
    hasPermission,
  }

  /**
   * 同步计算是否正在等待重定向，阻止目标页面闪烁。
   * 覆盖场景：加载中、未登录访问受保护页、需改密、需向导、已登录仍在登录页。
   */
  const isPendingRedirect =
    isLoading ||
    (!user && !isAuthRoute) ||
    (!!user && user.must_change_password && pathname !== '/change-password') ||
    (!!user && !user.must_change_password && needsSetup && pathname !== '/setup-wizard') ||
    (!!user && !user.must_change_password && !needsSetup && pathname === '/login')

  if (isPendingRedirect) {
    return (
      <AuthContext.Provider value={value}>
        <SplashScreen />
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * 获取认证上下文 Hook
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用')
  }
  return context
}
