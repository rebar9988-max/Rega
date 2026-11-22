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
import { cityOptions } from "@/components/ui/FilterBar";
import { CityFilter } from "@/components/ui/CityFilter";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { FigmaIcon } from "@/components/home/FigmaIcon";

const PATH = "/travel";
const SORTS = ["featured", "rating", "newest", "name"] as const;

/**
 * Photo service cards under the filters (owner reference 2026-11-19), in reading order. Each opens this page filtered to
 * that existing category; a card is shown only while its category exists. Images: public/travel/<slug>-<width>.avif|webp.
 */
const PHOTO_CARDS = [
  { slug: "travel-agencies", w: 230, h: 140 },
  { slug: "taxi-transfer", w: 216, h: 132 },
  { slug: "airport-transfer", w: 236, h: 110 },
  { slug: "car-rental", w: 234, h: 122 },
] as const;

/** One responsive photo: AVIF first, WebP fallback, two widths (1x/2x), fixed box so nothing shifts while loading. */
function TravelPhoto({ name, w, h, sizes, eager = false, className }: { name: string; w: number; h: number; sizes: string; eager?: boolean; className?: string }) {
  const half = Math.round(w / 2);
  const set = (ext: string) => `/travel/${name}-${half}.${ext} ${half}w, /travel/${name}-${w}.${ext} ${w}w`;
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/travel/${name}-${w}.webp`} alt="" width={w} height={h} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" />
    </picture>
  );
}

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
  const photoCards = PHOTO_CARDS.flatMap((card) => {
    const c = categories.find((x) => x.slug === card.slug && scope.includes(x.id));
    return c ? [{ ...card, id: c.id }] : [];
  });
  return { scope, total, photoCards, chips: chips.map((c) => ({ id: c.id, name: name(c), count: c.count })) };
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
  const { scope, chips, photoCards } = await travelTaxonomy(locale);

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

      {/* Banner (owner 2026-11-22): the same Kurdish Sorani artwork as the home banner in EVERY language; never translated. */}
      <section className="container-page rt-hero" aria-labelledby="travel-title">
        <h1 id="travel-title" className="sr-only">Rega24Travel</h1>
        <div className="relative" data-testid="travel-hero-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/travel/home-banner.jpeg" alt="Rega24Travel" width={1536} height={864}
            fetchPriority="high" decoding="async" className="block h-auto w-full" />
          {/* Physical coordinates follow the painted button in both RTL and LTR. */}
          <a href="#t-q" data-testid="travel-start"
            className="absolute left-[5.2%] top-[68.3%] h-[20%] min-h-11 w-[43.2%] -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            <span className="sr-only">Rega24Travel — {tt("startCta")}</span>
          </a>
        </div>
      </section>

      <div className="container-page rt-panel">
        {/* Keyed by the active filters: a client-side navigation (photo card, pill) remounts the uncontrolled fields so they show the new filter. */}
        <form key={[parsed.q, category, query.city, postalCode, transport, query.country].join("|")} id={formId} action={`/${locale}${PATH}`} role="search" className="rt-form">
          <div className="rt-search">
            <span className="rt-search-pin" aria-hidden="true"><FigmaIcon name="map-pin" className="size-6" /></span>
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

        {photoCards.length > 0 && (
          <nav aria-label={tt("categoriesLabel")} className="rt-cats-wrap">
            <ul className="rt-cats">
              {photoCards.map((c) => (
                <li key={c.slug}>
                  <Link href={`${PATH}?category=${c.id}`} className="rt-cat" aria-current={category === c.id ? "true" : undefined} data-testid={`travel-card-${c.slug}`}>
                    <TravelPhoto name={c.slug} w={c.w} h={c.h} sizes="(min-width: 768px) 230px, 30vw" className="rt-cat-photo" />
                    <span className="rt-cat-label">{tt(`shortcut.${c.slug}`)}</span>
                    <span className="rt-cat-go" aria-hidden="true"><FigmaIcon name="chevron-right" className="rtl-flip size-4" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

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
