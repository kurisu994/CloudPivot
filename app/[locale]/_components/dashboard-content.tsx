'use client'

import { RefreshCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { BestSellers } from './dashboard/best-sellers'
import { InventoryDonut } from './dashboard/inventory-donut'
import { MetricsCards } from './dashboard/metrics-cards'
import { PendingTasks } from './dashboard/pending-tasks'
import { PurchaseTrendChart } from './dashboard/purchase-trend-chart'
// 快捷操作暂时隐藏：其链接的采购/销售等菜单尚未开放，待菜单分批开放后恢复
// import { QuickActions } from './dashboard/quick-actions'
import { SalesTrendChart } from './dashboard/sales-trend-chart'

export function DashboardContent() {
  const t = useTranslations()

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-none bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            <RefreshCcw className="h-4 w-4" />
            {t('dashboard.refreshData')}
          </Button>
        </div>
      </div>

      {/* Row 1 & 2: Primary and Secondary KPIs */}
      <MetricsCards />

      {/* Quick Action Bar —— 暂时隐藏：对应采购/销售等菜单尚未开放，待菜单分批开放后恢复 */}
      {/* <QuickActions /> */}

      {/* Row 3: Sales Trend & Inventory Distribution */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <SalesTrendChart className="md:col-span-8" />
        <InventoryDonut className="md:col-span-4" />
      </div>

      {/* Row 4: Top 10 Best Sellers & Pending Tasks */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <BestSellers className="md:col-span-8" />
        <PendingTasks className="md:col-span-4" />
      </div>

      {/* Row 5: Purchase Trend Area Chart */}
      <PurchaseTrendChart />
    </div>
  )
}
