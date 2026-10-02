import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/config/locales";
import { sectionEnabled } from "@/config/sections";
import { ContentDetail, entryMetadata } from "@/features/content/ContentDetail";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !sectionEnabled("jobs")) return {};
  return entryMetadata("jobs", locale, slug);
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !sectionEnabled("jobs")) notFound();
  setRequestLocale(locale);
  return <ContentDetail section="jobs" locale={locale} slug={slug} />;
}
