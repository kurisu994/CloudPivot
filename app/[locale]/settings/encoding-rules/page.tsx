import { setRequestLocale } from "next-intl/server";
import { PagePlaceholder } from "@/components/common/page-placeholder";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PagePlaceholder titleKey="nav.encodingRules" />;
}
