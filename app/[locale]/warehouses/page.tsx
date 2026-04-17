import { setRequestLocale } from 'next-intl/server'
import { WarehousesContent } from './_components/warehouses-content'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <WarehousesContent />
}
