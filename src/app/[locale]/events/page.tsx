import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/config/locales";
import { sectionEnabled } from "@/config/sections";
import { ContentIndex } from "@/features/content/ContentIndex";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { hasPublishedEntries } from "@/lib/indexable";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !sectionEnabled("events")) return {};
  const t = await getTranslations({ locale, namespace: "nav" });
  return pageMetadata({ locale, path: "/events", title: t("events"), description: await pageDescription(locale, "events"), noindex: !(await hasPublishedEntries("events")) });
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !sectionEnabled("events")) notFound();
  setRequestLocale(locale);
  return <ContentIndex section="events" locale={locale} searchParams={await searchParams} />;
}
