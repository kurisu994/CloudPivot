'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SplashScreen } from '@/components/common/splash-screen'
import { usePathname, useRouter } from '@/i18n/navigation'
import { resolveAuthRedirect } from '@/lib/auth-guard'
import { getErrorMessage } from '@/lib/error'
import { initLogger } from '@/lib/logger'
import { rememberMeDurationMs } from '@/lib/remember-session'
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
  /** 登录（rememberMe=true 时按系统配置的天数持久化会话，默认 7 天） */
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

  /** 读取记住我天数。登录后才能读配置，失败时回退 7 天。 */
  const resolveRememberMeDurationMs = useCallback(async () => {
    try {
      const configs = await tauriApi.getSystemConfigs([SystemConfigKeys.REMEMBER_SESSION_DAYS])
      const raw = configs.find(item => item.key === SystemConfigKeys.REMEMBER_SESSION_DAYS)?.value
      return rememberMeDurationMs(raw)
    } catch {
      return rememberMeDurationMs(null)
    }
  }, [])

  /** 保存认证会话（Tauri 应用数据目录文件，Web 调试模式 localStorage） */
  const saveAuth = useCallback(
    async (userInfo: UserInfo, rememberMe: boolean) => {
      const durationMs = await resolveRememberMeDurationMs()
      const data: AuthStorage = {
        userId: userInfo.id,
        sessionVersion: userInfo.session_version,
        expiresAt: Date.now() + durationMs,
        rememberMe,
      }
      try {
        await tauriApi.saveAuthSession(JSON.stringify(data))
      } catch {
        // 认证会话文件或 localStorage 不可用（如隐私模式）
      }
    },
    [resolveRememberMeDurationMs],
  )

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
   * 重置全部认证态（登出 / 会话失效 / 兜底跳登录页共用）
   *
   * 比 clearAuth 更彻底：除了 user 与会话文件，还清掉向导状态、权限缓存和
   * 初始化标记，避免残留上一个用户的状态。clearAuth 单独保留给启动恢复流程
   * 使用（那时 needsSetup/permissions 尚为初值，authInitialized 由 finally 统一置位）。
   */
  const resetAuthState = useCallback(async () => {
    await clearAuth()
    updateNeedsSetup(false)
    updatePermissions(new Set())
    authInitialized = false
  }, [clearAuth, updateNeedsSetup, updatePermissions])

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

      // 未勾选「记住我」时，先清除残留的持久化会话（必须在 login 之前）：
      // 后端 clear_auth_keychain 会同时重置 CurrentUser，若在登录成功后调用，
      // 会把刚建立的登录态一并清掉，导致后续 IPC 全部报 AUTH 错误并被踢回登录页。
      if (!rememberMe) {
        try {
          await tauriApi.clearAuthSession()
        } catch {
          // 持久化存储不可用时忽略
        }
      }

      try {
        const response = await tauriApi.login(username, password)
        updateUser(response.user)

        // 加载权限缓存
        const permSet = new Set(response.permissions.map(p => `${p.module}:${p.action}`))
        updatePermissions(permSet)

        if (rememberMe) {
          // 勾选「记住我」：按 remember_session_days 持久化，默认 7 天
          await saveAuth(response.user, true)
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
        // 纯防御，理论不可达：user=null 且停在改密页时 isPendingRedirect 已为 true，
        // 渲染的是 SplashScreen，改密表单根本不会挂载，因此提交入口不存在。
        // 保留是为了万一守卫条件被改动时不至于静默写坏状态。
        await resetAuthState()
        router.push('/login')
        throw new Error('请先登录')
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
    [user, updateUser, saveAuth, resetAuthState, router],
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
    await resetAuthState()
    router.push('/login')
  }, [resetAuthState, router])

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
      void resetAuthState()
      toast.error('登录已失效，请重新登录')
      router.push('/login')
    })
    return () => tauriApi.setAuthErrorHandler(null)
  }, [resetAuthState, router])

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

        // 检查会话是否已过期（过期时间在保存时按配置写入）
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
          // 恢复成功 → 按当前配置重新计算过期时间
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

  /**
   * 当前认证态应跳转的目标路由（null = 停留在当前页）
   *
   * 决策规则与优先级见 `lib/auth-guard.ts`，路由守卫与下方防闪烁判断共用，
   * 避免两处各写一遍条件、漏改一处就错位。
   */
  const redirectTarget = resolveAuthRedirect({ isLoading, user, needsSetup, pathname })

  /** 路由守卫 */
  useEffect(() => {
    if (redirectTarget) {
      router.push(redirectTarget)
    }
  }, [redirectTarget, router])

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
   *
   * 加载中一律视为等待；其余场景复用守卫的决策结果，二者天然一致。
   */
  const isPendingRedirect = isLoading || redirectTarget !== null

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
