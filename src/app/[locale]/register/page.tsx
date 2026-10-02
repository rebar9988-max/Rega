import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegisterForm } from "@/features/auth/AuthForms";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/register", title: t("registerTitle"), description: await pageDescription(locale, "register") });
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if ((await auth().catch(() => null))?.user) redirect(`/${locale}/account`);
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title={t("registerTitle")} subtitle={t("registerLead")} />
      <div className="container-page"><RegisterForm /></div>
    </>
  );
}
