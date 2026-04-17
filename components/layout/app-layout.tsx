'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { SplashScreen } from '@/components/common/splash-screen'
import { useDisplayPreferences } from '@/components/providers/display-preferences-provider'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { AppFooter } from './app-footer'
import { Header } from './header'
import { Sidebar } from './sidebar'

/** 侧边栏自动收起的窗口宽度阈值（px），使用 1280px (Tailwind xl) */
const AUTO_COLLAPSE_BREAKPOINT = 1280

interface SidebarCollapseStore {
  getSnapshot: () => boolean
  getServerSnapshot: () => boolean
  subscribe: (listener: () => void) => () => void
  toggle: () => void
  setAutoCollapseEnabled: (enabled: boolean) => void
}

/**
 * 侧边栏折叠外部状态：
 * 1. 允许手动切换；
 * 2. 自动收起开启时，在跨越断点时覆盖为窗口对应状态；
 * 3. 设置项切换时无需在 effect 中直接 setState。
 */
function createSidebarCollapseStore(initialAutoCollapseEnabled: boolean): SidebarCollapseStore {
  let autoCollapseEnabled = initialAutoCollapseEnabled
  let collapsed = false
  let lastIsSmall = false
  let initialized = false
  const listeners = new Set<() => void>()

  const getIsSmallViewport = () => window.innerWidth < AUTO_COLLAPSE_BREAKPOINT

  const notify = () => {
    listeners.forEach(listener => listener())
  }

  const ensureInitialized = () => {
    if (initialized || typeof window === 'undefined') {
      return
    }

    lastIsSmall = getIsSmallViewport()
    collapsed = autoCollapseEnabled ? lastIsSmall : false
    initialized = true
  }

  const setCollapsed = (nextCollapsed: boolean) => {
    ensureInitialized()
    if (collapsed === nextCollapsed) {
      return
    }

    collapsed = nextCollapsed
    notify()
  }

  const handleResize = () => {
    ensureInitialized()

    const currentIsSmall = getIsSmallViewport()
    if (currentIsSmall === lastIsSmall) {
      return
    }

    lastIsSmall = currentIsSmall

    if (autoCollapseEnabled) {
      setCollapsed(currentIsSmall)
    }
  }

  return {
    getSnapshot: () => {
      ensureInitialized()
      return collapsed
    },
    getServerSnapshot: () => false,
    subscribe: listener => {
      ensureInitialized()
      listeners.add(listener)

      if (typeof window !== 'undefined' && listeners.size === 1) {
        window.addEventListener('resize', handleResize)
      }

      return () => {
        listeners.delete(listener)
        if (typeof window !== 'undefined' && listeners.size === 0) {
          window.removeEventListener('resize', handleResize)
        }
      }
    },
    toggle: () => {
      setCollapsed(!collapsed)
    },
    setAutoCollapseEnabled: enabled => {
      ensureInitialized()

      if (autoCollapseEnabled === enabled) {
        return
      }

      autoCollapseEnabled = enabled

      if (autoCollapseEnabled) {
        setCollapsed(lastIsSmall)
      }
    },
  }
}

function AppLayoutShell({
  children,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  children: React.ReactNode
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}) {
  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />

      {/* 主内容区 */}
      <div className={cn('flex min-w-0 flex-1 flex-col transition-all duration-200 ease-in-out', sidebarCollapsed ? 'ml-16' : 'ml-60')}>
        {/* 顶部工具栏 */}
        <Header onToggleSidebar={onToggleSidebar} />

        {/* 页面内容主体（单独滚动） */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-slate-950/50">{children}</main>

        {/* 固定在底部的页脚（不参与滚动） */}
        <AppFooter />
      </div>
    </div>
  )
}

function ManagedAppLayout({ children, sidebarAutoCollapse }: { children: React.ReactNode; sidebarAutoCollapse: boolean }) {
  const [store] = useState(() => createSidebarCollapseStore(sidebarAutoCollapse))
  const sidebarCollapsed = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  useEffect(() => {
    store.setAutoCollapseEnabled(sidebarAutoCollapse)
  }, [sidebarAutoCollapse, store])

  return (
    <AppLayoutShell sidebarCollapsed={sidebarCollapsed} onToggleSidebar={store.toggle}>
      {children}
    </AppLayoutShell>
  )
}

/**
 * 应用全局布局组件
 *
 * 组合侧边栏 + 顶栏 + 主内容区
 * 支持侧边栏自动收起（当启用且窗口宽度 < 1024px 时自动折叠）
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { sidebarAutoCollapse, isLoading } = useDisplayPreferences()

  /** 认证相关页面（登录、改密码、向导等）无需主布局，直接渲染 */
  const authRoutes = ['/login', '/change-password', '/setup-wizard']
  if (authRoutes.includes(pathname)) {
    return <>{children}</>
  }

  if (isLoading) {
    return <SplashScreen />
  }

  return <ManagedAppLayout sidebarAutoCollapse={sidebarAutoCollapse}>{children}</ManagedAppLayout>
}
