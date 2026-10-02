import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageSchema } from "@/components/ui/PageSchema";
import { BusinessCard } from "@/components/cards/BusinessCard";
import { FilterBar, categoryOptions, cityOptions } from "@/components/ui/FilterBar";
import { Grid, GridSkeleton, NoResults } from "@/components/ui/Grid";
import { PageHeader, type Crumb } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsMeta } from "@/components/ui/ResultsMeta";
import { getCategories, getCities, listBusinesses, type BusinessQuery } from "@/lib/data";
import { businessShape, parseParams } from "@/lib/data/params";

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
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  return (
    <>
      <PageSchema type="CollectionPage" name={title} path={pathname} crumbs={crumbs.map((c) => ({ name: String(c.label), path: c.href ?? pathname }))} />
      <PageHeader title={title} subtitle={subtitle} crumbs={crumbs} />
      <FilterBar
        action={pathname} values={query} searchLabel={t("search.placeholder")} verified
        categories={fixed?.category ? undefined : await categoryOptions(categories)} cities={fixed?.city ? undefined : await cityOptions(cities)}
        sorts={["featured", "rating", "newest", "name"]}
      />
      {/* Streamed results: filters render instantly, the grid shows a skeleton while the query runs. */}
      <Suspense key={JSON.stringify(query)} fallback={<GridSkeleton />}><Results query={query} pathname={pathname} fixed={fixed} heading={title} /></Suspense>
    </>
  );
}

async function Results({ query, pathname, fixed, heading }: { query: BusinessQuery; pathname: string; fixed?: BusinessIndexProps["fixed"]; heading: string }) {
  const result = await listBusinesses(query);
  const filtered = Boolean(query.q || query.verified || (!fixed?.category && query.category) || (!fixed?.city && query.city));
  const empty = result.items.length === 0;
  return (
    <>
      {/* Keeps the heading order h1 -> h2 -> h3 (card titles) for screen readers. */}
      <h2 className="sr-only">{heading}</h2>
      <ResultsMeta total={result.total} />
      {empty ? <NoResults filtered={filtered || Boolean(fixed?.category || fixed?.city)} /> : <Grid>{result.items.map((b) => <BusinessCard key={b.id} b={b} />)}</Grid>}
      <div className="container-page">
        <Pagination page={result.page} pages={result.pages} pathname={pathname}
          params={{ q: query.q, category: fixed?.category ? undefined : query.category, city: fixed?.city ? undefined : query.city, verified: query.verified, sort: query.sort === "featured" ? undefined : query.sort }} />
      </div>
    </>
  );
}
