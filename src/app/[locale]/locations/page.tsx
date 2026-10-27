import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { Suspense } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LocationCard } from "@/components/cards/LocationCard";
import { FilterBar, cityOptions, categoryOptions } from "@/components/ui/FilterBar";
import { CityBrowser } from "@/components/ui/CityBrowser";
import { Grid, GridSkeleton, NoResults } from "@/components/ui/Grid";
import { PremiumHero, FeatureNav, styles as s } from "@/components/migration/Premium";
import { Link } from "@/i18n/routing";
import { localizeText } from "@/lib/content";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsMeta } from "@/components/ui/ResultsMeta";
import type { Locale } from "@/i18n/locales";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, listLocations, listSelectorCities, type LocationQuery } from "@/lib/data";
import { listShape, parseParams } from "@/lib/data/params";
import { log } from "@/lib/logger";

/** Cap is applied inside listSelectorCities so this page never loads the full gazetteer. */

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/locations", title: t("nav.locations"), description: await pageDescription(locale as Locale, "locations") });
}

export default async function LocationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseParams(listShape, await searchParams);
  const t = await getTranslations();
  // City chips are helpful, but a transient database read must not take the whole public
  // locations page down. The result list below still retries its independent read.
  let browseCities: Awaited<ReturnType<typeof listSelectorCities>> = [];
  try {
    browseCities = await listSelectorCities({ countryCode: DEFAULT_PUBLIC_COUNTRY_CODE });
  } catch (error) {
    log.error("locations.cities_unavailable", { error: error instanceof Error ? error.message : String(error) });
  }

  const active = (await getLocale()) as Locale;
  const categories = await getCategories();
  const featuredCities = ["koeln", "bonn", "duesseldorf"].flatMap(slug => browseCities.filter(c => c.slug === slug));

  return (
    <div className={s.page} data-testid="premium-cities">
      <PageSchema type="CollectionPage" name={t("locations.title")} path="/locations" crumbs={[{ name: t("locations.title"), path: "/locations" }]} />
      <FeatureNav business={t("forBusiness.title")} ai={t("ai.title")} cities={t("locations.title")} />
      <PremiumHero eyebrow="Rega24" title={t("premiumPages.cityHero")} lead={t("premiumPages.cityLead")}
        art={<>{featuredCities.map(city=><div className={s.mini} key={city.id}><span className={s.symbol} aria-hidden="true">📍</span><div><strong>{localizeText({...city,name:city.nameEn},"name",active)}</strong><p>{t("locations.browseByCity")}</p></div></div>)}</>}>
        <a href="#citylist" className={s.button}>{t("locations.browseByCity")}</a><Link href="/nearby" className={s.secondary}>{t("locations.viewOnMap")}</Link>
      </PremiumHero>
      <section id="citylist" className={s.section}><div className={s.inner}><h2>{t("locations.browseByCity")}</h2><div className={s.grid3}>{featuredCities.map(city=><Link className={`${s.tile} ${s.city}`} href={`/locations?city=${encodeURIComponent(city.id)}`} key={city.id}>
        <div><span className={s.eyebrow}>{t("home.factGermany")}</span><h3><strong>{localizeText({...city,name:city.nameEn},"name",active)}</strong></h3></div>
        <div className={s.scape} aria-hidden="true">{[29,43,65,32,45].map((height,i)=><i key={i} style={{height}} />)}</div>
      </Link>)}</div></div></section>

      {/* Modern grouped + searchable city browser (bounded payload) */}
      <CityBrowser
        cities={browseCities}
        locale={active}
        activeCityId={query.city}
        browseLabel={t("locations.browseByCity")}
        searchPlaceholder={t("search.placeholder")}
      />

      <FilterBar action="/locations" categories={await categoryOptions(categories)} values={query} searchLabel={t("search.placeholder")} cities={await cityOptions(browseCities)} />
      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton />}><Results query={query} /></Suspense>
      <section className={`${s.section} ${s.tint}`}><div className={s.inner}><h2>{t("premiumPages.categories")}</h2><div className={s.grid4}>{categories.filter(c=>!c.parentId).slice(0,6).map(c=><Link className={s.tile} href={`/locations?${new URLSearchParams({category:c.id,...(query.city?{city:query.city}:{})})}`} key={c.id}><h3>{localizeText({...c,name:c.nameDe},"name",active)}</h3></Link>)}</div></div></section>
    </div>
  );
}

async function Results({ query }: { query: LocationQuery }) {
  let result: Awaited<ReturnType<typeof listLocations>>;
  try {
    result = await listLocations(query);
  } catch (firstError) {
    // listLocations is not React-cached, so one bounded retry can recover from a short-lived
    // database/edge connection reset without hiding a persistent outage.
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      result = await listLocations(query);
    } catch (error) {
      log.error("locations.results_unavailable", {
        firstError: firstError instanceof Error ? firstError.message : String(firstError),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  return (
    <>
      <ResultsMeta total={result.total} />
      {result.items.length ? <Grid>{result.items.map((l) => <LocationCard key={l.id} l={l} />)}</Grid> : <NoResults filtered={Boolean(query.q || query.category || query.city || ("verified" in query && query.verified))} />}
      <div className="container-page"><Pagination page={result.page} pages={result.pages} pathname="/locations" params={{ q: query.q, city: query.city, category: query.category }} /></div>
    </>
  );
}
