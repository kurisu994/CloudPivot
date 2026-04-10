"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

import { MetricsCards } from "./dashboard/metrics-cards";
import { QuickActions } from "./dashboard/quick-actions";
import { SalesTrendChart } from "./dashboard/sales-trend-chart";
import { InventoryDonut } from "./dashboard/inventory-donut";
import { BestSellers } from "./dashboard/best-sellers";
import { PendingTasks } from "./dashboard/pending-tasks";
import { PurchaseTrendChart } from "./dashboard/purchase-trend-chart";

export function DashboardContent() {
  const t = useTranslations();

  return (
    <div className="space-y-6 pb-8">
      {/* Dashboard Header */}
      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {t("dashboard.title")}
        </h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-none bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            <RefreshCcw className="h-4 w-4" />
            {t("dashboard.refreshData")}
          </Button>
        </div>
      </div>

      {/* Row 1 & 2: Primary and Secondary KPIs */}
      <MetricsCards />

      {/* Quick Action Bar */}
      <QuickActions />

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
  );
}
