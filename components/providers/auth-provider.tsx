"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { isTauriEnv, type UserInfo } from "@/lib/tauri";
import * as tauriApi from "@/lib/tauri";
import { SystemConfigKeys } from "@/lib/types/system-config";

/** 认证状态 */
interface AuthState {
  /** 当前登录用户 */
  user: UserInfo | null;
  /** 是否正在加载认证状态 */
  isLoading: boolean;
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 是否需要完成向导 */
  needsSetup: boolean;
}

/** 认证上下文接口 */
interface AuthContextValue extends AuthState {
  /** 登录 */
  login: (username: string, password: string) => Promise<LoginResult>;
  /** 修改密码 */
  changePassword: (newPassword: string) => Promise<void>;
  /** 登出 */
  logout: () => void;
  /** 完成向导 */
  completeSetup: () => void;
}

/** 登录结果 */
interface LoginResult {
  success: boolean;
  mustChangePassword: boolean;
  error?: string;
}

/** localStorage 键名 */
const AUTH_STORAGE_KEY = "cloudpivot_auth";

/** 认证数据持久化结构 */
interface AuthStorage {
  userId: number;
  sessionVersion: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 认证 Provider
 *
 * 提供全局认证状态管理、路由守卫和会话持久化。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  /** 认证相关页面，不需要鉴权 */
  const authRoutes = ["/login", "/change-password", "/setup-wizard"];
  const isAuthRoute = authRoutes.includes(pathname);

  /** 保存认证信息到 localStorage */
  const saveAuth = useCallback((userInfo: UserInfo) => {
    const data: AuthStorage = {
      userId: userInfo.id,
      sessionVersion: userInfo.session_version,
    };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage 不可用（如隐私模式）
    }
  }, []);

  /** 清除认证信息 */
  const clearAuth = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // 忽略
    }
  }, []);

  /**
   * 检查系统是否已完成初始化配置
   *
   * 登录或恢复会话后调用，若 setup_completed !== '1' 则设 needsSetup=true
   */
  const checkSetupCompleted = useCallback(async () => {
    try {
      const configs = await tauriApi.getSystemConfigs([
        SystemConfigKeys.SETUP_COMPLETED,
      ]);
      const setupConfig = configs.find(
        (c) => c.key === SystemConfigKeys.SETUP_COMPLETED
      );
      if (!setupConfig || setupConfig.value !== "1") {
        setNeedsSetup(true);
      }
    } catch {
      // 查询失败时不阻塞用户
      console.warn("[Auth] 检查 setup_completed 失败");
    }
  }, []);

  /** 登录 */
  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      if (!isTauriEnv()) {
        // 非 Tauri 环境：模拟登录（开发模式）
        const mockUser: UserInfo = {
          id: 1,
          username: "admin",
          display_name: "管理员",
          role: "admin",
          must_change_password: false,
          session_version: 1,
        };
        setUser(mockUser);
        saveAuth(mockUser);
        // 模拟环境也要检查向导状态
        await checkSetupCompleted();
        return { success: true, mustChangePassword: false };
      }

      try {
        const response = await tauriApi.login(username, password);
        setUser(response.user);
        saveAuth(response.user);

        // 不需要改密时检查向导状态
        if (!response.must_change_password) {
          await checkSetupCompleted();
        }

        return {
          success: true,
          mustChangePassword: response.must_change_password,
        };
      } catch (err) {
        return {
          success: false,
          mustChangePassword: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [saveAuth, checkSetupCompleted],
  );

  /** 修改密码 */
  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!user) {
        throw new Error("未登录");
      }

      if (isTauriEnv()) {
        await tauriApi.changePassword(user.id, newPassword);
        // 刷新用户信息（session_version 已递增）
        const updated = await tauriApi.getUserInfo(user.id);
        setUser(updated);
        saveAuth(updated);
      } else {
        // 非 Tauri 环境：模拟改密
        const updated = { ...user, must_change_password: false };
        setUser(updated);
        saveAuth(updated);
      }
    },
    [user, saveAuth],
  );

  /** 登出 */
  const logout = useCallback(() => {
    clearAuth();
    setNeedsSetup(false);
    router.push("/login");
  }, [clearAuth, router]);

  /** 完成向导 — 由向导完成页调用 */
  const completeSetup = useCallback(() => {
    setNeedsSetup(false);
  }, []);

  /** 启动时恢复认证状态 */
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) {
          setIsLoading(false);
          return;
        }

        const data: AuthStorage = JSON.parse(stored);
        let restoredUser: UserInfo | null = null;

        if (isTauriEnv()) {
          // 从后端验证会话是否有效
          const userInfo = await tauriApi.getUserInfo(data.userId);
          if (userInfo.session_version === data.sessionVersion) {
            restoredUser = userInfo;
          } else {
            // session_version 不匹配（已改密），清除会话
            clearAuth();
          }
        } else {
          // 非 Tauri 开发环境：直接恢复 mock 用户
          restoredUser = {
            id: data.userId,
            username: "admin",
            display_name: "管理员",
            role: "admin",
            must_change_password: false,
            session_version: data.sessionVersion,
          };
        }

        if (restoredUser) {
          setUser(restoredUser);
          // 已登录且不需要改密 → 检查是否需要向导
          if (!restoredUser.must_change_password) {
            await checkSetupCompleted();
          }
        }
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, [clearAuth, checkSetupCompleted]);

  /** 路由守卫
   *
   * 优先级（从高到低）：
   * 1. 未登录 → /login
   * 2. 需要改密 → /change-password
   * 3. 需要向导 → /setup-wizard
   */
  useEffect(() => {
    if (isLoading) return;

    if (!user && !isAuthRoute) {
      // 未登录访问受保护页面 → 跳转登录
      router.push("/login");
    } else if (user && user.must_change_password && pathname !== "/change-password") {
      // 需要改密但不在改密页 → 强制跳转
      router.push("/change-password");
    } else if (user && !user.must_change_password && needsSetup && pathname !== "/setup-wizard") {
      // 需要向导但不在向导页 → 强制跳转
      router.push("/setup-wizard");
    }
  }, [user, isLoading, isAuthRoute, pathname, router, needsSetup]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    needsSetup,
    login,
    changePassword,
    logout,
    completeSetup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 获取认证上下文 Hook
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }
  return context;
}
