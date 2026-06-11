'use client'

import { CheckCircle2, Eye, Loader2, Moon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useCallback } from 'react'
import { useDisplayPreferences } from '@/components/providers/display-preferences-provider'
import { Switch } from '@/components/ui/switch'
import { setSystemConfig } from '@/lib/tauri'
import { SystemConfigKeys } from '@/lib/types/system-config'
import { cn } from '@/lib/utils'

type ThemeMode = 'light' | 'dark' | 'system'

/**
 * 主题模式选择卡片
 */
function ThemeModeSection({ currentTheme, onThemeChange }: { currentTheme: ThemeMode; onThemeChange: (theme: ThemeMode) => void }) {
  const t = useTranslations('settings.appearance')

  return (
    <section className="flex flex-col gap-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <Moon className="text-primary size-5" />
        <h3 className="text-sm font-bold tracking-wider text-slate-900 uppercase dark:text-slate-100">{t('themeMode')}</h3>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* 浅色主题卡片 */}
        <div className="group cursor-pointer" onClick={() => onThemeChange('light')}>
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border-2 bg-slate-50 shadow-md transition-all',
              currentTheme === 'light' ? 'border-primary' : 'border-transparent hover:border-slate-300',
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
                <span className="text-sm font-bold text-slate-900">{currentTheme === 'light' ? t('lightThemeCurrent') : t('lightTheme')}</span>
                <span className="text-[0.6875rem] font-medium tracking-tighter text-slate-400 uppercase">{t('lightThemeTag')}</span>
              </div>
              {currentTheme === 'light' ? (
                <CheckCircle2 className="fill-primary size-6 text-white" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
              )}
            </div>
          </div>
        </div>

        {/* 深色主题卡片 */}
        <div
          className={cn('group cursor-pointer transition-opacity', currentTheme === 'dark' ? 'opacity-100' : 'opacity-60 hover:opacity-100')}
          onClick={() => onThemeChange('dark')}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border-2 bg-slate-900 transition-all',
              currentTheme === 'dark' ? 'border-primary' : 'border-transparent hover:border-slate-300',
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
                <span className="text-sm font-bold text-slate-300">{t('darkTheme')}</span>
                <span className="text-[0.6875rem] font-medium tracking-tighter text-slate-600 uppercase">{t('darkThemeTag')}</span>
              </div>
              {currentTheme === 'dark' ? (
                <CheckCircle2 className="fill-primary size-6 text-white" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-700" />
              )}
            </div>
          </div>
        </div>

        {/* 跟随系统主题卡片 */}
        <div
          className={cn('group cursor-pointer transition-opacity', currentTheme === 'system' ? 'opacity-100' : 'opacity-60 hover:opacity-100')}
          onClick={() => onThemeChange('system')}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border-2 bg-slate-50 shadow-md transition-all dark:bg-slate-900',
              currentTheme === 'system'
                ? 'border-primary'
                : 'border-transparent hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600',
            )}
          >
            {/* 背景渐变层 */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_50%,#0f172a_50%)] dark:bg-[linear-gradient(135deg,#0f172a_50%,#0f172a_50%)]" />

            {/* 预览区域 */}
            <div className="relative z-10 flex h-40 w-full flex-col gap-3 p-4">
              <div className="h-5 w-2/3 rounded-md border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="rounded-md border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm" />
                <div className="relative overflow-hidden rounded-md border border-slate-400/30 bg-slate-400/10 shadow-sm backdrop-blur-sm">
                  <div className="absolute inset-0 bg-linear-to-br from-white/20 to-slate-900/20" />
                </div>
                <div className="rounded-md border border-slate-700/80 bg-slate-800/80 shadow-sm backdrop-blur-sm" />
              </div>
            </div>
            {/* 标签区域 */}
            <div className="relative z-10 flex items-center justify-between border-t border-slate-200/50 bg-white/90 p-4 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/90">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('systemTheme')}</span>
                <span className="text-[0.6875rem] font-medium tracking-tighter text-slate-500 uppercase">{t('systemThemeTag')}</span>
              </div>
              {currentTheme === 'system' ? (
                <CheckCircle2 className="fill-primary size-6 text-white" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * 显示首选项 Toggle 开关
 */
function DisplayPreferencesSection({
  compactView,
  largeFont,
  sidebarCollapse,
  onToggle,
}: {
  compactView: boolean
  largeFont: boolean
  sidebarCollapse: boolean
  onToggle: (key: string, value: boolean) => void
}) {
  const t = useTranslations('settings.appearance')

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <Eye className="text-primary size-5" />
        <h3 className="text-sm font-bold tracking-wider text-slate-900 uppercase dark:text-slate-100">{t('displayPreferences')}</h3>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Toggle: 紧凑列表视图 */}
        <div className="group flex items-center justify-between gap-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-4">
            <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{t('compactListView')}</span>
            <span className="text-xs text-slate-400">{t('compactListViewDesc')}</span>
          </div>
          <Switch checked={compactView} onCheckedChange={v => onToggle(SystemConfigKeys.COMPACT_LIST_VIEW, v)} />
        </div>

        {/* Toggle: 大字体模式 */}
        <div className="group flex items-center justify-between gap-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-4">
            <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{t('largeFontMode')}</span>
            <span className="text-xs text-slate-400">{t('largeFontModeDesc')}</span>
          </div>
          <Switch checked={largeFont} onCheckedChange={v => onToggle(SystemConfigKeys.LARGE_FONT_MODE, v)} />
        </div>

        {/* Toggle: 侧边栏自动收起 */}
        <div className="group flex items-center justify-between gap-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-4">
            <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{t('sidebarAutoCollapse')}</span>
            <span className="text-xs text-slate-400">{t('sidebarAutoCollapseDesc')}</span>
          </div>
          <Switch checked={sidebarCollapse} onCheckedChange={v => onToggle(SystemConfigKeys.SIDEBAR_AUTO_COLLAPSE, v)} />
        </div>
      </div>
    </section>
  )
}

/** 外观设置主内容 */
export function AppearanceContent() {
  const t = useTranslations('settings.appearance')
  const { theme, setTheme } = useTheme()
  const { compactView, largeFont, sidebarAutoCollapse, isLoading, updatePreference } = useDisplayPreferences()

  /** 切换主题 — 即时生效并持久化 */
  const handleThemeChange = useCallback(
    async (newTheme: ThemeMode) => {
      setTheme(newTheme)
      try {
        await setSystemConfig(SystemConfigKeys.THEME, newTheme)
      } catch (err) {
        console.error('[Appearance] 保存主题失败:', err)
      }
    },
    [setTheme],
  )

  /** 加载中状态 */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1 px-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h2>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </header>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-primary size-6 animate-spin" />
        </div>
      </div>
    )
  }

  /** 当前有效主题模式（从 next-themes 获取） */
  const currentTheme: ThemeMode = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system'

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <header className="flex flex-col gap-1 px-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h2>
        <p className="text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      {/* 主题模式 */}
      <ThemeModeSection currentTheme={currentTheme} onThemeChange={handleThemeChange} />

      {/* 显示首选项 */}
      <DisplayPreferencesSection compactView={compactView} largeFont={largeFont} sidebarCollapse={sidebarAutoCollapse} onToggle={updatePreference} />
    </div>
  )
}
