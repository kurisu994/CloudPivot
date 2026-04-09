"use client";

import { useState, useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { AppFooter } from "./app-footer";
import { cn } from "@/lib/utils";
import { useDisplayPreferences } from "@/components/providers/display-preferences-provider";

/** 侧边栏自动收起的窗口宽度阈值（px），使用 1280px (Tailwind xl) */
const AUTO_COLLAPSE_BREAKPOINT = 1280;

/**
 * 应用全局布局组件
 *
 * 组合侧边栏 + 顶栏 + 主内容区
 * 支持侧边栏自动收起（当启用且窗口宽度 < 1024px 时自动折叠）
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { sidebarAutoCollapse } = useDisplayPreferences();

  // 监听窗口大小变化（使用高兼容性的 resize 监听 + 状态防抖对比）
  useEffect(() => {
    if (!sidebarAutoCollapse) return;

    // 初始状态
    let lastIsSmall = window.innerWidth < AUTO_COLLAPSE_BREAKPOINT;
    setSidebarCollapsed(lastIsSmall);

    /** 原生 Resize 监听：只有当窗口大小真正跨越 1024px 临界值时，才触发状态改变 */
    const handleResize = () => {
      const currentIsSmall = window.innerWidth < AUTO_COLLAPSE_BREAKPOINT;

      // 只有状态发生翻转时（大屏 -> 小屏，或小屏 -> 大屏）才更新，避免连续覆盖手动折叠干预
      if (currentIsSmall !== lastIsSmall) {
        lastIsSmall = currentIsSmall;
        setSidebarCollapsed(currentIsSmall);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarAutoCollapse]);

  /** 认证相关页面（登录、改密码、向导等）无需主布局，直接渲染 */
  const authRoutes = ["/login", "/change-password", "/setup-wizard"];
  if (authRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 主内容区 */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-200 ease-in-out",
          sidebarCollapsed ? "ml-16" : "ml-60"
        )}
      >
        {/* 顶部工具栏 */}
        <Header
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* 页面内容主体（单独滚动） */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-slate-950/50">
          {children}
        </main>

        {/* 固定在底部的页脚（不参与滚动） */}
        <AppFooter />
      </div>
    </div>
  );
}
