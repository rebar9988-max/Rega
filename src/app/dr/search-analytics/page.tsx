import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, formatNumber, type Locale } from "@/i18n/locales";
import { searchStats } from "@/lib/search-analytics";

/** Search analytics (lib/search-analytics.ts): daily counts only, no data about who searched. */
export default async function SearchAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireDr("analytics.read");
  const days = (await searchParams).days === "30" ? 30 : 7;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const stats = await searchStats(days);
  const n = (v: number) => formatNumber(v, locale);
  const rate = stats.searches ? formatNumber(stats.zeroResults / stats.searches, locale, { style: "percent", maximumFractionDigits: 0 }) : "—";
  const tab = (d: 7 | 30) => (
    <Link href={d === 7 ? "/dr/search-analytics" : "/dr/search-analytics?days=30"} aria-current={days === d ? "page" : undefined}
      className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${days === d ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>
      {t(d === 7 ? "searchAnalytics.last7" : "searchAnalytics.last30")}
    </Link>
  );
  const table = (caption: string, head: string[], rows: (string | number)[][], testId: string) => (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface" data-testid={testId}>
      <h2 className="border-b border-line px-4 py-3 text-base font-bold">{caption}</h2>
      {rows.length === 0 ? <p className="px-4 py-3 text-sm text-muted">{t("searchAnalytics.empty")}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted"><tr>{head.map((h, i) => <th key={h} scope="col" className={`px-4 py-2 font-semibold ${i ? "text-end" : "text-start"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={String(r[0])}>{r.map((c, i) => <td key={i} className={`px-4 py-2 ${i ? "text-end tabular-nums" : "font-semibold"}`}>{i ? c : <bdi>{c}</bdi>}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold">{t("searchAnalytics.title")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">{t("searchAnalytics.intro")}</p>
      <nav aria-label={t("searchAnalytics.title")} className="mb-6 flex flex-wrap gap-2">{tab(7)}{tab(30)}</nav>
      <dl className="mb-6 grid gap-3 sm:grid-cols-3" data-testid="search-totals">
        {[[t("searchAnalytics.searches"), n(stats.searches)], [t("searchAnalytics.zero"), n(stats.zeroResults)], [t("searchAnalytics.zeroRate"), rate]].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        {table(t("searchAnalytics.top"), [t("searchAnalytics.query"), t("searchAnalytics.searches"), t("searchAnalytics.zero")],
          stats.top.map((r) => [r.query, n(r.searches), n(r.zeroResults)]), "search-top")}
        {table(t("searchAnalytics.missing"), [t("searchAnalytics.query"), t("searchAnalytics.zero")],
          stats.missing.map((r) => [r.query, n(r.zeroResults)]), "search-missing")}
      </div>
      <div className="mt-6">
        {table(t("searchAnalytics.perDay"), [t("searchAnalytics.day"), t("searchAnalytics.searches"), t("searchAnalytics.zero")],
          stats.perDay.map((r) => [formatDate(`${r.day}T00:00:00Z`, locale, { timeZone: "UTC" }), n(r.searches), n(r.zeroResults)]), "search-per-day")}
      </div>
    </>
  );
}
