"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { SystemConfigKeys } from "@/lib/types/system-config";
import { getSystemConfigs, setSystemConfig } from "@/lib/tauri";

// ================================================================
// 类型定义
// ================================================================

/** 显示偏好状态 */
interface DisplayPreferences {
  /** 紧凑列表视图 */
  compactView: boolean;
  /** 大字体模式 */
  largeFont: boolean;
  /** 侧边栏自动收起（窗口 < 1024px 时） */
  sidebarAutoCollapse: boolean;
}

/** Context 值 */
interface DisplayPreferencesContextValue extends DisplayPreferences {
  /** 是否正在加载配置 */
  isLoading: boolean;
  /** 更新单项偏好（即时生效 + 持久化） */
  updatePreference: (key: string, value: boolean) => Promise<void>;
}

// ================================================================
// Context
// ================================================================

const DisplayPreferencesContext =
  createContext<DisplayPreferencesContextValue | null>(null);

/** 配置键 → 偏好字段映射 */
const PREFERENCE_KEYS = [
  SystemConfigKeys.COMPACT_LIST_VIEW,
  SystemConfigKeys.LARGE_FONT_MODE,
  SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE,
] as const;

// ================================================================
// Provider
// ================================================================

/**
 * 显示偏好 Provider
 *
 * 职责：
 * 1. 应用启动时从数据库读取显示偏好
 * 2. 在 <html> 上设置 data-compact / data-large-font 属性驱动全局 CSS
 * 3. 通过 Context 向下分发状态和更新方法
 */
export function DisplayPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [compactView, setCompactView] = useState(false);
  const [largeFont, setLargeFont] = useState(false);
  const [sidebarAutoCollapse, setSidebarAutoCollapse] = useState(false);

  // ---- 从数据库加载配置 ----
  useEffect(() => {
    const load = async () => {
      try {
        const records = await getSystemConfigs([...PREFERENCE_KEYS]);
        const map = new Map(records.map((r) => [r.key, r.value]));

        setCompactView(map.get(SystemConfigKeys.COMPACT_LIST_VIEW) === "1");
        setLargeFont(map.get(SystemConfigKeys.LARGE_FONT_MODE) === "1");
        setSidebarAutoCollapse(
          map.get(SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE) === "1"
        );
      } catch (err) {
        console.warn("[DisplayPreferences] 加载配置失败，使用默认值:", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  // ---- 同步 data-attribute 到 <html> ----
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-compact", String(compactView));
    html.setAttribute("data-large-font", String(largeFont));
  }, [compactView, largeFont]);

  // ---- 更新单项偏好 ----
  const updatePreference = useCallback(async (key: string, value: boolean) => {
    // 即时更新 UI
    switch (key) {
      case SystemConfigKeys.COMPACT_LIST_VIEW:
        setCompactView(value);
        break;
      case SystemConfigKeys.LARGE_FONT_MODE:
        setLargeFont(value);
        break;
      case SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE:
        setSidebarAutoCollapse(value);
        break;
    }

    // 异步持久化
    try {
      await setSystemConfig(key, value ? "1" : "0");
    } catch (err) {
      console.error("[DisplayPreferences] 保存配置失败:", err);
    }
  }, []);

  return (
    <DisplayPreferencesContext.Provider
      value={{
        compactView,
        largeFont,
        sidebarAutoCollapse,
        isLoading,
        updatePreference,
      }}
    >
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

// ================================================================
// Hook
// ================================================================

/**
 * 获取显示偏好上下文
 *
 * 必须在 DisplayPreferencesProvider 内部使用
 */
export function useDisplayPreferences(): DisplayPreferencesContextValue {
  const ctx = useContext(DisplayPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useDisplayPreferences 必须在 DisplayPreferencesProvider 内使用"
    );
  }
  return ctx;
}
