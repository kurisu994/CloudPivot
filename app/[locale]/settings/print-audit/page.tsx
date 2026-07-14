import { setRequestLocale } from 'next-intl/server'
import { PrintAuditContent } from '../_components/print-audit-content'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PrintAuditContent />
}
