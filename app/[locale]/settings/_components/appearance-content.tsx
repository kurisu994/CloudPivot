'use client'

import { CheckCircle2, Eye, Loader2, Moon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useCallback, useRef, useState } from 'react'
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

/** 字体大小档位 */
const FONT_SIZES = [12, 14, 16, 18, 20] as const

/**
 * iOS 风格字体大小选择器
 *
 * 模仿 iOS Settings → Display & Brightness → Text Size 的交互：
 * - 底部滑轨 + 刻度点
 * - 两端 Aa 小/大 按钮可步进
 * - 选中刻度高亮 + 滑块指示器
 */
function FontSizeSlider({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const t = useTranslations('settings.appearance')
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const [tempValue, setTempValue] = useState<number | null>(null)

  const displayValue = tempValue !== null ? tempValue : value
  const idx = FONT_SIZES.indexOf(displayValue as (typeof FONT_SIZES)[number])
  const currentIdx = idx === -1 ? 2 : idx // 默认 16px 在索引 2
  const targetPct = (currentIdx / (FONT_SIZES.length - 1)) * 100
  const activePct = dragPct !== null ? dragPct : targetPct

  const handleStep = (dir: -1 | 1) => {
    const next = currentIdx + dir
    if (next >= 0 && next < FONT_SIZES.length) {
      onChange(FONT_SIZES[next])
    }
  }

  /** 计算当前的 clientX 对应滑轨上的百分比 [0, 100] */
  const getPctFromX = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * 100
  }, [])

  /** 根据百分比计算最接近的字号 */
  const getNearestSize = useCallback((pctVal: number) => {
    const ratio = pctVal / 100
    const nearestIdx = Math.round(ratio * (FONT_SIZES.length - 1))
    return FONT_SIZES[nearestIdx]
  }, [])

  /** 拖动处理 */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      const startPct = getPctFromX(e.clientX)
      setDragPct(startPct)
      setTempValue(getNearestSize(startPct))

      const onMove = (ev: PointerEvent) => {
        const currentPct = getPctFromX(ev.clientX)
        setDragPct(currentPct)
        setTempValue(getNearestSize(currentPct))
      }

      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId)
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)

        const finalPct = getPctFromX(ev.clientX)
        const finalSize = getNearestSize(finalPct)

        setDragPct(null)
        setTempValue(null)
        onChange(finalSize)
      }

      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
    },
    [getPctFromX, getNearestSize, onChange],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 预览文本 — 整体跟随选中字号 */}
      <div
        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/50"
        style={{ fontSize: `${displayValue}px` }}
      >
        <span className="text-muted-foreground">{t('fontSizePreview')}</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">{t('fontSizePreviewText')}</span>
      </div>

      {/* 滑轨区域 */}
      <div className="flex items-center gap-3">
        {/* 左侧小字 Aa */}
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={currentIdx === 0}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={t('fontSizeDecrease')}
        >
          <span className="text-xs font-bold">Aa</span>
        </button>

        {/* 滑轨（可拖动） */}
        <div
          ref={trackRef}
          className="relative flex flex-1 cursor-pointer h-10 select-none"
          onPointerDown={handlePointerDown}
          role="slider"
          aria-valuemin={FONT_SIZES[0]}
          aria-valuemax={FONT_SIZES[FONT_SIZES.length - 1]}
          aria-valuenow={value}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault()
              handleStep(-1)
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault()
              handleStep(1)
            }
          }}
        >
          {/* 底部轨道 */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-slate-200 dark:bg-slate-700" />
          {/* 活跃轨道 */}
          <div
            className={cn(
              'bg-primary absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full',
              dragPct === null && 'transition-all duration-200',
            )}
            style={{ width: `${activePct}%` }}
          />

          {/* 刻度竖线组（穿过轨道） */}
          {FONT_SIZES.map((size, i) => {
            const tickPct = (i / (FONT_SIZES.length - 1)) * 100
            return (
              <div
                key={`tick-${size}`}
                className={cn(
                  'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all duration-200',
                  i <= currentIdx ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600',
                  i === currentIdx ? 'h-4' : 'h-3',
                )}
                style={{ left: `${tickPct}%` }}
              />
            )
          })}

          {/* 圆形滑块 thumb */}
          <div
            className={cn(
              'bg-primary absolute top-1/2 z-10 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md ring-2 ring-white transition-[left] duration-200 dark:ring-slate-900',
              dragPct === null && 'transition-[left] duration-200',
            )}
            style={{ left: `${activePct}%` }}
          />

          {/* 刻度大小标签（固定在滑轨下方，绝对不重叠） */}
          {FONT_SIZES.map((size, i) => {
            const tickPct = (i / (FONT_SIZES.length - 1)) * 100
            return (
              <span
                key={`label-${size}`}
                className={cn(
                  'absolute top-[32px] -translate-x-1/2 select-none text-[11px] font-medium transition-colors duration-200 whitespace-nowrap',
                  i === currentIdx ? 'text-primary font-bold' : 'text-slate-400 dark:text-slate-500',
                )}
                style={{ left: `${tickPct}%` }}
              >
                {size}
              </span>
            )
          })}
        </div>

        {/* 右侧大字 Aa */}
        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={currentIdx === FONT_SIZES.length - 1}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={t('fontSizeIncrease')}
        >
          <span className="text-lg font-bold">Aa</span>
        </button>
      </div>
    </div>
  )
}

/**
 * 显示首选项 Toggle 开关
 */
function DisplayPreferencesSection({
  compactView,
  fontSize,
  sidebarCollapse,
  onToggle,
  onFontSizeChange,
}: {
  compactView: boolean
  fontSize: number
  sidebarCollapse: boolean
  onToggle: (key: string, value: boolean | string) => void
  onFontSizeChange: (size: number) => void
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

        {/* 字体大小选择器 */}
        <div className="flex flex-col gap-4 py-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('fontSize')}</span>
            <span className="text-xs text-slate-400">{t('fontSizeDesc')}</span>
          </div>
          <FontSizeSlider value={fontSize} onChange={onFontSizeChange} />
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
  const { compactView, fontSize, sidebarAutoCollapse, isLoading, updatePreference } = useDisplayPreferences()

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
      <DisplayPreferencesSection
        compactView={compactView}
        fontSize={fontSize}
        sidebarCollapse={sidebarAutoCollapse}
        onToggle={updatePreference}
        onFontSizeChange={size => updatePreference(SystemConfigKeys.LARGE_FONT_MODE, String(size))}
      />
    </div>
  )
}
