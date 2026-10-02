import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResetForm } from "@/features/auth/AuthForms";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/reset-password", title: t("resetTitle"), description: await pageDescription(locale, "resetPassword"), noindex: true });
}

export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ email?: string; token?: string }> }) {
  setRequestLocale((await params).locale);
  const { email, token } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title={t("resetTitle")} />
      <div className="container-page">
        {email && token ? <ResetForm email={email} token={token} /> : <p role="alert" className="mx-auto max-w-md rounded-xl bg-brand-soft px-4 py-3 text-center text-sm font-semibold">{t("linkInvalid")}</p>}
      </div>
    </>
  );
}
