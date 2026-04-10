"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ShoppingCart,
  ReceiptText,
  PackagePlus,
  PackageMinus,
} from "lucide-react";

/** 看板快捷操作栏 */
export function QuickActions() {
  const t = useTranslations("dashboard");

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-slate-400" />
        <span className="text-xs font-bold tracking-widest text-slate-600 uppercase dark:text-slate-400">
          {t("quickActions")}
        </span>
      </div>
      <div className="flex flex-wrap gap-4">
        <Button className="h-[40px] gap-2 rounded-lg border-none bg-[#294985] px-4 font-semibold text-white shadow-md hover:bg-[#294985]/90">
          <ShoppingCart className="h-[18px] w-[18px]" />
          {t("newPurchaseOrder")}
        </Button>
        <Button
          variant="outline"
          className="h-[40px] gap-2 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <ReceiptText className="h-[18px] w-[18px] text-[#294985] dark:text-[#43619f]" />
          {t("newSalesOrder")}
        </Button>
        <Button
          variant="outline"
          className="h-[40px] gap-2 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <PackagePlus className="h-[18px] w-[18px] text-[#944a00] dark:text-orange-500" />
          {t("purchaseReceipt")}
        </Button>
        <Button
          variant="outline"
          className="h-[40px] gap-2 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <PackageMinus className="h-[18px] w-[18px] text-[#944a00] dark:text-orange-500" />
          {t("salesDelivery")}
        </Button>
      </div>
    </div>
  );
}
