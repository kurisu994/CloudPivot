'use client'

import { RefreshCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/use-permission'
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
  const { can } = usePermission()
  // 各部件可见性与内部取数门控一致，用于行布局自适应（部件无权时整行收起，余下部件拉通）
  const canViewReports = can('reports', 'view')
  const canViewInventory = can('inventory', 'view')
  const showPendingTasks = canViewInventory || can('purchase_orders', 'view') || can('sales_deliveries', 'view') || can('receivables', 'view')

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
      {(canViewReports || canViewInventory) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {canViewReports && <SalesTrendChart className={canViewInventory ? 'md:col-span-8' : 'md:col-span-12'} />}
          {canViewInventory && <InventoryDonut className={canViewReports ? 'md:col-span-4' : 'md:col-span-12'} />}
        </div>
      )}

      {/* Row 4: Top 10 Best Sellers & Pending Tasks */}
      {(canViewReports || showPendingTasks) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {canViewReports && <BestSellers className={showPendingTasks ? 'md:col-span-8' : 'md:col-span-12'} />}
          {showPendingTasks && <PendingTasks className={canViewReports ? 'md:col-span-4' : 'md:col-span-12'} />}
        </div>
      )}

      {/* Row 5: Purchase Trend Area Chart */}
      {canViewReports && <PurchaseTrendChart />}
    </div>
  )
}
