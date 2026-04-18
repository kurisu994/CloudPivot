import { setRequestLocale } from 'next-intl/server'
import { PurchaseReceiptsContent } from './_components/purchase-receipts-content'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PurchaseReceiptsContent />
}
