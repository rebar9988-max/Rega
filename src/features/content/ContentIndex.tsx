import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { formatNumber, type Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import { contentShape, parseParams } from "@/lib/data/params";
import { PageSchema } from "@/components/ui/PageSchema";
import { PageHeader } from "@/components/ui/PageHeader";
import { Grid, GridSkeleton } from "@/components/ui/Grid";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { EMPLOYMENT_TYPES, type ContentSection } from "./config";
import { listPublished, sectionCategories, sectionCitiesWithEntries, type PublicFilters } from "./queries";
import { EntryCard } from "./EntryCard";

type Sp = Record<string, string | string[] | undefined>;
const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

/** Public list page of a content section: filters in the URL (shareable, crawlable), cards, pagination, honest empty state. */
export async function ContentIndex({ section, locale, searchParams }: { section: ContentSection; locale: Locale; searchParams: Sp }) {
  const query = parseParams(contentShape, searchParams);
  const t = await getTranslations();
  const [categories, cities] = await Promise.all([sectionCategories(section), sectionCitiesWithEntries(section)]);
  const path = `/${section}`;
  const title = t(`nav.${section}`);
  const filters: PublicFilters = { q: query.q, city: query.city, category: query.category, employmentType: section === "jobs" ? query.employmentType : undefined, when: section === "events" ? query.when : undefined, page: query.page };
  const active = Boolean(query.q || query.city || query.category || filters.employmentType || (section === "events" && query.when === "past"));

  return (
    <>
      <PageSchema type="CollectionPage" name={title} path={path} crumbs={[{ name: title, path }]} />
      <PageHeader title={title} crumbs={[{ label: t("nav.home"), href: "/" }, { label: title }]} />
      <form action={`/${locale}${path}`} role="search" className="container-page mb-8">
        <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="c-q" className="sr-only">{t("search.placeholder")}</label>
            <input id="c-q" name="q" type="search" defaultValue={query.q} placeholder={t("search.placeholder")} autoComplete="off" className={field} />
          </div>
          {categories.length > 0 && (
            <div>
              <label htmlFor="c-cat" className="sr-only">{t("content.category")}</label>
              <select id="c-cat" name="category" defaultValue={query.category ?? ""} className={field}>
                <option value="">{t("list.allCategories")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{localizeText({ ...c, name: c.nameEn }, "name", locale)}</option>)}
              </select>
            </div>
          )}
          {cities.length > 0 && (
            <div>
              <label htmlFor="c-city" className="sr-only">{t("content.city")}</label>
              <select id="c-city" name="city" defaultValue={query.city ?? ""} className={field}>
                <option value="">{t("list.allCities")}</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{`${localizeText({ ...c, name: c.nameEn }, "name", locale)} (${formatNumber(c.count, locale)})`}</option>)}
              </select>
            </div>
          )}
          {section === "jobs" && (
            <div>
              <label htmlFor="c-type" className="sr-only">{t("content.typeLabel")}</label>
              <select id="c-type" name="employmentType" defaultValue={query.employmentType ?? ""} className={field}>
                <option value="">{t("content.allTypes")}</option>
                {EMPLOYMENT_TYPES.map((k) => <option key={k} value={k}>{t(`content.type_${k}`)}</option>)}
              </select>
            </div>
          )}
          {section === "events" && (
            <div>
              <label htmlFor="c-when" className="sr-only">{t("content.whenLabel")}</label>
              <select id="c-when" name="when" defaultValue={query.when} className={field}>
                <option value="upcoming">{t("content.upcoming")}</option>
                <option value="past">{t("content.past")}</option>
              </select>
            </div>
          )}
          <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("list.apply")}</button>
        </div>
        {active && <div className="mt-3 text-sm"><Link href={path} className="text-brand hover:underline">{t("list.reset")}</Link></div>}
      </form>
      <Suspense key={JSON.stringify(filters)} fallback={<GridSkeleton />}><Results section={section} locale={locale} filters={filters} active={active} /></Suspense>
    </>
  );
}

async function Results({ section, locale, filters, active }: { section: ContentSection; locale: Locale; filters: PublicFilters; active: boolean }) {
  const t = await getTranslations();
  const result = await listPublished(section, filters);
  return (
    <>
      <p aria-live="polite" className="container-page mb-4 text-sm text-muted">{t("search.resultCount", { count: formatNumber(result.total, locale) })}</p>
      {result.items.length ? (
        <Grid>{result.items.map((e) => <EntryCard key={e.id} entry={e} section={section} locale={locale} />)}</Grid>
      ) : (
        <div className="container-page">
          <EmptyState
            title={active ? t("common.empty") : t("content.emptyPublic")}
            body={active ? t("empty.tryOther") : undefined}
            action={<Link href="/for-business" className={buttonClass("primary")} data-testid="be-first-cta">{t("content.emptyCta")}</Link>}
          />
        </div>
      )}
      <div className="container-page"><Pagination page={result.page} pages={result.pages} pathname={`/${section}`} params={{ q: filters.q, city: filters.city, category: filters.category, employmentType: filters.employmentType, when: filters.when === "past" ? "past" : undefined }} /></div>
    </>
  );
}
