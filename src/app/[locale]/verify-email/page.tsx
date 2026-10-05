import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmEmailForm } from "@/features/auth/AuthForms";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/verify-email", title: t("verifyTitle"), description: await pageDescription(locale, "verifyEmail"), noindex: true });
}

function safeNext(value?: string): string | undefined {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && value.length <= 300 ? value : undefined;
}

export default async function VerifyEmailPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ email?: string; token?: string; next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { email, token, next } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title={t("verifyTitle")} />
      <div className="container-page">
        {email && token ? <ConfirmEmailForm email={email} token={token} next={safeNext(next)} /> : <p role="alert" className="mx-auto max-w-md rounded-xl bg-brand-soft px-4 py-3 text-center text-sm font-semibold">{t("linkInvalid")}</p>}
      </div>
    </>
  );
}
