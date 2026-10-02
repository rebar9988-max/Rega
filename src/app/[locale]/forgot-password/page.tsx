import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForgotForm } from "@/features/auth/AuthForms";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/forgot-password", title: t("forgotTitle"), description: await pageDescription(locale, "forgotPassword"), noindex: true });
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title={t("forgotTitle")} />
      <div className="container-page"><ForgotForm /></div>
    </>
  );
}
