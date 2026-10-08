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
  if (!isLocale(locale) || !sectionEnabled("jobs")) return {};
  const t = await getTranslations({ locale, namespace: "nav" });
  return pageMetadata({ locale, path: "/jobs", title: t("jobs"), description: await pageDescription(locale, "jobs"), noindex: !(await hasPublishedEntries("jobs")) });
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !sectionEnabled("jobs")) notFound();
  setRequestLocale(locale);
  return <ContentIndex section="jobs" locale={locale} searchParams={await searchParams} />;
}
