// Review by a German lawyer before relying on this text.
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportForm } from "@/features/reports/ReportForm";
import { isLocale } from "@/config/locales";
import { pageDescription } from "@/lib/seo-server";
import { pageMetadata, siteOrigin } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "report" });
  return pageMetadata({ locale, path: "/report", title: t("title"), description: await pageDescription(locale, "report") });
}

/** Only addresses on this site are pre-filled from `?url=` (the "report this content" links); anything else is left empty. */
function safePrefill(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || v.length > 500) return undefined;
  try {
    return new URL(v).origin === siteOrigin() ? v : undefined;
  } catch {
    return undefined;
  }
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("report");
  const tn = await getTranslations("nav");
  const url = safePrefill((await searchParams).url);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("intro")} crumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]} />
      <div className="container-page max-w-3xl pb-8">
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">{t("notice")}</p>
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6">
          <ReportForm defaultUrl={url} />
        </section>
      </div>
    </>
  );
}
