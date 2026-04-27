'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Label, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { getInventoryList } from '@/lib/tauri'

interface DonutItem {
  name: string
  value: number
  fill: string
}

const COLORS = ['#294985', '#43619f', '#944a00', '#cbd5e1', '#6b85c1', '#b45309']

/** 库存分布环形图 */
export function InventoryDonut({ className }: { className?: string }) {
  const t = useTranslations('dashboard')
  const [data, setData] = useState<DonutItem[]>([])
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    void (async () => {
      try {
        const res = await getInventoryList({ page: 1, pageSize: 1000 })
        // 按分类聚合库存价值
        const map = new Map<string, number>()
        for (const item of res.items) {
          const cat = item.category_name ?? t('uncategorized')
          map.set(cat, (map.get(cat) ?? 0) + (item.inventory_value ?? 0))
        }
        const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        const mapped = sorted.map(([name, value], idx) => ({
          name,
          value,
          fill: COLORS[idx % COLORS.length],
        }))
        setData(mapped)
        setTotalValue(mapped.reduce((sum, d) => sum + d.value, 0))
      } catch {
        setData([])
        setTotalValue(0)
      }
    })()
  }, [t])

  const inventoryConfig = {
    value: { label: t('assetEstimate') },
  } satisfies ChartConfig

  return (
    <Card className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">{t('stockDistribution')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-0 pb-6">
        <ChartContainer config={inventoryConfig} className="mx-auto h-[220px] min-h-[220px] w-full min-w-[200px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} strokeWidth={2} paddingAngle={2}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-800 text-2xl font-bold dark:fill-slate-100">
                          ${(totalValue / 100000).toFixed(1)}M
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-slate-500 text-xs font-medium dark:fill-slate-400">
                          {t('totalStock')}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="mt-2 w-full space-y-2.5 px-6">
          {data.map(item => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.fill }} />
                {item.name}
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">${(item.value / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
