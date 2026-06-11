'use client'

import { AlertTriangle, CreditCard, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  ensureReplenishmentRules,
  getInventoryList,
  getPayables,
  getPurchaseReportSummary,
  getReceivables,
  getReplenishmentSuggestions,
  getSalesReportSummary,
} from '@/lib/tauri'
import { addDays, formatDashboardUsd, formatLocalDate } from './format'

type DeltaTrend = 'up' | 'down' | 'flat'

interface KpiDelta {
  percent: number | null
  trend: DeltaTrend
}

/** 获取上月同期日期范围，用于本月至今环比 */
function getPreviousMonthToDateRange(today: Date) {
  const currentMonth = today.getMonth()
  const previousMonthStart = new Date(today.getFullYear(), currentMonth - 1, 1)
  const previousMonthLastDay = new Date(today.getFullYear(), currentMonth, 0).getDate()
  const previousMonthEnd = new Date(today.getFullYear(), currentMonth - 1, Math.min(today.getDate(), previousMonthLastDay))

  return {
    start: formatLocalDate(previousMonthStart),
    end: formatLocalDate(previousMonthEnd),
  }
}

/** 计算两个金额之间的百分比变化 */
function calculateDelta(current: number, previous: number): KpiDelta {
  if (previous === 0) {
    return {
      percent: current === 0 ? 0 : null,
      trend: current > 0 ? 'up' : 'flat',
    }
  }

  const percent = ((current - previous) / previous) * 100
  return {
    percent,
    trend: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
  }
}

/** KPI 涨跌标记 */
function KpiDeltaBadge({ delta }: { delta: KpiDelta }) {
  const isUp = delta.trend === 'up'
  const isDown = delta.trend === 'down'
  const label = delta.percent === null ? '—' : `${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%`

  return (
    <Badge
      className={
        isDown
          ? 'border-none bg-rose-50 px-2 py-0.5 font-bold text-rose-600 shadow-none hover:bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400'
          : isUp
            ? 'border-none bg-emerald-50 px-2 py-0.5 font-bold text-emerald-600 shadow-none hover:bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
            : 'border-none bg-slate-100 px-2 py-0.5 font-bold text-slate-500 shadow-none hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
      }
    >
      {label}
      {isUp && <TrendingUp className="ml-0.5 h-3.5 w-3.5" />}
      {isDown && <TrendingDown className="ml-0.5 h-3.5 w-3.5" />}
    </Badge>
  )
}

/** 看板主要指标卡片 */
export function MetricsCards() {
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')

  const [replenishmentCount, setReplenishmentCount] = useState(0)
  const [urgentDelta, setUrgentDelta] = useState(0)
  const [error, setError] = useState(false)

  const [todaySales, setTodaySales] = useState(0)
  const [yesterdaySales, setYesterdaySales] = useState(0)
  const [monthSales, setMonthSales] = useState(0)
  const [previousMonthSales, setPreviousMonthSales] = useState(0)
  const [todayPurchase, setTodayPurchase] = useState(0)
  const [yesterdayPurchase, setYesterdayPurchase] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [receivables, setReceivables] = useState(0)
  const [payables, setPayables] = useState(0)
  const [todaySalesDelta, setTodaySalesDelta] = useState<KpiDelta>({ percent: 0, trend: 'flat' })
  const [monthSalesDelta, setMonthSalesDelta] = useState<KpiDelta>({ percent: 0, trend: 'flat' })
  const [todayPurchaseDelta, setTodayPurchaseDelta] = useState<KpiDelta>({ percent: 0, trend: 'flat' })

  useEffect(() => {
    void (async () => {
      try {
        await ensureReplenishmentRules()
        const suggestions = await getReplenishmentSuggestions({})
        setReplenishmentCount(suggestions.length)
        setUrgentDelta(suggestions.filter(s => s.urgency === 'urgent').length)
      } catch (e) {
        console.error('[Dashboard] 补货建议查询失败:', e)
        setError(true)
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const currentDate = new Date()
        const today = formatLocalDate(currentDate)
        const yesterday = formatLocalDate(addDays(currentDate, -1))
        const monthStart = formatLocalDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
        const previousMonthToDate = getPreviousMonthToDateRange(currentDate)

        const [
          salesTodayRes,
          salesYesterdayRes,
          salesMonthRes,
          salesPreviousMonthRes,
          purchaseTodayRes,
          purchaseYesterdayRes,
          inventoryLowRes,
          receivablesRes,
          payablesRes,
        ] = await Promise.all([
          getSalesReportSummary({ startDate: today, endDate: today, page: 1, pageSize: 1 }),
          getSalesReportSummary({ startDate: yesterday, endDate: yesterday, page: 1, pageSize: 1 }),
          getSalesReportSummary({ startDate: monthStart, endDate: today, page: 1, pageSize: 1 }),
          getSalesReportSummary({
            startDate: previousMonthToDate.start,
            endDate: previousMonthToDate.end,
            page: 1,
            pageSize: 1,
          }),
          getPurchaseReportSummary({ startDate: today, endDate: today, page: 1, pageSize: 1 }),
          getPurchaseReportSummary({ startDate: yesterday, endDate: yesterday, page: 1, pageSize: 1 }),
          getInventoryList({ page: 1, pageSize: 1, alertStatus: 'low' }),
          getReceivables({ page: 1, pageSize: 1 }),
          getPayables({ page: 1, pageSize: 1 }),
        ])

        setTodaySales(salesTodayRes.stats.totalAmount)
        setYesterdaySales(salesYesterdayRes.stats.totalAmount)
        setMonthSales(salesMonthRes.stats.totalAmount)
        setPreviousMonthSales(salesPreviousMonthRes.stats.totalAmount)
        setTodayPurchase(purchaseTodayRes.stats.totalAmount)
        setYesterdayPurchase(purchaseYesterdayRes.stats.totalAmount)
        setTodaySalesDelta(calculateDelta(salesTodayRes.stats.totalAmount, salesYesterdayRes.stats.totalAmount))
        setMonthSalesDelta(calculateDelta(salesMonthRes.stats.totalAmount, salesPreviousMonthRes.stats.totalAmount))
        setTodayPurchaseDelta(calculateDelta(purchaseTodayRes.stats.totalAmount, purchaseYesterdayRes.stats.totalAmount))
        setLowStockCount(inventoryLowRes.total)
        setReceivables(receivablesRes.summary.totalOverdue)
        setPayables(payablesRes.summary.totalOverdue)
      } catch (e) {
        console.error('[Dashboard] KPI 指标查询失败:', e)
        setError(true)
      }
    })()
  }, [])

  return (
    <>
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{tc('loadFailed')}</span>
        </div>
      )}
      {/* 主要 KPI */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('todaySales')}</span>
            <KpiDeltaBadge delta={todaySalesDelta} />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatDashboardUsd(todaySales)}</h3>
            <p className="mt-2 text-[0.625rem] text-slate-400">
              {t('comparisonAmount', { label: t('vsYesterday'), amount: formatDashboardUsd(yesterdaySales) })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('monthSales')}</span>
            <KpiDeltaBadge delta={monthSalesDelta} />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatDashboardUsd(monthSales)}</h3>
            <p className="mt-2 text-[0.625rem] text-slate-400">
              {t('comparisonAmount', { label: t('vsPreviousMonthPeriod'), amount: formatDashboardUsd(previousMonthSales) })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('todayPurchase')}</span>
            <KpiDeltaBadge delta={todayPurchaseDelta} />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatDashboardUsd(todayPurchase)}</h3>
            <p className="mt-2 text-[0.625rem] text-slate-400">
              {t('comparisonAmount', { label: t('vsYesterday'), amount: formatDashboardUsd(yesterdayPurchase) })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-l-4 border-slate-200 border-l-[#944a00] shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('lowStock')}</span>
            <Badge className="border-none bg-orange-50 px-2 py-0.5 font-bold text-orange-600 shadow-none hover:bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400">
              {lowStockCount} <AlertTriangle className="ml-0.5 h-3.5 w-3.5" />
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('lowStockCount', { count: lowStockCount })}</h3>
            <p className="mt-2 text-[0.625rem] text-slate-400">{t('belowSafetyLevel')}</p>
          </CardContent>
        </Card>
      </div>

      {/* 次要 KPI */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold tracking-tight text-slate-500 uppercase">{t('receivables')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{formatDashboardUsd(receivables)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold tracking-tight text-slate-500 uppercase">{t('payables')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{formatDashboardUsd(payables)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold tracking-tight text-slate-500 uppercase">{t('replenishmentPending')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('itemCount', { count: replenishmentCount })}
              {urgentDelta > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">{t('urgentCount', { count: urgentDelta })}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
