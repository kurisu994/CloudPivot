'use client'

import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ================================================================
// 统一 Loading 状态设计系统
//
// 三种场景：
// 1. PageLoading — 页面级加载（首次进入页面时）
// 2. CardLoading — 卡片/区块级加载（Dashboard 面板等）
// 3. InlineLoading — 行内加载指示器（按钮、小区域）
// ================================================================

interface PageLoadingProps {
  /** 骨架行数（默认 5） */
  rows?: number
  /** 是否显示标题骨架（默认 true） */
  showHeader?: boolean
  className?: string
}

interface CardLoadingProps {
  /** 骨架行数（默认 3） */
  rows?: number
  /** 卡片高度类名 */
  className?: string
}

interface InlineLoadingProps {
  /** 尺寸：sm=16px, md=20px, lg=24px */
  size?: 'sm' | 'md' | 'lg'
  /** 附加文字 */
  text?: string
  className?: string
}

interface FormLoadingProps {
  /** 表单字段数（默认 4） */
  fields?: number
  className?: string
}

/**
 * 页面级加载骨架
 *
 * 用于页面首次加载时展示，模拟页面结构。
 * 包含标题骨架 + 内容行骨架。
 */
export function PageLoading({ rows = 5, showHeader = true, className }: PageLoadingProps) {
  return (
    <div className={cn('space-y-6 p-6', className)}>
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * 卡片/区块级加载骨架
 *
 * 用于 Dashboard 面板、统计卡片等区块加载。
 */
export function CardLoading({ rows = 3, className }: CardLoadingProps) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-full' : i === 1 ? 'w-3/4' : 'w-1/2')} />
      ))}
    </div>
  )
}

/**
 * 行内加载指示器
 *
 * 用于按钮内、小区域的加载状态。
 * 统一使用 Loader2 旋转图标替代手写 border-spin。
 */
export function InlineLoading({ size = 'md', text, className }: InlineLoadingProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin', sizeMap[size])} />
      {text && <span>{text}</span>}
    </span>
  )
}

/**
 * 表单加载骨架
 *
 * 用于编辑页面加载数据时展示表单骨架。
 */
export function FormLoading({ fields = 4, className }: FormLoadingProps) {
  return (
    <div className={cn('space-y-6 p-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * 统计卡片加载骨架
 *
 * 用于 Dashboard KPI 卡片加载态。
 */
export function MetricCardLoading({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-xl border p-4', className)}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

/**
 * 图表加载骨架
 *
 * 用于 Recharts 图表区域加载态。
 */
export function ChartLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center rounded-xl border p-8', className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}
