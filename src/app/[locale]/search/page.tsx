import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessCard } from "@/components/cards/BusinessCard";
import { LocationCard } from "@/components/cards/LocationCard";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { Grid } from "@/components/ui/Grid";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Link } from "@/i18n/routing";
import { formatNumber, type Locale } from "@/i18n/locales";
import { searchAll } from "@/lib/data";
import { parseParams, searchShape } from "@/lib/data/params";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/search", title: t("nav.search"), description: t("meta.description"), noindex: true });
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, type, page } = parseParams(searchShape, await searchParams);
  const t = await getTranslations();
  const res = await searchAll({ q: q ?? "", type, page });
  const totals = { businesses: res.businesses.total, services: res.services.total, locations: res.locations.total };
  const tabs = [["all", t("search.allTypes")], ["businesses", t("search.inBusinesses")], ["services", t("search.inServices")], ["locations", t("search.inLocations")]] as const;
  const shown = type === "all" ? totals.businesses + totals.services + totals.locations : totals[type];
  const active = res[type === "all" ? "businesses" : type];

  return (
    <>
      <PageHeader title={t("search.title")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("search.title") }]} />
      <form role="search" action="/search" className="container-page mb-4 flex gap-2">
        <label htmlFor="s-q" className="sr-only">{t("search.placeholder")}</label>
        <input id="s-q" name="q" type="search" defaultValue={q} autoFocus={!q} placeholder={t("home.searchPlaceholder")} autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand" />
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("common.search")}</button>
      </form>

      {!q || q.length < 2 ? (
        <div className="container-page"><EmptyState title={t("search.title")} body={t("search.hint")} /></div>
      ) : (
        <>
          <nav aria-label={t("search.title")} className="container-page mb-4"><ul className="flex flex-wrap gap-2">
            {tabs.map(([key, label]) => (
              <li key={key}><Link prefetch={false} href={{ pathname: "/search", query: { q, ...(key === "all" ? {} : { type: key }) } }} aria-current={type === key ? "true" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${type === key ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>{label}</Link></li>
            ))}
          </ul></nav>
          <p aria-live="polite" className="container-page mb-4 text-sm text-muted">{t("search.resultCount", { count: formatNumber(shown, locale as Locale) })}</p>
          {shown === 0 && <div className="container-page"><EmptyState title={t("common.empty")} body={t("search.noResults")} /></div>}
          {res.businesses.items.length > 0 && <section className="mb-10"><h2 className="container-page mb-3 text-lg font-bold">{t("businesses.title")}</h2><Grid>{res.businesses.items.map((b) => <BusinessCard key={b.id} b={b} />)}</Grid></section>}
          {res.services.items.length > 0 && <section className="mb-10"><h2 className="container-page mb-3 text-lg font-bold">{t("services.title")}</h2><Grid>{res.services.items.map((s) => <ServiceCard key={s.id} s={s} />)}</Grid></section>}
          {res.locations.items.length > 0 && <section className="mb-10"><h2 className="container-page mb-3 text-lg font-bold">{t("locations.title")}</h2><Grid>{res.locations.items.map((l) => <LocationCard key={l.id} l={l} />)}</Grid></section>}
          {type !== "all" && <div className="container-page"><Pagination page={active.page} pages={active.pages} pathname="/search" params={{ q, type }} /></div>}
        </>
      )}
    </>
  );
}
