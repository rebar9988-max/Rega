import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { isLocale, type Locale } from "@/config/locales";
import { sectionEnabled } from "@/config/sections";
import { TRAVEL_ROOT_KEYS, parsePostalCode, travelCategoryFilter, travelCategoryIds } from "@/config/travel";
import { formatNumber } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, listBusinesses, listSelectorCities, type BusinessQuery } from "@/lib/data";
import { businessShape, parseParams } from "@/lib/data/params";
import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/ui/PageSchema";
import { BusinessCard } from "@/components/cards/BusinessCard";
import { cityOptions } from "@/components/ui/FilterBar";
import { CityFilter } from "@/components/ui/CityFilter";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { Icon3D } from "@/components/home/Icon3D";

const PATH = "/travel";
const SORTS = ["featured", "rating", "newest", "name"] as const;

type Sp = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Sp> };

/** The travel categories, their ids (roots + all descendants) and the chips shown on the page. */
async function travelTaxonomy(locale: Locale) {
  const categories = await getCategories();
  const scope = travelCategoryIds(categories);
  const roots = TRAVEL_ROOT_KEYS.flatMap((key) => categories.filter((c) => c.slug === key));
  // One chip per direct sub-category of a root; a root without sub-categories is its own chip.
  const chips = roots.flatMap((root) => {
    const children = categories.filter((c) => c.parentId === root.id);
    return children.length ? children : [root];
  });
  const name = (c: (typeof categories)[number]) => localize({ ...c, name: c.nameDe }, "name", locale);
  const total = roots.reduce((n, r) => n + r.count, 0);
  return { scope, total, chips: chips.map((c) => ({ id: c.id, name: name(c), count: c.count })) };
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || !sectionEnabled("travel")) return {};
  const t = await getTranslations({ locale, namespace: "travel" });
  const { total } = await travelTaxonomy(locale);
  return pageMetadata({ locale, path: PATH, title: `${t("title")} — ${t("subtitle")}`, description: t("lead"), noindex: total === 0 });
}

export default async function TravelPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || !sectionEnabled("travel")) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations();
  const tt = await getTranslations("travel");
  const { scope, chips } = await travelTaxonomy(locale);

  const parsed = parseParams(businessShape, sp);
  const postalCode = parsePostalCode(sp.plz);
  const category = travelCategoryFilter(parsed.category, scope);
  const query: BusinessQuery = { ...parsed, category, scope, postalCode };
  const cities = await listSelectorCities({ countryCode: query.country ?? DEFAULT_PUBLIC_COUNTRY_CODE, categoryId: category, scope, q: query.q, verified: query.verified });
  const cityList = await cityOptions(cities);
  const formId = "travel-filters";
  const keep = { q: query.q, city: query.city, plz: postalCode, country: query.country, verified: query.verified, sort: query.sort === "featured" ? undefined : query.sort };
  const chipHref = (id?: string) => {
    const p = new URLSearchParams(Object.entries({ ...keep, category: id }).flatMap(([k, v]) => (v ? [[k, v]] : [])));
    return p.size ? `${PATH}?${p}` : PATH;
  };
  const filtered = Boolean(query.q || query.city || postalCode || query.country || query.verified || category);
  const crumbs = [{ name: tt("title"), path: PATH }];

  return (
    <>
      <PageSchema type="CollectionPage" name={`${tt("title")} — ${tt("subtitle")}`} description={tt("lead")} path={PATH} crumbs={crumbs} />

      {/* Compact hero: brand gradient of the existing map banner, travel artwork, page title. */}
      <section className="rt-hero" aria-labelledby="travel-title">
        <div className="container-page rt-hero-inner">
          <div className="min-w-0">
            <h1 id="travel-title" className="rt-title" dir="ltr">Rega24<span>Travel</span></h1>
            <p className="rt-sub">{tt("subtitle")}</p>
            <p className="rt-lead">{tt("lead")}</p>
          </div>
          <Icon3D name="travel" className="rt-hero-art" />
        </div>
      </section>

      <div className="container-page rt-panel">
        {/* Search: what + PLZ + city, on the existing directory search shell. Other filters join via `form=`. */}
        <form id={formId} action={`/${locale}${PATH}`} role="search"
          className="rega-search-shell grid gap-0 overflow-visible md:grid-cols-[minmax(0,1.5fr)_minmax(0,.6fr)_minmax(0,1fr)_auto]">
          {category && <input type="hidden" name="category" value={category} />}
          <div className="flex min-h-14 min-w-0 items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
            <FigmaIcon name="search" className="size-5 shrink-0 text-brand-text" />
            <label htmlFor="t-q" className="sr-only">{tt("searchLabel")}</label>
            <input id="t-q" name="q" type="search" defaultValue={query.q} placeholder={tt("searchPlaceholder")} autoComplete="off" maxLength={120}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted" />
          </div>
          <div className="flex min-h-14 min-w-0 items-center gap-2 border-t border-line px-4 md:border-s md:border-t-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
            <FigmaIcon name="navigation" className="size-5 shrink-0 text-brand-text" />
            <label htmlFor="t-plz" className="sr-only">{tt("postalLabel")}</label>
            <input id="t-plz" name="plz" type="text" inputMode="text" autoComplete="postal-code" defaultValue={postalCode} placeholder={tt("postalPlaceholder")} maxLength={10}
              pattern="[A-Za-z0-9][A-Za-z0-9 \-]{1,9}" dir="ltr" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted" />
          </div>
          <div className="flex min-h-14 min-w-0 items-center gap-2 border-t border-line px-3 md:border-s md:border-t-0">
            <FigmaIcon name="map-pin" className="size-5 shrink-0 text-brand-text" />
            <div className="min-w-0 flex-1">
              <CityFilter countryCode={query.country} cities={cityList} value={query.city} allLabel={t("list.allCities")} cityLabel={t("locations.city")}
                fieldClass="min-h-11 w-full bg-transparent px-1 text-sm outline-none" />
            </div>
          </div>
          <button type="submit" className="min-h-12 rounded-b-[0.7rem] bg-brand px-8 text-[15px] font-bold text-brand-ink transition hover:bg-brand-hover md:m-1.5 md:rounded-[0.55rem]">{t("nav.search")}</button>
        </form>

        {/* Category filters: real travel categories only, each with its live count. */}
        {chips.length > 0 && (
          <nav aria-label={tt("categoriesLabel")} className="mt-4">
            <ul className="rt-chips">
              <li><Link href={chipHref()} className="rt-chip" aria-current={category ? undefined : "true"} data-testid="travel-chip-all">
                <FigmaIcon name="layout-grid" className="size-4 shrink-0" />{tt("allCategories")}
              </Link></li>
              {chips.map((c) => (
                <li key={c.id}>
                  <Link href={chipHref(c.id)} className="rt-chip" aria-current={category === c.id ? "true" : undefined}>
                    <span lang={c.name.lang} dir={c.name.dir}>{c.name.text}</span>
                    <span className="rt-chip-count">({formatNumber(c.count, locale)})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="mt-2 pb-10">
          <Suspense key={JSON.stringify(query)} fallback={<ResultsSkeleton />}>
            <Results query={query} locale={locale} formId={formId} filtered={filtered} params={{ ...keep, category }} />
          </Suspense>
          <p className="mt-6 text-center text-xs text-muted">{tt("notBooking")}</p>
        </div>
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="h-11 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-surface-2" />)}
      </div>
    </div>
  );
}

async function Results({ query, locale, formId, filtered, params }: { query: BusinessQuery; locale: Locale; formId: string; filtered: boolean; params: Record<string, string | undefined> }) {
  const result = await listBusinesses(query);
  const t = await getTranslations();
  const tt = await getTranslations("travel");
  return (
    <>
      <h2 className="sr-only">{tt("title")}</h2>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold text-ink">{t("search.resultCount", { count: formatNumber(result.total, locale) })}</p>
        <div className="flex items-center gap-2">
          <label htmlFor="t-sort" className="text-sm text-muted">{t("list.sortBy")}</label>
          <AutoSubmitSelect id="t-sort" name="sort" form={formId} defaultValue={query.sort}
            className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
            {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
          </AutoSubmitSelect>
        </div>
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          title={filtered ? tt("emptyFiltered") : tt("emptyTitle")}
          body={filtered ? undefined : tt("emptyBody")}
          action={filtered
            ? <Link href={PATH} className={buttonClass("primary")} data-testid="travel-clear">{tt("clearFilters")}</Link>
            : <Link href="/for-business" className={buttonClass("primary")} data-testid="be-first-cta">{tt("addBusiness")}</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{result.items.map((b) => <BusinessCard key={b.id} b={b} variant="directory" />)}</div>
      )}
      <Pagination page={result.page} pages={result.pages} pathname={PATH} params={params} />
    </>
  );
}
