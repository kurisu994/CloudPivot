"use client";

import { useTranslations } from "next-intl";

import { Switch } from "@/components/ui/switch";
import { Moon, Eye, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * 主题模式选择卡片
 */
function ThemeModeSection() {
  const t = useTranslations("settings.appearance");
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">("system");

  return (
    <section className="flex flex-col gap-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <Moon className="size-5 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
          {t("themeMode")}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* 浅色主题卡片 */}
        <div
          className="group cursor-pointer"
          onClick={() => setSelectedTheme("light")}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border-2 bg-slate-50 shadow-md transition-all",
              selectedTheme === "light"
                ? "border-primary"
                : "border-transparent hover:border-slate-300"
            )}
          >
            {/* 预览区域 */}
            <div className="flex h-40 w-full flex-col gap-3 p-4">
              <div className="h-5 w-2/3 rounded-md border border-slate-200 bg-white shadow-sm" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="rounded-md border border-slate-200 bg-white shadow-sm" />
                <div className="rounded-md border border-slate-200 bg-white shadow-sm" />
                <div className="rounded-md border border-slate-200 bg-white shadow-sm" />
              </div>
            </div>
            {/* 标签区域 */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">
                  {selectedTheme === "light"
                    ? t("lightThemeCurrent")
                    : t("lightTheme")}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-tighter text-slate-400">
                  {t("lightThemeTag")}
                </span>
              </div>
              {selectedTheme === "light" ? (
                <CheckCircle2 className="size-6 fill-primary text-white" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
              )}
            </div>
          </div>
        </div>

        {/* 深色主题卡片 */}
        <div
          className={cn(
            "group cursor-pointer transition-opacity",
            selectedTheme === "dark"
              ? "opacity-100"
              : "opacity-60 hover:opacity-100"
          )}
          onClick={() => setSelectedTheme("dark")}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border-2 bg-slate-900 transition-all",
              selectedTheme === "dark"
                ? "border-primary"
                : "border-transparent hover:border-slate-300"
            )}
          >
            {/* 预览区域 */}
            <div className="flex h-40 w-full flex-col gap-3 p-4">
              <div className="h-5 w-2/3 rounded-md border border-slate-700 bg-slate-800" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="rounded-md border border-slate-700 bg-slate-800" />
                <div className="rounded-md border border-slate-700 bg-slate-800" />
                <div className="rounded-md border border-slate-700 bg-slate-800" />
              </div>
            </div>
            {/* 标签区域 */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-300">
                  {t("darkTheme")}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-tighter text-slate-600">
                  {t("darkThemeTag")}
                </span>
              </div>
              {selectedTheme === "dark" ? (
                <CheckCircle2 className="size-6 fill-primary text-white" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-700" />
              )}
            </div>
          </div>
        </div>

        {/* 跟随系统主题卡片 */}
        <div
          className={cn(
            "group cursor-pointer transition-opacity",
            selectedTheme === "system"
              ? "opacity-100"
              : "opacity-60 hover:opacity-100"
          )}
          onClick={() => setSelectedTheme("system")}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border-2 transition-all shadow-md bg-slate-50 dark:bg-slate-900",
              selectedTheme === "system"
                ? "border-primary"
                : "border-transparent hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600"
            )}
          >
            {/* Background Gradient Layer */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_50%,#0f172a_50%)] dark:bg-[linear-gradient(135deg,#0f172a_50%,#0f172a_50%)]" />

            {/* 预览区域 */}
            <div className="relative z-10 flex h-40 w-full flex-col gap-3 p-4">
              <div className="h-5 w-2/3 rounded-md border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="rounded-md border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm" />
                <div className="relative rounded-md border border-slate-400/30 bg-slate-400/10 shadow-sm backdrop-blur-sm overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-br from-white/20 to-slate-900/20" />
                </div>
                <div className="rounded-md border border-slate-700/80 bg-slate-800/80 shadow-sm backdrop-blur-sm" />
              </div>
            </div>
            {/* 标签区域 */}
            <div className="relative z-10 flex items-center justify-between border-t border-slate-200/50 bg-white/90 p-4 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/90">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedTheme === "system" 
                    ? t("systemTheme") + " (" + t("lightThemeCurrent").split("(")[1] // mock translated "(当前)"
                    : t("systemTheme")}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-tighter text-slate-500">
                  {t("systemThemeTag")}
                </span>
              </div>
              {selectedTheme === "system" ? (
                <CheckCircle2 className="size-6 fill-primary text-white" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 显示首选项 Toggle 开关
 */
function DisplayPreferencesSection() {
  const t = useTranslations("settings.appearance");
  const [compactView, setCompactView] = useState(false);
  const [largeFont, setLargeFont] = useState(true);
  const [sidebarCollapse, setSidebarCollapse] = useState(true);

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <Eye className="size-5 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
          {t("displayPreferences")}
        </h3>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Toggle: 紧凑列表视图 */}
        <div className="group flex items-center justify-between py-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t("compactListView")}
            </span>
            <span className="text-xs text-slate-400">
              {t("compactListViewDesc")}
            </span>
          </div>
          <Switch
            checked={compactView}
            onCheckedChange={setCompactView}
          />
        </div>

        {/* Toggle: 大字体模式 */}
        <div className="group flex items-center justify-between py-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t("largeFontMode")}
            </span>
            <span className="text-xs text-slate-400">
              {t("largeFontModeDesc")}
            </span>
          </div>
          <Switch
            checked={largeFont}
            onCheckedChange={setLargeFont}
          />
        </div>

        {/* Toggle: 侧边栏自动收起 */}
        <div className="group flex items-center justify-between py-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t("sidebarAutoCollapse")}
            </span>
            <span className="text-xs text-slate-400">
              {t("sidebarAutoCollapseDesc")}
            </span>
          </div>
          <Switch
            checked={sidebarCollapse}
            onCheckedChange={setSidebarCollapse}
          />
        </div>
      </div>


    </section>
  );
}

/** 外观设置主内容 */
export function AppearanceContent() {
  const t = useTranslations("settings.appearance");

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <header className="flex flex-col gap-1 px-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("title")}
        </h2>
        <p className="text-sm text-slate-500">{t("subtitle")}</p>
      </header>

      {/* 主题模式 */}
      <ThemeModeSection />

      {/* 显示首选项 */}
      <DisplayPreferencesSection />
    </div>
  );
}
