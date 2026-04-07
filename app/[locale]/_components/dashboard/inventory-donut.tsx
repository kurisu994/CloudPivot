"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pie, PieChart, Label } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

/** 库存分布环形图 */
export function InventoryDonut({ className }: { className?: string }) {
  const t = useTranslations("dashboard");

  // mock 数据（将来由后端替换）
  const inventoryData = [
    { name: "实木板材", value: 1200000, fill: "#294985" },
    { name: "成品家具", value: 980000, fill: "#43619f" },
    { name: "五金配件", value: 750000, fill: "#944a00" },
    { name: "其他耗材", value: 520000, fill: "#cbd5e1" },
  ];

  const inventoryConfig = {
    value: { label: t("assetEstimate") },
  } satisfies ChartConfig;

  return (
    <Card className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
          {t("stockDistribution")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-0 pb-6">
        <ChartContainer
          config={inventoryConfig}
          className="mx-auto w-full min-w-[200px] h-[220px] min-h-[220px]"
        >
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={inventoryData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              strokeWidth={2}
              paddingAngle={2}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-800 dark:fill-slate-100 text-2xl font-bold">
                          100%
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-slate-500 dark:fill-slate-400 text-xs font-medium">
                          {t("totalStock")}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        
        <div className="w-full px-6 space-y-2.5 mt-2">
          {inventoryData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.fill }} />
                {item.name}
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                ${(item.value / 1000).toFixed(0)}K
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
