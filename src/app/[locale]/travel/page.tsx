import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { isLocale, type Locale } from "@/config/locales";
import { sectionEnabled } from "@/config/sections";
import NextLink from "next/link";
import { TRANSPORT_TYPES, TRAVEL_ROOT_KEYS, TRAVEL_SCOPE_ID, parsePostalCode, travelCategoryFilter, travelCategoryIds, type TransportType } from "@/config/travel";
import { formatNumber } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, listBusinesses, listSelectorCities, type BusinessQuery } from "@/lib/data";
import { businessShape, parseParams } from "@/lib/data/params";
import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/ui/PageSchema";
import { TravelCard } from "@/components/travel/TravelCard";
import { AirportArt, PlaneSwoosh } from "@/components/travel/TravelArt";
import { cityOptions } from "@/components/ui/FilterBar";
import { CityFilter } from "@/components/ui/CityFilter";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { FigmaIcon } from "@/components/home/FigmaIcon";

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
  // One search field for name, service or PLZ (mockup): a postal code typed there filters by location.
  const typedPostal = parsed.q && /^\d{4,5}$/.test(parsed.q) ? parsed.q : undefined;
  const postalCode = parsePostalCode(sp.plz) ?? typedPostal;
  const category = travelCategoryFilter(parsed.category, scope);
  const transport = (TRANSPORT_TYPES as readonly string[]).includes(String(sp.transport)) ? (sp.transport as TransportType) : undefined;
  const query: BusinessQuery = { ...parsed, q: typedPostal ? undefined : parsed.q, category, scope, postalCode, transport };
  const cities = await listSelectorCities({ countryCode: query.country ?? DEFAULT_PUBLIC_COUNTRY_CODE, categoryId: category, scope, q: query.q, verified: query.verified });
  const cityList = await cityOptions(cities);
  const formId = "travel-filters";
  const keep = { q: parsed.q, city: query.city, plz: typedPostal ? undefined : postalCode, transport, country: query.country, verified: query.verified, sort: query.sort === "featured" ? undefined : query.sort };
  const filtered = Boolean(query.q || query.city || postalCode || transport || query.country || query.verified || category);
  const crumbs = [{ name: tt("title"), path: PATH }];

  return (
    <>
      <PageSchema type="CollectionPage" name={`${tt("title")} — ${tt("subtitle")}`} description={tt("lead")} path={PATH} crumbs={crumbs} />

      {/* Hero (owner mockup): title with airplane swoosh, subtitle, airport at sunset. */}
      <section className="rt-hero" aria-labelledby="travel-title">
        <div className="container-page rt-hero-inner">
          <div className="rt-hero-head" dir="ltr">
            <h1 id="travel-title" className="rt-title">Rega24<span>Travel</span></h1>
            <PlaneSwoosh className="rt-swoosh" />
          </div>
          <p className="rt-sub">{tt("subtitle")}</p>
          <p className="sr-only">{tt("lead")}</p>
        </div>
        <AirportArt className="rt-airport" />
      </section>

      <div className="container-page rt-panel">
        <form id={formId} action={`/${locale}${PATH}`} role="search" className="rt-form">
          <div className="rt-search">
            <label htmlFor="t-q" className="sr-only">{tt("searchLabel")}</label>
            <input id="t-q" name="q" type="search" defaultValue={parsed.q} placeholder={tt("searchPlaceholder")} autoComplete="off" maxLength={120} className="rt-search-input" />
            {keep.plz && <input type="hidden" name="plz" value={keep.plz} />}
            <button type="submit" className="rt-search-btn"><FigmaIcon name="search" className="size-5" /><span className="sr-only">{t("nav.search")}</span></button>
          </div>
          <div className="rt-pills">
            <div className="rt-pill">
              <FigmaIcon name="map-pin" className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <CityFilter countryCode={query.country} cities={cityList} value={query.city} allLabel={tt("allCities")} cityLabel={t("locations.city")}
                  fieldClass="min-h-11 w-full bg-transparent text-sm font-semibold outline-none" chevron={false} />
              </div>
            </div>
            <label className="rt-pill rt-pill-red">
              <FigmaIcon name="layout-grid" className="size-5 shrink-0" />
              <span className="sr-only">{tt("categoriesLabel")}</span>
              <AutoSubmitSelect name="category" defaultValue={category ?? ""} className="rt-pill-select" data-testid="travel-category">
                <option value="">{tt("allCategories")}</option>
                {chips.map((c) => <option key={c.id} value={c.id}>{`${c.name.text} (${formatNumber(c.count, locale)})`}</option>)}
              </AutoSubmitSelect>
            </label>
            {/* Transport type declared by the businesses (car, van, bus, ...); travel-only filter. */}
            <label className="rt-pill">
              <FigmaIcon name="car" className="size-5 shrink-0 text-brand-text" />
              <span className="sr-only">{tt("transportTypesLabel")}</span>
              <AutoSubmitSelect name="transport" defaultValue={transport ?? ""} className="rt-pill-select" data-testid="travel-transport">
                <option value="">{tt("allTransport")}</option>
                {TRANSPORT_TYPES.map((type) => <option key={type} value={type}>{tt(`transport.${type}`)}</option>)}
              </AutoSubmitSelect>
            </label>
            {/* Nearby travel & transport providers on the existing map (/nearby, scoped to Rega24Travel). */}
            <Link href={`/nearby?category=${TRAVEL_SCOPE_ID}`} className="rt-pill rt-pill-link" data-testid="travel-nearby">
              <FigmaIcon name="navigation" className="size-5 shrink-0 text-brand-text" />
              <span className="truncate text-sm font-bold">{tt("nearbyLabel")}</span>
            </Link>
          </div>
        </form>

        <div className="mt-4 pb-10">
          <Suspense key={JSON.stringify(query)} fallback={<ResultsSkeleton />}>
            <Results query={query} locale={locale} formId={formId} filtered={filtered} params={{ ...keep, category }} />
          </Suspense>
          {/* Travel business registration: the existing owner workflow, offering travel categories only. */}
          <div className="rt-register">
            <div className="min-w-0">
              <p className="text-base font-extrabold text-ink">{tt("registerTitle")}</p>
              <p className="mt-1 text-sm text-muted">{tt("registerLead")}</p>
            </div>
            <NextLink href="/dr/businesses/new?travel=1" className={buttonClass("primary")} data-testid="travel-register">{tt("addBusiness")}</NextLink>
          </div>
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
      <div className="rt-list">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-line bg-surface-2" />)}
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
      <div className="rt-toolbar">
        <p aria-live="polite" className="rt-count">{t("search.resultCount", { count: formatNumber(result.total, locale) })}</p>
        <div className="rt-sort">
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
            : <NextLink href="/dr/businesses/new?travel=1" className={buttonClass("primary")} data-testid="be-first-cta">{tt("addBusiness")}</NextLink>}
        />
      ) : (
        <ul className="rt-list">{result.items.map((b) => <li key={b.id}><TravelCard b={b} /></li>)}</ul>
      )}
      <Pagination page={result.page} pages={result.pages} pathname={PATH} params={params} />
    </>
  );
}
