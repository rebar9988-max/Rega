import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import type { Locale } from "@/i18n/locales";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { FilterBar, categoryOptions, cityOptions } from "@/components/ui/FilterBar";
import { Grid, GridSkeleton, NoResults } from "@/components/ui/Grid";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsMeta } from "@/components/ui/ResultsMeta";
import { getCategories, getCities, listServices, type ServiceQuery } from "@/lib/data";
import { parseParams, serviceShape } from "@/lib/data/params";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/services", title: t("nav.services"), description: await pageDescription(locale as Locale, "services") });
}

export default async function ServicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseParams(serviceShape, await searchParams);
  const t = await getTranslations();
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  return (
    <>
      <PageSchema type="CollectionPage" name={t("services.title")} path="/services" crumbs={[{ name: t("services.title"), path: "/services" }]} />
      <PageHeader title={t("services.title")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("services.title") }]} />
      <FilterBar
        action="/services" values={query} searchLabel={t("search.placeholder")}
        categories={await categoryOptions(categories)} cities={await cityOptions(cities)}
        sorts={["featured", "priceAsc", "priceDesc", "newest"]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton />}><Results query={query} /></Suspense>
    </>
  );
}

async function Results({ query }: { query: ServiceQuery }) {
  const result = await listServices(query);
  return (
    <>
      <ResultsMeta total={result.total} />
      {result.items.length ? <Grid>{result.items.map((s) => <ServiceCard key={s.id} s={s} />)}</Grid> : <NoResults filtered={Boolean(query.q || query.category || query.city || ("verified" in query && query.verified))} />}
      <div className="container-page"><Pagination page={result.page} pages={result.pages} pathname="/services" params={{ q: query.q, category: query.category, city: query.city, sort: query.sort === "featured" ? undefined : query.sort }} /></div>
    </>
  );
}
