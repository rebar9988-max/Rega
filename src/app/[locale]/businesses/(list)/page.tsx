import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/i18n/locales";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessCard } from "@/components/cards/BusinessCard";
import { FilterBar, categoryOptions, cityOptions } from "@/components/ui/FilterBar";
import { Grid, GridSkeleton, NoResults } from "@/components/ui/Grid";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsMeta } from "@/components/ui/ResultsMeta";
import { getCategories, getCities, listBusinesses, type BusinessQuery } from "@/lib/data";
import { businessShape, parseParams } from "@/lib/data/params";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/businesses", title: t("nav.businesses"), description: t("meta.description") });
}

export default async function BusinessesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseParams(businessShape, await searchParams);
  const t = await getTranslations();
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  return (
    <>
      <PageSchema type="CollectionPage" name={t("businesses.title")} path="/businesses" crumbs={[{ name: t("businesses.title"), path: "/businesses" }]} />
      <PageHeader title={t("businesses.title")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title") }]} />
      <FilterBar
        action="/businesses" values={query} searchLabel={t("search.placeholder")} verified
        categories={await categoryOptions(categories)} cities={await cityOptions(cities)}
        sorts={["featured", "rating", "newest", "name"]}
      />
      {/* Streamed results: filters render instantly, the grid shows a skeleton while the query runs. */}
      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton />}><Results query={query} /></Suspense>
    </>
  );
}

async function Results({ query }: { query: BusinessQuery }) {
  const result = await listBusinesses(query);
  return (
    <>
      <ResultsMeta total={result.total} />
      {result.items.length ? <Grid>{result.items.map((b) => <BusinessCard key={b.id} b={b} />)}</Grid> : <NoResults />}
      <div className="container-page"><Pagination page={result.page} pages={result.pages} pathname="/businesses" params={{ q: query.q, category: query.category, city: query.city, verified: query.verified, sort: query.sort === "featured" ? undefined : query.sort }} /></div>
    </>
  );
}
