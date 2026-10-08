import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageSchema } from "@/components/ui/PageSchema";
import { BusinessCard } from "@/components/cards/BusinessCard";
import { categoryOptions, cityOptions } from "@/components/ui/FilterBar";
import { NoResults } from "@/components/ui/Grid";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { CityFilter } from "@/components/ui/CityFilter";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { Link } from "@/i18n/routing";
import { formatNumber, type Locale } from "@/i18n/locales";
import { PageHeader, type Crumb } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, listBusinesses, listSelectorCities, type BusinessQuery } from "@/lib/data";
import { businessShape, parseParams } from "@/lib/data/params";

const SORTS = ["featured", "rating", "newest", "name"] as const;

export type BusinessIndexProps = {
  /** Path of this page without the locale, e.g. "/businesses/legal"; filters and pagination stay on it. */
  pathname: string;
  searchParams: Record<string, string | string[] | undefined>;
  title: string;
  crumbs: Crumb[];
  /** Filters fixed by the URL itself (category / city page): applied, and their dropdown is not shown. */
  fixed?: { category?: string; city?: string };
  subtitle?: string;
};

/**
 * The business list used by /businesses, /businesses/[category], /city/[city] and /city/[city]/[category]: one component,
 * so filters, counts, empty states and pagination behave identically everywhere.
 */
export async function BusinessIndex({ pathname, searchParams, title, crumbs, fixed, subtitle }: BusinessIndexProps) {
  const parsed = parseParams(businessShape, searchParams);
  const query: BusinessQuery = { ...parsed, ...(fixed?.category ? { category: fixed.category } : {}), ...(fixed?.city ? { city: fixed.city } : {}) };
  const t = await getTranslations();
  const [categories, cities] = await Promise.all([
    getCategories(),
    fixed?.city
      ? Promise.resolve([])
      : listSelectorCities({
          countryCode: DEFAULT_PUBLIC_COUNTRY_CODE,
          categoryId: fixed?.category ?? query.category,
          q: query.q,
          verified: query.verified,
        }),
  ]);

  const formId = "directory-filters";
  const categoryList = fixed?.category ? undefined : await categoryOptions(categories);
  const cityList = fixed?.city ? undefined : await cityOptions(cities);
  const active = Boolean(query.q || query.verified || (!fixed?.category && query.category) || (!fixed?.city && query.city));
  const field = "min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10";

  return (
    <>
      <PageSchema type="CollectionPage" name={title} path={pathname} crumbs={crumbs.map((c) => ({ name: String(c.label), path: c.href ?? pathname }))} />
      <PageHeader title={title} subtitle={subtitle ?? t("businesses.lead")} crumbs={crumbs} />
      <div className="container-page">
        {/* Search first (approved concept, page 3): what + where. Every other filter joins this form via `form=`. */}
        <form id={formId} action={pathname} role="search"
          className={`rega-search-shell grid gap-0 overflow-visible ${cityList ? "sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
          <div className="flex min-h-14 min-w-0 items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
            <FigmaIcon name="search" className="size-5 shrink-0 text-brand" />
            <label htmlFor="f-q" className="sr-only">{t("search.placeholder")}</label>
            <input id="f-q" name="q" type="search" defaultValue={query.q} placeholder={t("search.placeholder")} autoComplete="off" maxLength={120}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </div>
          {cityList && (
            <div className="flex min-h-14 min-w-0 items-center gap-2 border-t border-line px-3 sm:border-s sm:border-t-0">
              <FigmaIcon name="map-pin" className="size-5 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <CityFilter cities={cityList} value={query.city} allLabel={t("list.allCities")} cityLabel={t("locations.city")}
                  fieldClass="min-h-11 w-full bg-transparent px-1 text-sm outline-none" />
              </div>
            </div>
          )}
          <button type="submit" className="min-h-12 rounded-b-[0.7rem] bg-brand px-8 text-[15px] font-bold text-brand-ink transition hover:bg-brand-hover sm:m-1.5 sm:rounded-[0.55rem]">{t("nav.search")}</button>
        </form>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
          {/* Progressive filters. */}
          <aside aria-labelledby="dir-filters-title" className="rega-card p-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-3">
              <h2 id="dir-filters-title" className="text-base font-bold">{t("list.filters")}</h2>
              {active && <Link href={pathname} className="text-sm font-semibold text-brand hover:underline">{t("list.reset")}</Link>}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {categoryList && (
                <div>
                  <label htmlFor="f-cat" className="mb-1.5 block text-sm font-semibold">{t("services.category")}</label>
                  <select id="f-cat" name="category" form={formId} defaultValue={query.category ?? ""} className={field}>
                    <option value="">{t("list.allCategories")}</option>
                    {categoryList.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold sm:self-end">
                {t("list.verifiedOnly")}
                <input type="checkbox" role="switch" name="verified" value="1" form={formId} defaultChecked={query.verified === "1"} className="rega-switch" />
              </label>
            </div>
            <button type="submit" form={formId} className="mt-4 min-h-11 w-full rounded-lg border border-brand bg-surface px-4 text-sm font-bold text-brand transition hover:bg-brand hover:text-brand-ink">{t("list.apply")}</button>
          </aside>

          <div className="min-w-0">
            {/* Streamed results: filters render instantly, the list shows a skeleton while the query runs. */}
            <Suspense key={JSON.stringify(query)} fallback={<ResultsSkeleton />}>
              <Results query={query} pathname={pathname} fixed={fixed} heading={title} formId={formId} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="h-11 animate-pulse rounded-lg bg-surface-2" />
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-surface-2" />)}
    </div>
  );
}

async function Results({ query, pathname, fixed, heading, formId }: { query: BusinessQuery; pathname: string; fixed?: BusinessIndexProps["fixed"]; heading: string; formId: string }) {
  const result = await listBusinesses(query);
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const filtered = Boolean(query.q || query.verified || (!fixed?.category && query.category) || (!fixed?.city && query.city));
  const empty = result.items.length === 0;
  return (
    <>
      {/* Keeps the heading order h1 -> h2 -> h3 (card titles) for screen readers. */}
      <h2 className="sr-only">{heading}</h2>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold text-ink">{t("search.resultCount", { count: formatNumber(result.total, locale) })}</p>
        <div className="flex items-center gap-2">
          <label htmlFor="f-sort" className="text-sm text-muted">{t("list.sortBy")}</label>
          <AutoSubmitSelect id="f-sort" name="sort" form={formId} defaultValue={query.sort}
            className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
            {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
          </AutoSubmitSelect>
        </div>
      </div>
      {empty ? <NoResults bare filtered={filtered || Boolean(fixed?.category || fixed?.city)} /> : (
        <div className="grid grid-cols-1 gap-3">{result.items.map((b) => <BusinessCard key={b.id} b={b} />)}</div>
      )}
      <Pagination page={result.page} pages={result.pages} pathname={pathname}
        params={{ q: query.q, category: fixed?.category ? undefined : query.category, city: fixed?.city ? undefined : query.city, verified: query.verified, sort: query.sort === "featured" ? undefined : query.sort }} />
    </>
  );
}
