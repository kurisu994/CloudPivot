import { setRequestLocale } from "next-intl/server";
import { SettingsContent } from "./_components/settings-content";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsContent />;
}
