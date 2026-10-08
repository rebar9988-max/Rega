import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { Suspense } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LocationCard } from "@/components/cards/LocationCard";
import { FilterBar, cityOptions } from "@/components/ui/FilterBar";
import { CityBrowser } from "@/components/ui/CityBrowser";
import { Grid, GridSkeleton, NoResults } from "@/components/ui/Grid";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsMeta } from "@/components/ui/ResultsMeta";
import type { Locale } from "@/i18n/locales";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCities, listLocations, type LocationQuery } from "@/lib/data";
import { listShape, parseParams } from "@/lib/data/params";
import { log } from "@/lib/logger";

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
  let cities: Awaited<ReturnType<typeof getCities>> = [];
  try {
    cities = await getCities({ countryCode: DEFAULT_PUBLIC_COUNTRY_CODE });
  } catch (error) {
    log.error("locations.cities_unavailable", { error: error instanceof Error ? error.message : String(error) });
  }
  const active = (await getLocale()) as Locale;

  return (
    <>
      <PageSchema type="CollectionPage" name={t("locations.title")} path="/locations" crumbs={[{ name: t("locations.title"), path: "/locations" }]} />
      <PageHeader title={t("locations.title")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("locations.title") }]} />

      {/* Modern grouped + searchable city browser */}
      <CityBrowser
        cities={cities}
        locale={active}
        activeCityId={query.city}
        browseLabel={t("locations.browseByCity")}
        searchPlaceholder={t("search.placeholder")}
      />

      <FilterBar action="/locations" values={query} searchLabel={t("search.placeholder")} cities={await cityOptions(cities)} />
      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton />}><Results query={query} /></Suspense>
    </>
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
      <div className="container-page"><Pagination page={result.page} pages={result.pages} pathname="/locations" params={{ q: query.q, city: query.city }} /></div>
    </>
  );
}
