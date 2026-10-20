import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { LogoMark } from "@/components/ui/Logo";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegisterForm } from "@/features/auth/AuthForms";
import { SocialButtons } from "@/features/auth/SocialButtons";
import { enabledOAuthProviders, socialErrorKeyOrGeneric } from "@/features/auth/oauth-core";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/register", title: t("registerTitle"), description: await pageDescription(locale, "register") });
}

function safeNext(value?: string): string | undefined {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && value.length <= 300 ? value : undefined;
}

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  const { next, error } = await searchParams;
  setRequestLocale(locale);
  if ((await auth().catch(() => null))?.user) redirect(`/${locale}/account`);
  const t = await getTranslations("auth");
  const providers = enabledOAuthProviders(process.env);
  const errorKey = socialErrorKeyOrGeneric(error);
  return (
    <>
      <PageHeader title={t("registerHeading")} subtitle={t("registerLead")} />
      <div className="container-page">
        <div className="mx-auto mb-4 flex max-w-md justify-center"><LogoMark className="size-14" /></div>
        {errorKey && <p role="alert" className="mx-auto mb-4 max-w-md rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(errorKey)}</p>}
        <RegisterForm next={safeNext(next)} social={providers.length ? <SocialButtons providers={providers} intent="register" /> : undefined} />
      </div>
    </>
  );
}
