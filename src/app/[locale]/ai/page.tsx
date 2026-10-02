import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import type { Locale } from "@/i18n/locales";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiChat } from "@/components/ai/AiChat";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/ai", title: t("ai.title"), description: await pageDescription(locale as Locale, "ai") });
}

export default async function AiPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return (
    <>
      <PageSchema name={t("ai.title")} path="/ai" crumbs={[{ name: t("ai.title"), path: "/ai" }]} />
      <PageHeader title={t("ai.title")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("ai.title") }]} />
      <div className="container-page"><AiChat /></div>
    </>
  );
}
