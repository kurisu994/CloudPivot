"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const purchaseData = [
  { date: "03-01", value: 1200000000 },
  { date: "03-04", value: 1600000000 },
  { date: "03-08", value: 850000000 },
  { date: "03-12", value: 2150000000 },
  { date: "03-15", value: 3250000000 },
  { date: "03-20", value: 2800000000 },
  { date: "03-22", value: 4250000000 },
  { date: "03-28", value: 3600000000 },
  { date: "03-31", value: 2800000000 },
];

/** 近30天采购趋势面积图 */
export function PurchaseTrendChart({ className }: { className?: string }) {
  const t = useTranslations("dashboard");

  const purchaseConfig = {
    value: { label: t("purchaseAmount"), color: "#944a00" },
  } satisfies ChartConfig;

  return (
    <Card
      className={`mt-6 rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ""}`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
          {t("purchaseTrend")}
        </CardTitle>
        <span className="text-xs text-slate-400">{t("unitVND")}</span>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={purchaseConfig}
          className="h-[250px] min-h-[250px] w-full min-w-full"
        >
          <AreaChart
            accessibilityLayer
            data={purchaseData}
            margin={{ top: 10, left: 0, right: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillPurchase" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-value)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              opacity={0.3}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              fontSize={11}
              className="font-bold text-slate-400"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              fontSize={11}
              className="text-slate-400"
              tickFormatter={(val) => `${(val / 1000000000).toFixed(1)}B`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className="min-w-[150px]" />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill="url(#fillPurchase)"
              fillOpacity={1}
              activeDot={{ r: 6, strokeWidth: 0, fill: "var(--color-value)" }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
