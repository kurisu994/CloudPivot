import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { PrintDesignerContent } from '../../_components/print-designer-content'

const TEMPLATE_KEYS = [
  'manual_stock_movement',
  'purchase_order',
  'purchase_receipt',
  'purchase_return',
  'sales_order',
  'sales_delivery',
  'sales_return',
  'stock_check',
  'stock_transfer',
  'production_order',
] as const

const LOCALES = ['zh', 'vi', 'en'] as const

/**
 * SSG 必需：列举所有 (locale × template_key) 组合，避免动态段在静态导出时构建失败。
 * 10 个 key × 3 locale = 30 个静态页。
 */
export function generateStaticParams() {
  return LOCALES.flatMap(locale => TEMPLATE_KEYS.map(key => ({ locale, key })))
}

export default async function Page({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params
  setRequestLocale(locale)

  if (!TEMPLATE_KEYS.includes(key as (typeof TEMPLATE_KEYS)[number])) {
    notFound()
  }

  return <PrintDesignerContent templateKey={key as (typeof TEMPLATE_KEYS)[number]} />
}
