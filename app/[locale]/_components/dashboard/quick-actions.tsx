'use client'

import { PackageMinus, PackagePlus, ReceiptText, ShoppingCart, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/** 看板快捷操作栏 */
export function QuickActions() {
  const t = useTranslations('dashboard')

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-slate-400" />
        <span className="text-xs font-bold tracking-widest text-slate-600 uppercase dark:text-slate-400">{t('quickActions')}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/purchase-orders?action=new"
          className={cn(
            buttonVariants({ variant: 'default', size: 'default' }),
            'h-[2.5rem] gap-2 rounded-lg border-none bg-[#294985] px-4 font-semibold text-white shadow-md hover:bg-[#294985]/90',
          )}
        >
          <ShoppingCart className="h-[1.125rem] w-[1.125rem]" />
          {t('newPurchaseOrder')}
        </Link>
        <Link
          href="/sales-orders?action=new"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'default' }),
            'h-[2.5rem] gap-2 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
          )}
        >
          <ReceiptText className="h-[1.125rem] w-[1.125rem] text-[#294985] dark:text-[#43619f]" />
          {t('newSalesOrder')}
        </Link>
        <Link
          href="/purchase-receipts"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'default' }),
            'h-[2.5rem] gap-2 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
          )}
        >
          <PackagePlus className="h-[1.125rem] w-[1.125rem] text-[#944a00] dark:text-orange-500" />
          {t('purchaseReceipt')}
        </Link>
        <Link
          href="/sales-deliveries"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'default' }),
            'h-[2.5rem] gap-2 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
          )}
        >
          <PackageMinus className="h-[1.125rem] w-[1.125rem] text-[#944a00] dark:text-orange-500" />
          {t('salesDelivery')}
        </Link>
      </div>
    </div>
  )
}
