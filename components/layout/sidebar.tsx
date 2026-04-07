"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { navConfig, type NavItem } from "@/config/nav";

interface SidebarProps {
  /** 侧边栏是否折叠 */
  collapsed: boolean;
  /** 切换折叠状态 */
  onToggle: () => void;
}

/**
 * 侧边栏组件
 *
 * 参考 demo/src/components/Layout.tsx 样式实现
 * 支持折叠（64px）/ 展开（240px）两种模式
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar fixed top-0 left-0 z-30 flex h-full flex-col border-r transition-all duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-14 items-center px-3 pt-1">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Logo 图标 */}
          <div className="relative h-8 shrink-0">
            <Image
              src="/cloudpivot_logo.png"
              alt="CloudPivot"
              width={37}
              height={32}
              className="h-8 w-auto object-contain dark:hidden"
            />
            <Image
              src="/cloudpivot_logo_dark.png"
              alt="CloudPivot"
              width={37}
              height={32}
              className="hidden h-8 w-auto object-contain dark:block"
            />
          </div>
          {/* 展开时显示品牌名称 */}
          {!collapsed && (
            <div className="flex flex-col leading-tight select-none">
              <span
                className="text-[15px] font-extrabold tracking-tight text-[#294985] dark:text-slate-100"
                style={{ fontFamily: "var(--font-noto-sans-sc), system-ui" }}
              >
                云枢
              </span>
              <span
                className="text-[10px] font-semibold tracking-[0.2em] text-slate-400/80 uppercase dark:text-slate-500"
                style={{ fontFamily: "var(--font-brand), system-ui" }}
              >
                CloudPivot
              </span>
            </div>
          )}
        </div>
      </div>
      {/* 导航菜单 */}
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-2.5">
        <ul className="space-y-0.5">
          {navConfig.map((item) => (
            <NavMenuItem
              key={item.titleKey}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
              t={t}
            />
          ))}
        </ul>
      </nav>

      {/* 折叠按钮 */}
      <div className="border-sidebar-border border-t p-2">
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg p-2 transition-colors"
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="text-xs font-medium">
                {t("sidebar.collapse")}
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/** 导航菜单项组件 */
function NavMenuItem({
  item,
  collapsed,
  pathname,
  t,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasChildren = item.children && item.children.length > 0;

  // 判断当前项或其子项是否激活
  const isActive = hasChildren
    ? item.children!.some((child) => pathname === child.href)
    : pathname === (item.href || "/");

  const [expanded, setExpanded] = useState(isActive);

  const Icon = item.icon;
  const label = t(item.titleKey);

  // 有子菜单
  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => !collapsed && setExpanded((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-[#43619f] text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          )}
          title={collapsed ? label : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{label}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
            </>
          )}
        </button>
        {!collapsed && expanded && (
          <ul className="mt-1 ml-4 space-y-1 pl-3">
            {item.children!.map((child) => {
              const ChildIcon = child.icon;
              const childActive = pathname === child.href;
              return (
                <li key={child.titleKey}>
                  <Link
                    href={child.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      childActive
                        ? "bg-[#43619f]/10 font-bold text-[#43619f] dark:bg-[#6b85c1]/15 dark:text-[#6b85c1]"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t(child.titleKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  // 无子菜单
  const href = item.href || "/";
  const active = pathname === href;

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-[#43619f] text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        )}
        title={collapsed ? label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}
