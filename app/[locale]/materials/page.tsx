import { setRequestLocale, getTranslations } from "next-intl/server";
import { MaterialsClientPage } from "./_components/materials-client-page";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "materials" });
  return {
    title: `${t("title")} - CloudPivot IMS`,
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MaterialsClientPage />;
}
