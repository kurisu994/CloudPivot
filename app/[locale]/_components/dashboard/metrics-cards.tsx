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

/** 看板主要指标卡片 */
export function MetricsCards() {
  const t = useTranslations('dashboard')

  const [replenishmentCount, setReplenishmentCount] = useState(0)
  const [urgentDelta, setUrgentDelta] = useState(0)

  const [todaySales, setTodaySales] = useState(0)
  const [monthSales, setMonthSales] = useState(0)
  const [todayPurchase, setTodayPurchase] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [receivables, setReceivables] = useState(0)
  const [payables, setPayables] = useState(0)

  useEffect(() => {
    void (async () => {
      try {
        await ensureReplenishmentRules()
        const suggestions = await getReplenishmentSuggestions({})
        setReplenishmentCount(suggestions.length)
        setUrgentDelta(suggestions.filter(s => s.urgency === 'urgent').length)
      } catch {
        // 非 Tauri 环境下降级为 0
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const monthStart = `${today.slice(0, 7)}-01`

        const [salesTodayRes, salesMonthRes, purchaseTodayRes, inventoryLowRes, receivablesRes, payablesRes] = await Promise.all([
          getSalesReportSummary({ start_date: today, end_date: today, page: 1, page_size: 1 }),
          getSalesReportSummary({ start_date: monthStart, end_date: today, page: 1, page_size: 1 }),
          getPurchaseReportSummary({ start_date: today, end_date: today, page: 1, page_size: 1 }),
          getInventoryList({ page: 1, pageSize: 1, alertStatus: 'low' }),
          getReceivables({ page: 1, page_size: 1 }),
          getPayables({ page: 1, page_size: 1 }),
        ])

        setTodaySales(salesTodayRes.stats.total_amount)
        setMonthSales(salesMonthRes.stats.total_amount)
        setTodayPurchase(purchaseTodayRes.stats.total_amount)
        setLowStockCount(inventoryLowRes.total)
        setReceivables(receivablesRes.summary.total_overdue)
        setPayables(payablesRes.summary.total_overdue)
      } catch {
        // 非 Tauri 环境下降级为 0
      }
    })()
  }, [])

  return (
    <>
      {/* 主要 KPI */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('todaySales')}</span>
            <Badge className="border-none bg-emerald-50 px-2 py-0.5 font-bold text-emerald-600 shadow-none hover:bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400">
              +5.2% <TrendingUp className="ml-0.5 h-3.5 w-3.5" />
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">${(todaySales / 100).toLocaleString()}</h3>
            <p className="mt-2 text-[10px] text-slate-400">{t('vsYesterday')}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('monthSales')}</span>
            <Badge className="border-none bg-emerald-50 px-2 py-0.5 font-bold text-emerald-600 shadow-none hover:bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400">
              +12.8% <TrendingUp className="ml-0.5 h-3.5 w-3.5" />
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">${(monthSales / 100).toLocaleString()}</h3>
            <p className="mt-2 text-[10px] text-slate-400">{t('progress', { percent: '85', target: '$4.2M' })}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('todayPurchase')}</span>
            <Badge className="border-none bg-rose-50 px-2 py-0.5 font-bold text-rose-600 shadow-none hover:bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400">
              -3.1% <TrendingDown className="ml-0.5 h-3.5 w-3.5" />
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">${(todayPurchase / 100).toLocaleString()}</h3>
            <p className="mt-2 text-[10px] text-slate-400">{t('mainMaterial')}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-l-4 border-slate-200 border-l-[#944a00] shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
            <span className="text-xs font-semibold tracking-wider text-slate-500">{t('lowStock')}</span>
            <Badge className="border-none bg-orange-50 px-2 py-0.5 font-bold text-orange-600 shadow-none hover:bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400">
              +3 <AlertTriangle className="ml-0.5 h-3.5 w-3.5" />
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('lowStockCount', { count: lowStockCount })}</h3>
            <p className="mt-2 text-[10px] text-slate-400">{t('belowSafetyLevel')}</p>
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
            <p className="text-[11px] font-bold tracking-tight text-slate-500 uppercase">{t('receivables')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">${(receivables / 100).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-tight text-slate-500 uppercase">{t('payables')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">${(payables / 100).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-tight text-slate-500 uppercase">{t('replenishmentPending')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('itemCount', { count: replenishmentCount })}
              {urgentDelta > 0 && <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">({urgentDelta} urgent)</span>}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
