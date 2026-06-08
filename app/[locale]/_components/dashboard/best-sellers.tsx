'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesMaterialDetail } from '@/lib/tauri'
import { addDays, formatLocalDate } from './format'

interface BestSellerItem {
  name: string
  unitName: string
  units: number
  percent: number
}

/** 热销产品排行组件 */
export function BestSellers({ className }: { className?: string }) {
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')
  const [products, setProducts] = useState<BestSellerItem[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    void (async () => {
      try {
        const currentDate = new Date()
        const end = formatLocalDate(currentDate)
        const start = formatLocalDate(addDays(currentDate, -30))
        const res = await getSalesMaterialDetail({ startDate: start, endDate: end, page: 1, pageSize: 5 })
        if (res.items.length === 0) {
          setProducts([])
          return
        }
        const maxAmount = Math.max(...res.items.map(i => i.amount))
        const mapped = res.items.map(item => ({
          name: item.materialName,
          unitName: item.unitName,
          units: Math.round(item.quantity),
          percent: maxAmount > 0 ? Math.round((item.amount / maxAmount) * 100) : 0,
        }))
        setProducts(mapped)
      } catch (e) {
        console.error('[Dashboard] 热销产品查询失败:', e)
        setProducts([])
        setError(true)
      }
    })()
  }, [])

  return (
    <Card className={`rounded-xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 ${className || ''}`}>
      <CardHeader className="pb-6">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">{t('bestSellers')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-muted-foreground text-center text-sm">{tc('loadFailed')}</p>}
        {!error && products.length === 0 && <p className="text-muted-foreground text-center text-sm">{t('noData')}</p>}
        {products.map(item => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
              <span className="font-bold text-[#294985] dark:text-[#6b85c1]">
                {t('quantityWithUnit', { quantity: item.units, unit: item.unitName })}
              </span>
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
