import { PageSchema } from "@/components/ui/PageSchema";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LOCALE_META, isLocale, type Locale } from "@/i18n/locales";
import { CATEGORY_ICON, FigmaIcon, ROW_ICON } from "@/components/home/FigmaIcon";
import { BusinessRow } from "@/components/cards/BusinessRow";
import { SocialSection } from "@/components/home/SocialSection";
import { Text } from "@/components/ui/Bidi";
import { localize } from "@/lib/content";
import { PlacesMap, type PlacePoint } from "@/components/map/PlacesMap";
import { isValidCoordinate } from "@/lib/coordinates";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, getHomeData, listSelectorCities } from "@/lib/data";
import { MAJOR_CITY_SLUGS } from "@/lib/selector-cities";
import { CityFilter } from "@/components/ui/CityFilter";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";

/** The landing page must render even if the database is briefly unavailable. */
async function homeData() {
  try { return await getHomeData(); } catch (error) { log.error("home.data", { error: String(error) }); return null; }
}

const BAND = "mx-auto max-w-[1440px] px-5 md:px-8 lg:px-14";

/** The home page must still render when these lookups fail (database briefly unavailable). */
async function safe<T>(fn: () => Promise<T>, fallback: T, onFail: () => void): Promise<T> {
  try { return await fn(); } catch { onFail(); return fallback; }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, title: t("title"), description: t("description") });
}

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Pages render in parallel with the layout, so stray requests (e.g. /favicon.ico) must be rejected here too.
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  const te = await getTranslations("empty");
  const l = locale as Locale;
  const pageLang = LOCALE_META[l].htmlLang;
  let degraded = false;
  const failed = () => { degraded = true; };
  const [data, categories, cities] = await Promise.all([
    homeData(),
    safe(getCategories, [], failed),
    safe(() => listSelectorCities({ countryCode: DEFAULT_PUBLIC_COUNTRY_CODE }), [], failed),
  ]);
  if (!data) degraded = true;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryName = (c: (typeof categories)[number]) => localize({ ...c, name: c.nameDe }, "name", l);
  const categoryOf = (id: string | null | undefined) => (id ? categoryById.get(id) : undefined);
  const cityName = (c: { nameEn: string } & Record<string, unknown>) => localize({ ...c, name: c.nameEn }, "name", l);
  const rootCategories = categories.filter((c) => !c.parentId);
  const majorCities = MAJOR_CITY_SLUGS
    .map((slug) => cities.find((c) => c.slug === slug))
    .filter((c): c is (typeof cities)[number] & { slug: string } => Boolean(c?.slug))
    .slice(0, 8);
  const cityPoints: PlacePoint[] = majorCities.flatMap((c) => (
    c.slug && isValidCoordinate(c.latitude, c.longitude) && c.longitude != null
      ? [{ id: c.id, lat: c.latitude, lng: c.longitude, name: cityName(c).text, href: `/city/${c.slug}` }]
      : []
  ));

  // Latest additions; the nearby list: featured first, then the latest, without repeats.
  const latest = data?.latest ?? [];
  const pool = [...(data?.featured ?? []), ...latest.filter((b) => !data?.featured.some((f) => f.id === b.id))].slice(0, 6);
  const mapPoints: PlacePoint[] = pool.flatMap((b) => {
    const loc = b.locations[0];
    return loc && isValidCoordinate(loc.latitude, loc.longitude) && loc.longitude != null
      ? [{ id: b.id, lat: loc.latitude, lng: loc.longitude, name: localize(b, "name", l).text, sub: loc.city ? cityName(loc.city).text : undefined, href: `/business/${b.slug}` }]
      : [];
  });

  return (
    <>
      <div className="figma rega-home text-ink">
        <PageSchema name={`${t("communityTitle")} ${t("communityAccent")}`} description={t("communityLead")} />
        {degraded && <NoEdgeCache />}

        <section className={`${BAND} pt-4 lg:pt-[22px]`}>
          <div className="rega-editorial-hero relative rounded-3xl border border-line bg-surface px-[22px] py-6 lg:min-h-[410px] lg:py-7">
            <span className="rega-hero-accent" aria-hidden="true" />
            <h1 className="rega-display pe-4 text-[clamp(1.8rem,3.34vw,3rem)] leading-normal">
              {t("communityTitle")}<span className="mt-3 block text-brand-text">{t("communityAccent")}</span>
            </h1>
            <p className="mt-6 text-[15px] leading-7 text-muted lg:text-[19px]">{t("communityLead")}</p>
              <form action={`/${locale}/businesses`} role="search"
                className="rega-home-search relative z-20 mt-6 grid gap-3 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,.3fr)_auto] lg:gap-0 lg:rounded-[14px] lg:bg-surface-2 lg:p-2">
                <label className="flex min-h-[58px] min-w-0 items-center gap-3 rounded-[14px] bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
                  <FigmaIcon name="search" className="size-5 shrink-0 text-brand-text" />
                  <span className="sr-only">{t("what")}</span>
                  <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("searchWhat")}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
                </label>
                <div className="flex min-h-14 min-w-0 items-center gap-2 rounded-xl bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
                  <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand-text" />
                  <div className="min-w-0 flex-1">
                    <CityFilter
                      cities={cities.map((c) => { const name = cityName(c).text; return { id: c.id, label: name, name }; })}
                      allLabel={t("anyCity")}
                      cityLabel={t("where")}
                      fieldClass="min-h-11 w-full text-sm text-ink outline-none"
                      chevron={false}
                    />
                  </div>
                  <FigmaIcon name="chevron-down" className="pointer-events-none size-4 shrink-0 text-muted" />
                </div>
                <button type="submit" className="min-h-14 rounded-[15px] bg-brand px-8 text-[18px] font-bold text-brand-ink transition hover:bg-brand-hover">
                  {tn("search")}
                </button>
              </form>
          </div>
        </section>

        <section className={`${BAND} mt-3`} aria-label={t("factGermany")}>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 rounded-xl bg-surface px-4 py-3 text-xs font-bold text-ink sm:text-sm">
            {[t("factFree"), t("factLang"), t("factGermany")].map((label) => (
              <li key={label} className="inline-flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Categories: six clear entry points + all ---------- */}
        {rootCategories.length > 0 && (
          <section className="" aria-labelledby="home-cats">
            <div className={`${BAND} pt-8`}>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">

                  <h2 id="home-cats" className="text-xl font-extrabold leading-tight sm:text-[28px]">{t("browseByCategory")}</h2>
                </div>
                <Link href="/businesses" className="shrink-0 text-sm font-bold text-brand-text hover:underline">{t("viewAll")}<span className="sr-only">: {t("browseByCategory")}</span></Link>
              </div>
              <nav aria-label={t("categoriesTitle")} className="mt-4">
                <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                  {rootCategories.slice(0, 12).map((c) => (
                    <li key={c.id} className="min-w-0">
                      <Link href={`/businesses/${c.slug}`} className="rega-card flex h-full min-h-[94px] flex-col items-start justify-center gap-2 px-3 py-3 text-start transition-colors hover:text-brand-text">
                        <span className="grid size-7 place-items-center">
                          <FigmaIcon name={CATEGORY_ICON[c.slug] ?? "briefcase-business"} className="size-6 shrink-0 text-brand-text" />
                        </span>
                        <span className="line-clamp-2 text-[13px] font-semibold leading-snug"><Text value={categoryName(c)} pageLang={pageLang} /></span>
                      </Link>
                    </li>
                  ))}

                </ul>
              </nav>
            </div>
          </section>
        )}

        {/* ---------- Recently added: compact result cards ---------- */}
        <section className="" aria-labelledby="home-latest">
          <div className={`${BAND} pt-10`}>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">

                <h2 id="home-latest" className="text-xl font-extrabold leading-tight sm:text-[28px]">{t("popularTitle")}</h2>
                <p className="mt-1 text-sm text-muted">{t("latestSub")}</p>
              </div>
              {/* The hidden part names the target, so the link is descriptive for screen readers and search engines. */}
              <Link href="/businesses?sort=newest" className="shrink-0 text-sm font-bold text-brand-text hover:underline">{t("seeMore")}<span className="sr-only">: {t("popularTitle")}</span></Link>
            </div>
            {latest.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {latest.slice(0, 4).map((b) => {
                  const c = categoryOf(b.categoryId);
                  return <BusinessRow layout="home" viewLabel={tc("viewDetails")} key={b.id} b={b} locale={l} pageLang={pageLang} category={c ? categoryName(c) : null} />;
                })}
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-ink">{t("emptyListings")}</p>
                  <p className="mt-1 max-w-lg text-sm leading-6 text-muted">{te("beFirstBody")}</p>
                </div>
                <Link href="/for-business" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover" data-testid="home-be-first">{te("beFirstCta")}</Link>
              </div>
            )}
          </div>
        </section>

        <section className={`${BAND} pt-12`} aria-label={tn("addAd")}>
          <div className="flex min-h-[210px] flex-col items-start justify-center gap-4 rounded-[20px] bg-brand p-6 text-brand-ink">
            <h2 className="text-2xl font-bold lg:text-[31px]">{tn("addAd")}</h2>
            <Link href="/for-business" className="inline-flex min-h-11 items-center rounded-xl border border-current px-5 font-bold hover:bg-surface hover:text-ink">{te("beFirstCta")}</Link>
          </div>
        </section>
        {data && <dl className={`${BAND} flex flex-wrap gap-8 py-8 text-lg font-bold`}>
          {([["statsBusinesses", data.stats.businesses], ["statsServices", data.stats.services], ["statsLocations", data.stats.locations]] as const).map(([key, value]) => <div key={key}><dd>{value.toLocaleString(l)}</dd><dt className="text-sm text-muted">{t(key)}</dt></div>)}
        </dl>}
        <section className={`${BAND} py-5`} aria-labelledby="home-major-cities">
          <h2 id="home-major-cities" className="text-[22px] font-bold lg:text-[28px]">{t("citiesTitle")}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {majorCities.map((c) => <li key={c.id}><Link href={`/city/${c.slug}`} className="rega-card flex min-h-[100px] items-center p-5 font-bold lg:min-h-[120px]"><Text value={cityName(c)} pageLang={pageLang} /></Link></li>)}
          </ul>
        </section>

        {/* ---------- Compact AI entry ---------- */}
        <section className="" aria-label={t("ctaAI")}>
          <div className={`${BAND} pt-8`}>
            <Link href="/ai" className="group flex min-h-[72px] items-stretch overflow-hidden rounded-xl border border-brand/40 bg-surface transition hover:border-brand hover:shadow-card" data-testid="home-ai-entry">
              <span className="grid w-16 shrink-0 place-items-center bg-brand text-brand-ink sm:w-20"><FigmaIcon name="sparkles" className="size-7" /></span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-start sm:gap-4">
                <span className="shrink-0 text-base font-extrabold text-ink" dir="auto">{t("ctaAI")}</span>
                <span className="min-w-0 text-sm text-muted">{t("aiEntrySub")}</span>
              </span>
              <span className="grid shrink-0 place-items-center px-4 text-brand-text"><FigmaIcon name="arrow-right" className="rtl-flip size-6 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span>
            </Link>
          </div>
        </section>

        {/* ---------- Nearby: list + map ---------- */}
        <section className="" aria-labelledby="home-nearby">
          <div className={`${BAND} pb-10 pt-10`}>
            {pool.length === 0 ? (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">

                    <h2 id="home-nearby" className="text-xl font-extrabold leading-tight sm:text-[28px]">{t("citiesTitle")}</h2>
                    <p className="mt-1 text-sm text-muted">{t("citiesSub")}</p>
                  </div>
                  <Link href="/nearby" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-brand px-3.5 text-sm font-bold text-brand-text transition-colors hover:bg-brand hover:text-brand-ink">
                    <FigmaIcon name="crosshair" className="size-4 shrink-0" />{t("locateMe")}
                  </Link>
                </div>
                <div className={`mt-4 grid grid-cols-1 gap-4 ${cityPoints.length > 0 ? "lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.2fr)]" : ""}`}>
                  <ul className={`grid grid-cols-2 gap-2.5 ${cityPoints.length > 0 ? "" : "sm:grid-cols-4"}`}>
                    {majorCities.map((c) => (
                      <li key={c.id}>
                        <Link href={`/city/${c.slug}`} className="rega-card flex min-h-14 items-center gap-2.5 px-3.5 py-3 text-sm font-bold hover:text-brand-text">
                          <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand-text" />
                          <span className="truncate"><Text value={cityName(c)} pageLang={pageLang} /></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {/* No coordinates to show (e.g. the city lookup failed): no empty grey map frame. */}
                  {cityPoints.length > 0 && (
                    <div className="relative min-h-72 overflow-hidden rounded-2xl border border-line bg-[var(--map)]">
                      <PlacesMap points={cityPoints} className="absolute inset-0" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">

                    <h2 id="home-nearby" className="text-xl font-extrabold leading-tight sm:text-[28px]">{t("nearTitle")}</h2>
                    <p className="mt-1 text-sm text-muted">{t("nearbySub")}</p>
                  </div>
                  <Link href="/nearby" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-brand px-3.5 text-sm font-bold text-brand-text transition-colors hover:bg-brand hover:text-brand-ink">
                    <FigmaIcon name="crosshair" className="size-4 shrink-0" />{t("locateMe")}
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:h-[340px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                  <ul className="flex flex-col overflow-y-auto rounded-xl border border-line">
                    {pool.map((b) => {
                      const c = categoryOf(b.categoryId);
                      return (
                        <li key={b.id} className="relative flex min-h-[64px] items-center gap-3 border-b border-line bg-surface px-3.5 py-2.5 last:border-b-0 hover:bg-surface-2">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft">
                            <FigmaIcon name={(c && ROW_ICON[c.slug]) || "building-2"} className="size-5 text-brand-text" />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <Link href={`/business/${b.slug}`} className="truncate text-sm font-bold after:absolute after:inset-0 after:content-['']">
                              <Text value={localize(b, "name", l)} pageLang={pageLang} />
                            </Link>
                            {c && <span className="truncate text-xs text-muted"><Text value={categoryName(c)} pageLang={pageLang} /></span>}
                          </div>
                          <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0 text-brand-text" />
                        </li>
                      );
                    })}
                  </ul>
                  {mapPoints.length > 0 && (
                    <div className="relative min-h-64 overflow-hidden rounded-xl border border-line bg-[var(--map)] lg:min-h-0">
                      <PlacesMap points={mapPoints} className="absolute inset-0" />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Below the frame: unchanged REGA section. */}
      <div className="container-page" style={{ maxWidth: "80rem" }}>
        <SocialSection />
      </div>
    </>
  );
}
