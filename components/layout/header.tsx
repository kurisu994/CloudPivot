"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Bell, Sun, Moon, Monitor, User, ChevronRight } from "lucide-react";
import { usePathname, Link } from "@/i18n/navigation";
import { navConfig } from "@/config/nav";
import { LocaleSwitcher } from "./locale-switcher";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { SystemConfigKeys } from "@/lib/types/system-config";
import { setSystemConfig } from "@/lib/tauri";

/** 主题选项配置 */
const themeOptions = [
  { value: "light", icon: Sun, labelKey: "header.themeLight" },
  { value: "dark", icon: Moon, labelKey: "header.themeDark" },
  { value: "system", icon: Monitor, labelKey: "header.themeSystem" },
] as const;

/** 根据当前路径查找面包屑链 */
function useBreadcrumbs(): { titleKey: string; href?: string }[] {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "") {
    return [{ titleKey: "nav.dashboard" }];
  }

  for (const item of navConfig) {
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

  return [{ titleKey: "nav.dashboard", href: "/" }];
}

/**
 * 主题切换下拉选择器
 */
function ThemeSwitcher() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 解决 next-themes hydration mismatch：SSR 时 theme 为 undefined
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /** 切换主题并持久化 */
  const handleSwitch = useCallback(
    async (newTheme: string) => {
      setTheme(newTheme);
      setOpen(false);
      try {
        await setSystemConfig(SystemConfigKeys.THEME, newTheme);
      } catch {
        // 持久化失败不影响前端体验
      }
    },
    [setTheme]
  );

  /** 当前主题图标（未挂载时用 Sun 保证 SSR/CSR 一致） */
  const CurrentIcon = !mounted
    ? Sun
    : theme === "dark"
      ? Moon
      : theme === "system"
        ? Monitor
        : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        title={t("header.theme")}
      >
        <CurrentIcon className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="border-border bg-popover absolute top-full right-0 mt-1 w-40 rounded-lg border p-1 shadow-lg">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSwitch(opt.value)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-popover-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const breadcrumbs = useBreadcrumbs();

  return (
    <header className="border-border sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4 backdrop-blur supports-backdrop-filter:bg-white/95 dark:bg-slate-950">
      {/* 左侧：菜单折叠与面包屑 */}
      <div className="flex flex-1 items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
                    className="text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
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
          <ThemeSwitcher />

          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <Bell className="h-[18px] w-[18px]" />
            <span className="bg-destructive absolute top-2 right-2 h-1.5 w-1.5 rounded-full" />
          </button>

          <button className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </button>
        </div>

        {/* 分隔线 */}
        <div className="mx-1 h-8 w-px bg-slate-200 dark:bg-slate-800" />

        {/* 用户信息 */}
        <button className="hidden items-center gap-3 rounded-lg py-1 pr-1 pl-2 text-left transition-colors hover:bg-slate-50 sm:flex dark:hover:bg-slate-900">
          <div className="flex flex-col">
            <span className="text-sm leading-none font-bold text-slate-800 dark:text-slate-100">
              Admin User
            </span>
            <span className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400">
              SUPER ADMINISTRATOR
            </span>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            <User className="h-4 w-4" />
          </div>
        </button>
      </div>
    </header>
  );
}
