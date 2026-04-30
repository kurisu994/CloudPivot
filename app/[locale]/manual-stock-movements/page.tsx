import { setRequestLocale } from 'next-intl/server'
import { ManualStockMovementContent } from './_components/manual-stock-movement-content'

/**
 * 自由出入库页面
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <ManualStockMovementContent />
}
