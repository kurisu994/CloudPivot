"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Bell, Sun, Moon, User, ChevronRight } from "lucide-react";
import { usePathname, Link } from "@/i18n/navigation";
import { navConfig, type NavItem } from "@/config/nav";
import { LocaleSwitcher } from "./locale-switcher";
import React from "react";

/** 根据当前路径查找面包屑链 */
function useBreadcrumbs(): { titleKey: string; href?: string }[] {
  const pathname = usePathname();

  // 首页
  if (pathname === "/" || pathname === "") {
    return [{ titleKey: "nav.dashboard" }];
  }

  // 在导航树中查找匹配项
  for (const item of navConfig) {
    // 无子菜单 — 直接匹配
    if (!item.children) {
      const href = item.href || "/";
      if (pathname === href) {
        return [
          { titleKey: "nav.dashboard", href: "/" },
          { titleKey: item.titleKey },
        ];
      }
      continue;
    }

    // 有子菜单 — 在 children 中查找
    for (const child of item.children) {
      if (pathname === child.href) {
        return [
          { titleKey: "nav.dashboard", href: "/" },
          { titleKey: item.titleKey },
          { titleKey: child.titleKey },
        ];
      }
    }
  }

  // 未匹配到导航项 — 仅显示首页
  return [{ titleKey: "nav.dashboard", href: "/" }];
}

/**
 * 顶部工具栏组件
 *
 * 包含动态面包屑、语言切换、主题切换、通知和用户信息
 */
interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const breadcrumbs = useBreadcrumbs();

  return (
    <header className="border-border bg-white supports-backdrop-filter:bg-white/95 sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 backdrop-blur dark:bg-slate-950">
      {/* 左侧：菜单折叠与面包屑 */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onToggleSidebar}
          className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"></line>
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="18" x2="20" y2="18"></line>
          </svg>
        </button>
        <nav className="hidden items-center gap-1.5 text-sm md:flex">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.titleKey}>
                {idx > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                )}
                {isLast ? (
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {t(crumb.titleKey)}
                  </span>
                ) : (
                  <Link
                    href={crumb.href || "/"}
                    className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    {t(crumb.titleKey)}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* 右侧工具区 */}
      <div className="flex items-center gap-3">
        {/* 图标按钮组 */}
        <div className="flex items-center gap-1">
          <LocaleSwitcher />

          <button
            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="bg-destructive absolute top-2 right-2 h-1.5 w-1.5 rounded-full" />
          </button>

          <button
            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </button>
        </div>

        {/* 分隔线 */}
        <div className="bg-slate-200 dark:bg-slate-800 h-8 w-px mx-1" />

        {/* 用户信息 */}
        <button className="items-center gap-3 rounded-lg pl-2 pr-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left hidden sm:flex">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none">Admin User</span>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wider mt-1">SUPER ADMINISTRATOR</span>
          </div>
          <div className="bg-slate-100 text-slate-500 dark:bg-slate-800 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700">
            <User className="h-4 w-4" />
          </div>
        </button>
      </div>
    </header>
  );
}
