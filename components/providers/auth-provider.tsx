'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { SplashScreen } from '@/components/common/splash-screen'
import { usePathname, useRouter } from '@/i18n/navigation'
import { getErrorMessage } from '@/lib/error'
import * as tauriApi from '@/lib/tauri'
import { isTauriEnv, type UserInfo } from '@/lib/tauri'
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
}

/** 认证上下文接口 */
interface AuthContextValue extends AuthState {
  /** 登录（rememberMe=true 时持久化会话，7天未使用过期） */
  login: (username: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  /** 修改密码 */
  changePassword: (newPassword: string) => Promise<void>
  /** 登出 */
  logout: () => void
  /** 完成向导 */
  completeSetup: () => void
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

  /** 保存认证信息到系统钥匙串（Tauri）或 localStorage（Web 调试模式） */
  const saveAuth = useCallback(async (userInfo: UserInfo, rememberMe: boolean) => {
    const data: AuthStorage = {
      userId: userInfo.id,
      sessionVersion: userInfo.session_version,
      expiresAt: Date.now() + REMEMBER_ME_DURATION_MS,
      rememberMe,
    }
    try {
      await tauriApi.saveAuthKeychain(JSON.stringify(data))
    } catch {
      // 钥匙串或 localStorage 不可用（如隐私模式）
    }
  }, [])

  /** 清除认证信息 */
  const clearAuth = useCallback(async () => {
    updateUser(null)
    try {
      await tauriApi.clearAuthKeychain()
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
          must_change_password: false,
          session_version: 1,
        }
        updateUser(mockUser)
        // 开发模式下始终持久化，方便调试
        await saveAuth(mockUser, true)
        // 模拟环境也要检查向导状态
        await checkSetupCompleted()
        return { success: true, mustChangePassword: false }
      }

      try {
        const response = await tauriApi.login(username, password)
        updateUser(response.user)

        if (rememberMe) {
          // 勾选"记住我"：持久化会话到钥匙串，7天有效
          await saveAuth(response.user, true)
        } else {
          // 未勾选：清除之前可能残留的持久化数据，仅内存保持登录
          await clearAuth()
        }

        // 不需要改密时检查向导状态
        if (!response.must_change_password) {
          await checkSetupCompleted()
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
    [updateUser, saveAuth, clearAuth, checkSetupCompleted],
  )

  /** 修改密码 */
  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!user) {
        throw new Error('未登录')
      }

      if (isTauriEnv()) {
        await tauriApi.changePassword(user.id, newPassword)
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
          const stored = await tauriApi.readAuthKeychain()
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
    await clearAuth()
    updateNeedsSetup(false)
    authInitialized = false
    router.push('/login')
  }, [clearAuth, updateNeedsSetup, router])

  /** 完成向导 — 由向导完成页调用 */
  const completeSetup = useCallback(() => {
    updateNeedsSetup(false)
  }, [updateNeedsSetup])

  /** 启动时恢复认证状态（仅首次挂载时执行，locale 切换时从缓存同步恢复） */
  useEffect(() => {
    // 如果已经初始化过（locale 切换导致重新挂载），跳过异步恢复
    if (authInitialized) {
      return
    }

    const restoreAuth = async () => {
      try {
        const stored = await tauriApi.readAuthKeychain()
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
          // 从后端验证会话是否有效
          const userInfo = await tauriApi.getUserInfo(data.userId)
          if (userInfo.session_version === data.sessionVersion) {
            restoredUser = userInfo
          } else {
            // session_version 不匹配（已改密），清除会话
            await clearAuth()
          }
        } else {
          // 非 Tauri 开发环境：直接恢复 mock 用户
          restoredUser = {
            id: data.userId,
            username: 'admin',
            display_name: '管理员',
            role: 'admin',
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
          // 已登录且不需要改密 → 检查是否需要向导
          if (!restoredUser.must_change_password) {
            await checkSetupCompleted()
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
    login,
    changePassword,
    logout,
    completeSetup,
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
