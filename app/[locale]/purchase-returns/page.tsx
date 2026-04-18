import { setRequestLocale } from 'next-intl/server'
import { PurchaseReturnsContent } from './_components/purchase-returns-content'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PurchaseReturnsContent />
}
