'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { getSalesReportSummary } from '@/lib/tauri'

interface TrendPoint {
  label: string
  current: number
}

/** 近30天销售趋势柱状图 */
export function SalesTrendChart({ className }: { className?: string }) {
  const t = useTranslations('dashboard')
  const [data, setData] = useState<TrendPoint[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const end = new Date().toISOString().slice(0, 10)
        const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const res = await getSalesReportSummary({ start_date: start, end_date: end, page: 1, page_size: 1 })
        const points = res.trend.map(p => ({
          label: p.date.slice(5),
          current: p.amount,
        }))
        setData(points)
      } catch {
        // 降级为空数据
      }
    })()
  }, [])

  const salesConfig = {
    current: { label: t('currentPeriod'), color: '#294985' },
  } satisfies ChartConfig

  return (
    <Card className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">{t('salesTrend')}</CardTitle>
        <span className="text-xs text-slate-400">{t('unitUSD')}</span>
      </CardHeader>
      <CardContent>
        <ChartContainer config={salesConfig} className="h-[250px] min-h-[250px] w-full min-w-full">
          <BarChart accessibilityLayer data={data} margin={{ top: 20, left: -20, right: 10 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={15}
              axisLine={false}
              fontSize={12}
              fontWeight={600}
              className="tracking-wider text-slate-400 uppercase"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              fontSize={11}
              className="text-slate-400"
              tickFormatter={value => `$${value / 1000}k`}
            />
            <ChartTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={<ChartTooltipContent indicator="dashed" className="w-[180px]" />} />
            <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
