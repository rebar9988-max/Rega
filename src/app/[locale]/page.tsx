import { PageSchema } from "@/components/ui/PageSchema";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LOCALE_META, isLocale, type Locale } from "@/i18n/locales";
import { CATEGORY_ICON, FigmaIcon } from "@/components/home/FigmaIcon";
import { HeroWorldArt, MapBannerArt } from "@/components/home/HomeArt";
import { HomeBusinessCard } from "@/components/home/HomeBusinessCard";
import { HomeBusinessTabs, type BusinessTab } from "@/components/home/HomeBusinessTabs";
import { HomeScroller } from "@/components/home/HomeScroller";
import { LogoMark } from "@/components/ui/Logo";
import { SocialSection } from "@/components/home/SocialSection";
import { Text } from "@/components/ui/Bidi";
import { localize } from "@/lib/content";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, getHomeData, listSelectorCities, type HomeBusinessData } from "@/lib/data";
import { CityFilter } from "@/components/ui/CityFilter";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";
import { responsiveImage } from "@/features/business-images/variants";

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
  const ts = await getTranslations("sort");
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
  const cityName = (c: { nameEn: string } & Record<string, unknown>) => localize({ ...c, name: c.nameEn }, "name", l);
  const rootCategories = categories.filter((c) => !c.parentId);
  /** Top-level category of a (sub-)category id. */
  const rootOf = (id: string | null | undefined) => {
    let c = id ? categoryById.get(id) : undefined;
    for (let i = 0; c?.parentId && i < 5; i++) c = categoryById.get(c.parentId) ?? c;
    return c;
  };
  const iconOf = (id: string | null | undefined) => {
    const own = id ? categoryById.get(id) : undefined;
    return (own && CATEGORY_ICON[own.slug]) || CATEGORY_ICON[rootOf(id)?.slug ?? ""] || "briefcase-business";
  };

  // Business filters of the reference, each from real records: featured (pinned), open now (computed in the browser
  // from stored hours, over every card shown here), top rated (real reviews only) and the newest.
  const card = (b: HomeBusinessData) => {
    const c = b.categoryId ? categoryById.get(b.categoryId) : undefined;
    const loc = b.locations[0];
    return {
      id: b.id,
      node: <HomeBusinessCard b={b} locale={l} pageLang={pageLang} category={c ? categoryName(c) : null} icon={iconOf(b.categoryId)} />,
      hours: loc ? { value: loc.openingHours, countryCode: loc.countryCode, regionSlug: loc.city?.region?.slug } : undefined,
    };
  };
  const featured = (data?.featured ?? []).map(card);
  const topRated = (data?.topRated ?? []).map(card);
  const newest = (data?.latest ?? []).map(card);
  // Each business is rendered once; the tabs list ids.
  const seen = new Set<string>();
  const all = [...featured, ...topRated, ...newest].filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)));
  const ids = (list: { id: string }[]) => list.map((item) => item.id);
  const tabs: BusinessTab[] = [
    { key: "featured", label: ts("featured"), icon: "star", ids: ids(featured) },
    { key: "open", label: t("openNow"), icon: "clock", ids: ids(all), openOnly: true },
    { key: "top", label: t("tabTopRated"), icon: "trophy", ids: ids(topRated) },
    { key: "new", label: t("tabNew"), icon: "sparkles", ids: ids(newest) },
  ].filter((tab) => tab.ids.length > 0);

  // Photographic category row: a real cover photo from a published business of that category when one exists,
  // otherwise the category icon on the logo red. Never a stock photo.
  const coverByRoot = new Map<string, string>();
  for (const row of data?.covers ?? []) {
    const root = rootOf(row.categoryId);
    if (root && row.coverUrl && !coverByRoot.has(root.id)) coverByRoot.set(root.id, row.coverUrl);
  }
  const tiles = rootCategories.slice(0, 11);

  return (
    <>
      <div className="figma rega-home text-ink">
        <PageSchema name={`${t("findTitle")} ${t("findAccent")}`} description={t("findLead")} />
        {degraded && <NoEdgeCache />}

        {/* ---------- Hero: world skyline at sunset, headline, global search ---------- */}
        <section className="rh-hero rega-editorial-hero" aria-labelledby="home-hero-title">
          <div className="rh-hero-art" aria-hidden="true"><HeroWorldArt className="rh-hero-svg" /></div>
          <div className="rh-hero-shade" aria-hidden="true" />
          <div className={`${BAND} rh-hero-inner`}>
            <div className="rh-hero-copy">
              <p className="rh-eyebrow">{t("welcome")}</p>
              <h1 id="home-hero-title" className="rh-h1">
                {t("findTitle")} <span className="rh-h1-accent">{t("findAccent")}</span>
              </h1>
              <p className="rh-lead">{t("findLead")}</p>
            </div>
            <form action={`/${locale}/businesses`} role="search" className="rega-home-search rh-search">
              <label className="rh-search-q">
                <FigmaIcon name="search" className="size-5 shrink-0 text-ink" />
                <span className="sr-only">{t("what")}</span>
                <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("searchWhat")} className="rh-search-input" />
              </label>
              <div className="rh-search-loc">
                <FigmaIcon name="map-pin" className="size-5 shrink-0 text-ink" />
                <div className="min-w-0 flex-1">
                  <CityFilter
                    cities={cities.map((c) => { const name = cityName(c).text; return { id: c.id, label: name, name }; })}
                    allLabel={t("anyCity")}
                    cityLabel={t("where")}
                    fieldClass="min-h-11 w-full text-[15px] text-ink outline-none"
                    chevron={false}
                  />
                </div>
              </div>
              {rootCategories.length > 0 && (
                <label className="rh-search-cat">
                  <FigmaIcon name="layout-grid" className="rh-search-cat-icon size-5 shrink-0 text-ink" />
                  <FigmaIcon name="sliders-horizontal" className="rh-search-filter-icon size-5 shrink-0 text-ink" />
                  <span className="sr-only">{t("categoryLabel")}</span>
                  {/* Category id: /businesses redirects ?category=<id> to the readable category URL, keeping q and city. */}
                  <select name="category" defaultValue="" className="rh-search-select">
                    <option value="">{t("allCategories")}</option>
                    {rootCategories.map((c) => <option key={c.id} value={c.id}>{categoryName(c).text}</option>)}
                  </select>
                  <FigmaIcon name="chevron-down" className="rh-search-chevron pointer-events-none size-4 shrink-0 text-ink" />
                </label>
              )}
              <button type="submit" className="rh-search-btn">
                <FigmaIcon name="search" className="size-5 shrink-0" />
                {tn("search")}
              </button>
            </form>
          </div>
        </section>

        {/* ---------- Category tiles (the real category system) ---------- */}
        {tiles.length > 0 && (
          <nav aria-label={t("categoriesTitle")} className={`${BAND} rh-tiles-band`}>
            <ul className="rh-tiles">
              {tiles.map((c, i) => (
                <li key={c.id} className={i >= 7 ? "rh-tile-extra" : undefined}>
                  <Link href={`/businesses/${c.slug}`} className="rh-tile">
                    <FigmaIcon name={CATEGORY_ICON[c.slug] ?? "briefcase-business"} className="rh-tile-icon" />
                    <span className="rh-tile-label"><Text value={categoryName(c)} pageLang={pageLang} /></span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/businesses" className="rh-tile">
                  <FigmaIcon name="more-horizontal" className="rh-tile-icon" />
                  <span className="rh-tile-label">{t("moreCategories")}<span className="sr-only">: {t("allCategories")}</span></span>
                </Link>
              </li>
            </ul>
          </nav>
        )}

        {/* ---------- Popular businesses with real filters ---------- */}
        <section className={`${BAND} rh-section`} aria-labelledby="home-latest">
          <SectionHead id="home-latest" title={t("popularBusinesses")} href="/businesses" linkLabel={t("viewAll")} />
          {tabs.length > 0 ? (
            <HomeBusinessTabs items={all} tabs={tabs} label={t("tabsLabel")} emptyLabel={t("tabEmpty")} />
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

        {/* ---------- Explore by category (photographic row) ---------- */}
        {rootCategories.length > 0 && (
          <section className={`${BAND} rh-section`} aria-labelledby="home-explore">
            <SectionHead id="home-explore" title={t("exploreTitle")} href="/businesses" linkLabel={t("viewAll")} />
            <HomeScroller nextLabel={t("exploreNext")}>
              <ul className="rh-explore">
                {rootCategories.map((c) => {
                  const cover = coverByRoot.get(c.id);
                  const icon = CATEGORY_ICON[c.slug] ?? "briefcase-business";
                  return (
                    <li key={c.id}>
                      <Link href={`/businesses/${c.slug}`} className="rh-explore-card">
                        <span className="rh-explore-media">
                          {cover
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img {...responsiveImage(cover)} sizes="180px" alt="" width={240} height={150} loading="lazy" decoding="async" className="rh-explore-img" />
                            : <span className="rh-explore-fallback"><FigmaIcon name={icon} className="size-10" /></span>}
                        </span>
                        <span className="rh-explore-label">
                          <FigmaIcon name={icon} className="size-4 shrink-0 text-brand" />
                          <span className="min-w-0 truncate"><Text value={categoryName(c)} pageLang={pageLang} /></span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </HomeScroller>
          </section>
        )}

        {/* ---------- Compact global map banner: the full map opens only from here (or /nearby) ---------- */}
        <section className={`${BAND} rh-section`} aria-labelledby="home-map">
          <div className="rh-mapbanner">
            <MapBannerArt className="rh-mapbanner-art" />
            <LogoMark className="rh-mapbanner-logo" />
            <div className="rh-mapbanner-copy">
              <h2 id="home-map" className="rh-mapbanner-title">{t("mapTitle")}</h2>
              <p className="rh-mapbanner-sub">{t("mapSub")}</p>
            </div>
            <Link href="/nearby" className="rh-mapbanner-cta">
              <FigmaIcon name="map" className="size-5 shrink-0" />
              {t("mapCta")}
              <FigmaIcon name="chevron-right" className="rtl-flip size-4 shrink-0" />
            </Link>
          </div>
        </section>

        {/* ---------- Compact AI entry (existing feature) ---------- */}
        <section aria-label={t("ctaAI")}>
          <div className={`${BAND} pb-10 pt-6`}>
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
      </div>

      {/* Below the frame: unchanged REGA section. */}
      <div className="container-page" style={{ maxWidth: "80rem" }}>
        <SocialSection />
      </div>
    </>
  );
}
