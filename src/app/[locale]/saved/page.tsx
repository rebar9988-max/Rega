import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { SavedList } from "@/features/saved/SavedList";
import { LOCALE_META, isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "saved" });
  // Personal, per-browser content: never indexed.
  return pageMetadata({ locale, path: "/saved", title: t("title"), description: t("intro"), noindex: true });
}

/** Saved businesses of this browser (localStorage only, no account). */
export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("saved");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("intro")} crumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]} />
      <div className="container-page max-w-4xl pb-8">
        <SavedList
          locale={locale}
          pageLang={LOCALE_META[locale].htmlLang}
          labels={{ loading: tc("loading"), empty: t("empty"), browse: t("browse"), remove: t("remove"), clearAll: t("clearAll"), error: tc("error"), retry: tc("retry"), unavailable: t("unavailable") }}
        />
      </div>
    </>
  );
}
