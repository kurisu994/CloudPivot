"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileCheck, Truck, AlertCircle } from "lucide-react";

/** 待办事项面板 */
export function PendingTasks({ className }: { className?: string }) {
  const t = useTranslations("dashboard");

  return (
    <Card
      className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ""}`}
    >
      <CardHeader className="pb-4">
        <CardTitle className="border-b border-slate-100 pb-3 text-sm font-bold tracking-wider text-slate-800 uppercase dark:border-slate-800 dark:text-slate-100">
          {t("pendingTasks")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3 rounded border-l-4 border-l-red-500 bg-red-50 p-3 dark:bg-red-500/10">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-500" />
          <div>
            <p className="text-xs font-bold text-red-900 dark:text-red-400">
              {t("stockAlertTitle", { count: 12 })}
            </p>
            <p className="mt-0.5 text-[10px] text-red-700 dark:text-red-500/80">
              {t("stockAlertDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded border-l-4 border-l-orange-500 bg-orange-50 p-3 dark:bg-orange-500/10">
          <FileCheck className="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-500" />
          <div>
            <p className="text-xs font-bold text-orange-900 dark:text-orange-400">
              {t("purchaseAuditTitle", { count: 3 })}
            </p>
            <p className="mt-0.5 text-[10px] text-orange-700 dark:text-orange-500/80">
              {t("purchaseAuditDesc", { amount: "$45,000" })}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded border-l-4 border-l-blue-500 bg-blue-50 p-3 dark:bg-blue-500/10">
          <Truck className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-500" />
          <div>
            <p className="text-xs font-bold text-blue-900 dark:text-blue-400">
              {t("deliveryConfirmTitle", { count: 5 })}
            </p>
            <p className="mt-0.5 text-[10px] text-blue-700 dark:text-blue-500/80">
              {t("deliveryConfirmDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded border-l-4 border-l-slate-400 bg-slate-50 p-3 dark:bg-slate-800">
          <AlertCircle className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-300">
              {t("overdueReceivableTitle", { count: 2 })}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400">
              {t("overdueReceivableDesc", { days: 45 })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
