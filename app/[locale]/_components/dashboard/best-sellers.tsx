'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesMaterialDetail } from '@/lib/tauri'

interface BestSellerItem {
  name: string
  units: number
  percent: number
}

/** 热销产品排行组件 */
export function BestSellers({ className }: { className?: string }) {
  const t = useTranslations('dashboard')
  const [products, setProducts] = useState<BestSellerItem[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const end = new Date().toISOString().slice(0, 10)
        const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const res = await getSalesMaterialDetail({ start_date: start, end_date: end, page: 1, page_size: 5 })
        if (res.items.length === 0) {
          setProducts([])
          return
        }
        const maxAmount = Math.max(...res.items.map(i => i.amount))
        const mapped = res.items.map(item => ({
          name: item.material_name,
          units: Math.round(item.quantity),
          percent: maxAmount > 0 ? Math.round((item.amount / maxAmount) * 100) : 0,
        }))
        setProducts(mapped)
      } catch {
        setProducts([])
      }
    })()
  }, [])

  return (
    <Card className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ''}`}>
      <CardHeader className="pb-6">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">{t('bestSellers')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 && <p className="text-muted-foreground text-center text-sm">{t('noData')}</p>}
        {products.map(item => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
              <span className="font-bold text-[#294985] dark:text-[#6b85c1]">{item.units} Units</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-[#294985] dark:bg-[#6b85c1]" style={{ width: `${item.percent}%` }}></div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
