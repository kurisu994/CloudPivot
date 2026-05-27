import { setRequestLocale } from 'next-intl/server'
import { ManualStockMovementsPage } from './_components/manual-stock-movements-page'

/**
 * 批量出入库页面
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <ManualStockMovementsPage />
}
