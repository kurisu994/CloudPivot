"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 热销产品排行组件 */
export function BestSellers({ className }: { className?: string }) {
  const t = useTranslations("dashboard");

  // mock 数据（将来由后端替换）
  const products = [
    { name: "橡木A级板材", units: 842, percent: 92 },
    { name: "45mm 不锈钢支架", units: 756, percent: 81 },
    { name: "标准餐桌套装", units: 620, percent: 65 },
    { name: "工业胶水 X2", units: 544, percent: 58 },
    { name: "皮革沙发套装", units: 410, percent: 44 },
  ];

  return (
    <Card
      className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ""}`}
    >
      <CardHeader className="pb-6">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
          {t("bestSellers")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((item) => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">
                {item.name}
              </span>
              <span className="font-bold text-[#294985] dark:text-[#6b85c1]">
                {item.units} Units
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-[#294985] dark:bg-[#6b85c1]"
                style={{ width: `${item.percent}%` }}
              ></div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
