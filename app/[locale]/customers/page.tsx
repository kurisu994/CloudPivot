import { setRequestLocale } from 'next-intl/server'
import { CustomersContent } from './_components/customers-content'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CustomersContent />
}
