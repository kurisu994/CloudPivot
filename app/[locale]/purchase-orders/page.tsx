import { setRequestLocale } from 'next-intl/server'
import { PurchaseOrdersContent } from './_components/purchase-orders-content'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PurchaseOrdersContent />
}
