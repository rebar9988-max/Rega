import { PageSchema } from "@/components/ui/PageSchema";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LOCALES, LOCALE_META, formatNumber, isLocale, type Locale } from "@/i18n/locales";
import { CATEGORY_ICON, FigmaIcon, ROW_ICON } from "@/components/home/FigmaIcon";
import { HomeHeroArt, HomeHeroSwoosh, StoreArt, WorldArt } from "@/components/home/HomeArt";
import { HomeBusinessCard } from "@/components/home/HomeBusinessCard";
import { SocialSection } from "@/components/home/SocialSection";
import { Text } from "@/components/ui/Bidi";
import { countryName, localize } from "@/lib/content";
import { PlacesMap, type PlacePoint } from "@/components/map/PlacesMap";
import { isValidCoordinate } from "@/lib/coordinates";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, getHomeData, listCitiesBySlug, listSelectorCities } from "@/lib/data";
import { HOME_SHOWCASE_CITY_SLUGS, MAJOR_CITY_SLUGS } from "@/lib/selector-cities";
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

/** Section heading row: title at the start, red "see all" link at the end (arrow follows the reading direction). */
function SectionHead({ id, title, sub, href, linkLabel }: { id: string; title: string; sub?: string; href: string; linkLabel: string }) {
  return (
    <div className="rh-head">
      <div className="min-w-0">
        <h2 id={id} className="rh-h2">{title}</h2>
        {sub && <p className="rh-sub">{sub}</p>}
      </div>
      <Link href={href} className="rh-more">
        {linkLabel}<span className="sr-only">: {title}</span>
        <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0" />
      </Link>
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Pages render in parallel with the layout, so stray requests (e.g. /favicon.ico) must be rejected here too.
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");
  const te = await getTranslations("empty");
  const l = locale as Locale;
  const pageLang = LOCALE_META[l].htmlLang;
  let degraded = false;
  const failed = () => { degraded = true; };
  const [data, categories, cities, showcase] = await Promise.all([
    homeData(),
    safe(getCategories, [], failed),
    safe(() => listSelectorCities({ countryCode: DEFAULT_PUBLIC_COUNTRY_CODE }), [], failed),
    safe(() => listCitiesBySlug(HOME_SHOWCASE_CITY_SLUGS), [], failed),
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

  const chips = [
    { href: "/businesses", icon: "layout-grid", label: tn("categories") },
    { href: "/locations", icon: "building-2", label: tn("locations") },
    { href: "/nearby", icon: "crosshair", label: tn("nearby") },
    { href: "/businesses?sort=newest", icon: "store", label: t("chipNewest") },
  ];
  const trust = [
    { icon: "shield-check", tone: "rh-tone-ok", title: t("trustReviewed"), sub: t("trustReviewedSub") },
    { icon: "languages", tone: "rh-tone-brand", title: t("trustLanguages"), sub: t("trustLanguagesSub") },
    { icon: "globe", tone: "rh-tone-geo", title: t("trustGlobal"), sub: t("trustGlobalSub") },
    { icon: "heart", tone: "rh-tone-brand", title: t("trustFree"), sub: t("trustFreeSub") },
  ];
  // Every figure is real: counted published records, the registered interface languages and the free platform.
  const stats = [
    ...(data ? [
      { icon: "building-2", value: formatNumber(data.stats.businesses, l), label: t("statsBusinesses") },
      { icon: "map-pin", value: formatNumber(data.stats.locations, l), label: t("statsLocations") },
    ] : []),
    { icon: "languages", value: formatNumber(LOCALES.length, l), label: t("statsLanguages") },
    ...(rootCategories.length > 0 ? [{ icon: "layout-grid", value: formatNumber(rootCategories.length, l), label: t("statsCategories") }] : []),
    { icon: "heart", value: formatNumber(1, l, { style: "percent" }), label: t("statsFree") },
  ];

  return (
    <>
      <div className="figma rega-home text-ink">
        <PageSchema name={`${t("communityTitle")} ${t("communityAccent")}`} description={t("communityLead")} />
        {degraded && <NoEdgeCache />}

        {/* ---------- Hero: world artwork, headline, global search, quick links ---------- */}
        <section className="rh-hero rega-editorial-hero" aria-labelledby="home-hero-title">
          <div className="rh-hero-art" aria-hidden="true"><HomeHeroArt className="rh-hero-svg" /></div>
          <div className="rh-hero-fade" aria-hidden="true" />
          <HomeHeroSwoosh className="rh-hero-swoosh" />
          <div className={`${BAND} rh-hero-inner`}>
            <div className="rh-hero-copy">
              <h1 id="home-hero-title" className="rh-h1">
                {t("communityTitle")}<span className="rh-h1-accent">{t("communityAccent")}</span>
              </h1>
              <p className="rh-lead">{t("communityLead")}</p>
            </div>
            <form action={`/${locale}/businesses`} role="search" className="rega-home-search rh-search">
              <label className="rh-search-q">
                <FigmaIcon name="search" className="size-5 shrink-0 text-brand-text" />
                <span className="sr-only">{t("what")}</span>
                <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("searchWhat")} className="rh-search-input" />
              </label>
              <div className="rh-search-loc">
                <FigmaIcon name="map-pin" className="size-5 shrink-0 text-brand-text" />
                <div className="min-w-0 flex-1">
                  <CityFilter
                    cities={cities.map((c) => { const name = cityName(c).text; return { id: c.id, label: name, name }; })}
                    allLabel={t("anyCity")}
                    cityLabel={t("where")}
                    fieldClass="min-h-11 w-full text-[15px] text-ink outline-none"
                    chevron={false}
                  />
                </div>
                <FigmaIcon name="chevron-down" className="pointer-events-none size-4 shrink-0 text-muted" />
              </div>
              <button type="submit" className="rh-search-btn">
                <FigmaIcon name="search" className="size-5 shrink-0" />
                {tn("search")}
              </button>
            </form>
            <nav aria-label={t("chipsLabel")} className="rh-chips-wrap">
              <ul className="rh-chips">
                {chips.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className="rh-chip">
                      <FigmaIcon name={c.icon} className="size-[18px] shrink-0 text-brand-text" />
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        {/* ---------- Trust strip ---------- */}
        <section className={`${BAND} rh-trust-band`} aria-label={t("trustLabel")}>
          <ul className="rh-trust">
            {trust.map((item) => (
              <li key={item.title} className="rh-trust-item">
                <span className={`rh-trust-icon ${item.tone}`}><FigmaIcon name={item.icon} className="size-7" /></span>
                <span className="min-w-0">
                  <span className="rh-trust-title">{item.title}</span>
                  <span className="rh-trust-sub">{item.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Main categories ---------- */}
        {rootCategories.length > 0 && (
          <section className={`${BAND} rh-section`} aria-labelledby="home-cats">
            <SectionHead id="home-cats" title={t("mainCategories")} href="/businesses" linkLabel={t("allCategories")} />
            <nav aria-label={t("categoriesTitle")}>
              <ul className="rh-cats">
                {rootCategories.slice(0, 19).map((c) => (
                  <li key={c.id} className="rh-cat-item">
                    <Link href={`/businesses/${c.slug}`} className="rh-cat">
                      <FigmaIcon name={CATEGORY_ICON[c.slug] ?? "briefcase-business"} className="rh-cat-icon" />
                      <span className="rh-cat-label"><Text value={categoryName(c)} pageLang={pageLang} /></span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/businesses" className="rh-cat">
                    <FigmaIcon name="more-horizontal" className="rh-cat-icon" />
                    <span className="rh-cat-label">{t("moreCategories")}</span>
                  </Link>
                </li>
              </ul>
            </nav>
          </section>
        )}

        {/* ---------- Businesses ---------- */}
        <section className={`${BAND} rh-section`} aria-labelledby="home-latest">
          <SectionHead id="home-latest" title={t("popularTitle")} sub={t("latestSub")} href="/businesses?sort=newest" linkLabel={t("seeMore")} />
          {latest.length > 0 ? (
            <div className="rh-bizgrid">
              {latest.slice(0, 4).map((b) => {
                const c = categoryOf(b.categoryId);
                return <HomeBusinessCard key={b.id} b={b} locale={l} pageLang={pageLang} category={c ? categoryName(c) : null} viewLabel={t("viewProfile")} />;
              })}
            </div>
          ) : (
            <div className="rh-empty">
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-ink">{t("emptyListings")}</p>
                <p className="mt-1 max-w-lg text-sm leading-6 text-muted">{te("beFirstBody")}</p>
              </div>
              <Link href="/for-business" className="rh-btn-red" data-testid="home-be-first">{te("beFirstCta")}</Link>
            </div>
          )}
        </section>

        {/* ---------- Promotional banners ---------- */}
        <section className={`${BAND} rh-section rh-banners`} aria-label={t("bannerAddTitle")}>
          <div className="rh-banner rh-banner--red">
            <div className="rh-banner-copy">
              <h2 className="rh-banner-title">{t("bannerAddTitle")}</h2>
              <p className="rh-banner-text">{t("bannerAddSub")}</p>
              <Link href="/for-business" className="rh-banner-cta">
                {t("bannerAddCta")}
                <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0" />
              </Link>
            </div>
            <StoreArt className="rh-banner-art" />
          </div>
          <div className="rh-banner rh-banner--soft">
            <div className="rh-banner-copy">
              <h2 className="rh-banner-title">{t("bannerGlobalTitle")}</h2>
              <p className="rh-banner-text">{t("bannerGlobalSub")}</p>
              <Link href="/businesses" className="rh-banner-cta">
                {t("bannerGlobalCta")}
                <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0" />
              </Link>
            </div>
            <WorldArt className="rh-banner-art" />
          </div>
        </section>

        {/* ---------- Real platform figures ---------- */}
        <section className={`${BAND} rh-section-tight`} aria-label={t("statsLabel")}>
          <ul className="rh-stats">
            {stats.map((s) => (
              <li key={s.label} className="rh-stat">
                <span className="rh-stat-icon"><FigmaIcon name={s.icon} className="size-6" /></span>
                <span className="min-w-0">
                  <span className="rh-stat-value">{s.value}</span>
                  <span className="rh-stat-label">{s.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Popular cities (Kurdistan Region / Iraq and Europe) ---------- */}
        {showcase.length > 0 && (
          <section className={`${BAND} rh-section`} aria-labelledby="home-major-cities">
            <SectionHead id="home-major-cities" title={t("citiesHeading")} href="/locations" linkLabel={t("allCities")} />
            <ul className="rh-cities">
              {showcase.map((c) => (
                <li key={c.id}>
                  <Link href={`/city/${c.slug}`} className="rh-city">
                    <span className="rh-city-pin"><FigmaIcon name="map-pin" className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="rh-city-name"><Text value={cityName(c)} pageLang={pageLang} /></span>
                      <span className="rh-city-meta">
                        {countryName(c.country, l)}
                        {c.count > 0 && <> · {t("cityCount", { count: c.count })}</>}
                      </span>
                    </span>
                    <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0 text-brand-text" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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
