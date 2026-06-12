'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { getSystemConfigs, setSystemConfig } from '@/lib/tauri'
import { SystemConfigKeys } from '@/lib/types/system-config'

// ================================================================
// 类型定义
// ================================================================

/** 显示偏好状态 */
interface DisplayPreferences {
  /** 紧凑列表视图 */
  compactView: boolean
  /** 全局字体大小（px） */
  fontSize: number
  /** 侧边栏自动收起（窗口 < 1024px 时） */
  sidebarAutoCollapse: boolean
}

/** Context 值 */
interface DisplayPreferencesContextValue extends DisplayPreferences {
  /** 是否正在加载配置 */
  isLoading: boolean
  /** 更新单项偏好（即时生效 + 持久化） */
  updatePreference: (key: string, value: boolean | string) => Promise<void>
}

// ================================================================
// Context
// ================================================================

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | null>(null)

/** 配置键 → 偏好字段映射 */
const PREFERENCE_KEYS = [SystemConfigKeys.COMPACT_LIST_VIEW, SystemConfigKeys.LARGE_FONT_MODE, SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE] as const

/** 默认字体大小（px） */
const DEFAULT_FONT_SIZE = 16
/** 合法字体大小档位 */
const VALID_FONT_SIZES = [12, 14, 16, 18, 20] as const

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
export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [compactView, setCompactView] = useState(false)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [sidebarAutoCollapse, setSidebarAutoCollapse] = useState(false)

  // ---- 从数据库加载配置 ----
  useEffect(() => {
    const load = async () => {
      try {
        const records = await getSystemConfigs([...PREFERENCE_KEYS])
        const map = new Map(records.map(r => [r.key, r.value]))

        setCompactView(map.get(SystemConfigKeys.COMPACT_LIST_VIEW) === '1')
        // 字体大小：兼容旧版 '1'（大字体=20px）和新版数字格式
        const fontVal = map.get(SystemConfigKeys.LARGE_FONT_MODE)
        if (fontVal) {
          if (fontVal === '1') {
            setFontSize(20) // 旧版兼容：大字体模式 = 20px
          } else {
            const parsed = Number(fontVal)
            if ((VALID_FONT_SIZES as readonly number[]).includes(parsed)) {
              setFontSize(parsed)
            }
          }
        }
        setSidebarAutoCollapse(map.get(SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE) === '1')
      } catch (err) {
        console.warn('[DisplayPreferences] 加载配置失败，使用默认值:', err)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  // ---- 同步 data-attribute 到 <html> ----
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-compact', String(compactView))
    html.setAttribute('data-font-size', String(fontSize))
    // 强制直接将字号写入 <html> 行内样式以确保全局 rem 绝对生效
    html.style.fontSize = `${fontSize}px`
  }, [compactView, fontSize])

  // ---- 更新单项偏好 ----
  const updatePreference = useCallback(async (key: string, value: boolean | string) => {
    // 即时更新 UI
    switch (key) {
      case SystemConfigKeys.COMPACT_LIST_VIEW:
        setCompactView(value as boolean)
        break
      case SystemConfigKeys.LARGE_FONT_MODE:
        setFontSize(Number(value))
        break
      case SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE:
        setSidebarAutoCollapse(value as boolean)
        break
    }

    // 异步持久化
    try {
      const persistValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
      await setSystemConfig(key, persistValue)
    } catch (err) {
      console.error('[DisplayPreferences] 保存配置失败:', err)
    }
  }, [])

  return (
    <DisplayPreferencesContext.Provider
      value={{
        compactView,
        fontSize,
        sidebarAutoCollapse,
        isLoading,
        updatePreference,
      }}
    >
      {children}
    </DisplayPreferencesContext.Provider>
  )
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
  const ctx = useContext(DisplayPreferencesContext)
  if (!ctx) {
    throw new Error('useDisplayPreferences 必须在 DisplayPreferencesProvider 内使用')
  }
  return ctx
}
