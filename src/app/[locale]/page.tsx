import { PageSchema } from "@/components/ui/PageSchema";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LOCALE_META, isLocale, type Locale } from "@/i18n/locales";
import { CATEGORY_ICON, FigmaIcon } from "@/components/home/FigmaIcon";
import { Icon3D, StoreArt, hasIcon3D } from "@/components/home/Icon3D";
import { softHyphenate } from "@/lib/soft-hyphen";
import { MapBannerArt } from "@/components/home/HomeArt";
import { HomeBusinessCard } from "@/components/home/HomeBusinessCard";
import { HomeBusinessTabs, type BusinessTab } from "@/components/home/HomeBusinessTabs";
import { LogoMark } from "@/components/ui/Logo";
import { SocialSection } from "@/components/home/SocialSection";
import { Text } from "@/components/ui/Bidi";
import { localize } from "@/lib/content";
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, getHomeData, listSelectorCities, type HomeBusinessData } from "@/lib/data";
import { CityFilter } from "@/components/ui/CityFilter";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";
import { TRAVEL_ROOT_KEYS } from "@/config/travel";
import { TravelBanner } from "@/components/travel/TravelBanner";
import { sectionEnabled } from "@/config/sections";

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
  const tt = await getTranslations("travel");
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
  /** Tile labels: soft hyphens let long Latin words ("Administration") break cleanly in narrow tiles. */
  const tileName = (c: (typeof categories)[number]) => { const v = categoryName(c); return { ...v, text: softHyphenate(v.text) }; };
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

  // Banner shortcuts of the owner's reference. Each one points at a route that already exists; a category that is
  // not seeded falls back to the full directory, so the banner never links into a 404.
  const catHref = (slug: string) => (categories.some((c) => c.slug === slug) ? `/businesses/${slug}` : "/businesses");
  const bannerCards = [
    { key: "shopping", label: t("cardShopping"), icon: "store", href: catHref("groceries-markets") },
    { key: "jobs", label: t("cardJobs"), icon: "briefcase-business", href: "/jobs" },
    { key: "food", label: t("cardFood"), icon: "utensils", href: catHref("food") },
    { key: "more", label: t("cardMore"), icon: "layout-grid", href: "/businesses" },
    { key: "services", label: t("cardServices"), icon: "hammer", href: "/services" },
    { key: "health", label: t("cardHealth"), icon: "heart-pulse", href: catHref("health") },
  ];

  // Rega24Travel: one tile for its two top-level categories (they stay reachable on /travel and in "explore").
  const travelOn = sectionEnabled("travel") && rootCategories.some((c) => (TRAVEL_ROOT_KEYS as readonly string[]).includes(c.slug));
  const tiles = (travelOn ? rootCategories.filter((c) => !(TRAVEL_ROOT_KEYS as readonly string[]).includes(c.slug)) : rootCategories).slice(0, travelOn ? 10 : 11);
  const extraFrom = travelOn ? 6 : 7;

  return (
    <>
      <div className="figma rega-home text-ink">
        <PageSchema name={`${t("bannerTitle")} ${t("bannerAccent")}`} description={t("bannerLead")} />
        {degraded && <NoEdgeCache />}

        {/* ---------- Banner (owner reference 2026-11-21): the owner's own 3D plate, with the headline, search and
             category shortcuts as live DOM on top so search, the city selector and the category routes keep working ---------- */}
        <section className="rega-banner rega-editorial-hero" aria-labelledby="home-hero-title">
          <div className="rb-frame">
            <div className="rb-inner">
              <div className="rb-copy">
                <h1 id="home-hero-title" className="rb-title">
                  <span className="rb-title-1">{t("bannerTitle")}</span>{" "}
                  <span className="rb-title-2">{t("bannerAccent")}</span>
                </h1>
                <p className="rb-lead">{t("bannerLead")}</p>
              </div>
              {/* Keeps the headline and the controls on the reference's own thirds; the plate shows through. */}
              <div className="rb-stage" aria-hidden="true" />
              <form action={`/${locale}/businesses`} role="search" className="rega-home-search rb-search">
                <div className="rb-search-loc">
                  <FigmaIcon name="map-pin" className="rb-search-pin" />
                  <div className="min-w-0 flex-1">
                    <CityFilter
                      cities={cities.map((c) => { const name = cityName(c).text; return { id: c.id, label: name, name }; })}
                      allLabel={t("anyCity")}
                      cityLabel={t("where")}
                      fieldClass="rb-city-field"
                    />
                  </div>
                </div>
                <label className="rb-search-q">
                  <span className="sr-only">{t("what")}</span>
                  <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("ask")} className="rb-search-input" />
                  <FigmaIcon name="search" className="rb-search-q-icon" />
                </label>
                <button type="submit" className="rb-search-btn" aria-label={tn("search")}>
                  <FigmaIcon name="search" className="" />
                </button>
              </form>
              <nav className="rb-cards" aria-label={t("categoriesTitle")}>
                {bannerCards.map((c) => (
                  <Link key={c.key} href={c.href} className="rb-card" data-testid={`banner-card-${c.key}`}>
                    <FigmaIcon name={c.icon} className="" />
                    <span className="rb-card-label">{c.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </section>

        {/* ---------- Category tiles (the real category system) ---------- */}
        {tiles.length > 0 && (
          <nav aria-label={t("categoriesTitle")} className={`${BAND} rh-tiles-band`}>
            <ul className="rh-tiles">
              {travelOn && (
                <li>
                  <Link href="/travel" className="rh-tile rh-tile-travel" data-testid="home-travel-tile">
                    <span className="rh-tile-badge">{tt("newBadge")}</span>
                    <Icon3D name="travel" className="rh-tile-art" />
                    <span className="rh-tile-label">{tn("travel")}</span>
                  </Link>
                </li>
              )}
              {tiles.map((c, i) => (
                <li key={c.id} className={i >= extraFrom ? "rh-tile-extra" : undefined}>
                  <Link href={`/businesses/${c.slug}`} className="rh-tile">
                    {hasIcon3D(c.slug)
                      ? <Icon3D name={c.slug} className="rh-tile-art" />
                      : <FigmaIcon name={CATEGORY_ICON[c.slug] ?? "briefcase-business"} className="rh-tile-icon" />}
                    <span className="rh-tile-label"><Text value={tileName(c)} pageLang={pageLang} /></span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/businesses" className="rh-tile">
                  <Icon3D name="more" className="rh-tile-art" />
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
              <StoreArt className="rh-empty-art" />
              <Link href="/for-business" className="rh-btn-red" data-testid="home-be-first">
                <FigmaIcon name="plus" className="size-5 shrink-0" />
                {te("beFirstCta")}
              </Link>
            </div>
          )}
        </section>

        {/* ---------- Rega24Travel banner (owner 2026-11-18): replaces the map banner; the map stays on the «نزیک» tab ---------- */}
        {travelOn ? (
          <TravelBanner className={`${BAND} rh-section`} />
        ) : (
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
        )}
      </div>

      {/* Below the frame: unchanged REGA section. */}
      <div className="container-page" style={{ maxWidth: "80rem" }}>
        <SocialSection />
      </div>
    </>
  );
}
