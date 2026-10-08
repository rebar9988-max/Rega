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
import { DEFAULT_PUBLIC_COUNTRY_CODE, getCategories, getCities, getHomeData } from "@/lib/data";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";

/** The landing page must render even if the database is briefly unavailable. */
async function homeData() {
  try { return await getHomeData(); } catch (error) { log.error("home.data", { error: String(error) }); return null; }
}

/** Content band shared by the home sections (same width as the hero). */
const BAND = "mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8";

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
  const te = await getTranslations("empty");
  const l = locale as Locale;
  const pageLang = LOCALE_META[l].htmlLang;
  let degraded = false;
  const failed = () => { degraded = true; };
  const [data, categories, cities] = await Promise.all([
    homeData(),
    safe(getCategories, [], failed),
    safe(() => getCities({ countryCode: DEFAULT_PUBLIC_COUNTRY_CODE }), [], failed),
  ]);
  if (!data) degraded = true;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryName = (c: (typeof categories)[number]) => localize({ ...c, name: c.nameDe }, "name", l);
  const categoryOf = (id: string | null | undefined) => (id ? categoryById.get(id) : undefined);
  const cityName = (c: { nameEn: string } & Record<string, unknown>) => localize({ ...c, name: c.nameEn }, "name", l);
  const rootCategories = categories.filter((c) => !c.parentId);

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
      <div className="figma text-ink">
        <PageSchema name={t("ask")} description={t("lead")} />
        {degraded && <NoEdgeCache />}

        {/* ---------- Hero: search first (approved concept, page 2) ---------- */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-[1220px] px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
              <div className="flex flex-col justify-center py-4 text-start lg:py-10">
                <span className="rega-kicker" aria-hidden="true" />
                <h1 className="rega-display mt-5 max-w-xl text-[clamp(2.3rem,4.6vw,4.25rem)]">{t("ask")}</h1>
                <p className="mt-4 max-w-lg text-base leading-7 text-muted">{t("heroLead")}</p>
              </div>
              {/* Official REGA artwork on its own red field; the slanted edge echoes the concept's red diagonal. */}
              <div className="rega-hero-panel relative hidden min-h-[320px] overflow-hidden lg:grid lg:place-items-center" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/rega-logo.webp" alt="" width={320} height={320} decoding="async" fetchPriority="high" className="w-[min(58%,300px)] select-none" />
              </div>
            </div>

            <form action={`/${locale}/businesses`} role="search"
              className="rega-search-shell relative z-10 mt-6 grid overflow-hidden sm:grid-cols-[minmax(0,1.5fr)_minmax(9rem,.7fr)_minmax(9rem,.7fr)_auto] lg:-mt-10 lg:me-[8%]">
              <label className="flex min-h-14 min-w-0 items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
                <FigmaIcon name="search" className="size-5 shrink-0 text-brand" />
                <span className="sr-only">{t("what")}</span>
                <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("searchWhat")}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
              </label>
              <label className="flex min-h-14 min-w-0 items-center gap-2 border-t border-line px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)] sm:border-s sm:border-t-0">
                <FigmaIcon name="grid-3x3" className="size-4 shrink-0 text-brand" />
                <span className="sr-only">{t("categoriesTitle")}</span>
                <select name="category" defaultValue="" aria-label={t("categoriesTitle")} className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-sm text-ink outline-none">
                  <option value="">{t("allSections")}</option>
                  {rootCategories.map((c) => <option key={c.id} value={c.id}>{categoryName(c).text}</option>)}
                </select>
                <FigmaIcon name="chevron-down" className="pointer-events-none size-4 shrink-0 text-muted" />
              </label>
              <label className="flex min-h-14 min-w-0 items-center gap-2 border-t border-line px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)] sm:border-s sm:border-t-0">
                <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand" />
                <span className="sr-only">{t("where")}</span>
                <select name="city" defaultValue="" className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-sm text-ink outline-none">
                  <option value="">{t("anyCity")}</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c).text}</option>)}
                </select>
                <FigmaIcon name="chevron-down" className="pointer-events-none size-4 shrink-0 text-muted" />
              </label>
              <button type="submit" className="m-0 min-h-14 bg-brand px-9 text-[15px] font-bold text-white transition hover:bg-brand-hover sm:m-1.5 sm:min-h-0 sm:rounded-[0.55rem]">
                {tn("search")}
              </button>
            </form>
          </div>
        </section>

        {/* ---------- Categories: six clear entry points + all ---------- */}
        {rootCategories.length > 0 && (
          <section className="bg-surface" aria-labelledby="home-cats">
            <div className={`${BAND} pt-8`}>
              <div className="flex items-end justify-between gap-4">
                <h2 id="home-cats" className="text-xl font-extrabold leading-tight sm:text-[22px]">{t("browseByCategory")}</h2>
                <Link href="/businesses" className="shrink-0 text-sm font-bold text-brand hover:underline">{t("viewAll")}</Link>
              </div>
              <nav aria-label={t("categoriesTitle")} className="mt-4">
                <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
                  {rootCategories.slice(0, 6).map((c) => (
                    <li key={c.id} className="min-w-0">
                      <Link href={`/businesses/${c.slug}`} className="rega-card flex h-full min-h-[96px] flex-col items-center justify-center gap-2 px-2 py-3 text-center transition-colors hover:text-brand">
                        <FigmaIcon name={CATEGORY_ICON[c.slug] ?? "briefcase-business"} className="size-7 shrink-0 text-brand" />
                        <span className="line-clamp-2 text-[13px] font-semibold leading-snug"><Text value={categoryName(c)} pageLang={pageLang} /></span>
                      </Link>
                    </li>
                  ))}
                  <li className="min-w-0">
                    <Link href="/businesses" className="rega-card flex h-full min-h-[96px] flex-col items-center justify-center gap-2 px-2 py-3 text-center transition-colors hover:text-brand">
                      <FigmaIcon name="grid-3x3" className="size-7 shrink-0 text-brand" />
                      <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{t("allSections")}</span>
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </section>
        )}

        {/* ---------- Recently added: compact result cards ---------- */}
        <section className="bg-surface" aria-labelledby="home-latest">
          <div className={`${BAND} pt-10`}>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 id="home-latest" className="text-xl font-extrabold leading-tight sm:text-[22px]">{t("latestTitle")}</h2>
                <p className="mt-1 text-sm text-muted">{t("latestSub")}</p>
              </div>
              <Link href="/businesses?sort=newest" className="shrink-0 text-sm font-bold text-brand hover:underline">{t("seeMore")}</Link>
            </div>
            {latest.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {latest.slice(0, 3).map((b) => {
                  const c = categoryOf(b.categoryId);
                  return <BusinessRow key={b.id} b={b} locale={l} pageLang={pageLang} category={c ? categoryName(c) : null} />;
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
                <p>{t("emptyListings")}</p>
                <Link href="/for-business" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover" data-testid="home-be-first">{te("beFirstCta")}</Link>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Compact AI entry ---------- */}
        <section className="bg-surface" aria-label={t("ctaAI")}>
          <div className={`${BAND} pt-8`}>
            <Link href="/ai" className="group flex min-h-[72px] items-stretch overflow-hidden rounded-xl border border-brand/40 bg-surface transition hover:border-brand hover:shadow-card" data-testid="home-ai-entry">
              <span className="grid w-16 shrink-0 place-items-center bg-brand text-white sm:w-20"><FigmaIcon name="sparkles" className="size-7" /></span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-start sm:gap-4">
                <span className="shrink-0 text-base font-extrabold text-ink" dir="auto">{t("ctaAI")}</span>
                <span className="min-w-0 text-sm text-muted">{t("aiEntrySub")}</span>
              </span>
              <span className="grid shrink-0 place-items-center px-4 text-brand"><FigmaIcon name="arrow-right" className="rtl-flip size-6 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span>
            </Link>
          </div>
        </section>

        {/* ---------- Nearby: list + map ---------- */}
        <section className="bg-surface" aria-labelledby="home-nearby">
          <div className={`${BAND} pb-10 pt-10`}>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 id="home-nearby" className="text-xl font-extrabold leading-tight sm:text-[22px]">{t("nearTitle")}</h2>
                <p className="mt-1 text-sm text-muted">{t("nearbySub")}</p>
              </div>
              <Link href="/nearby" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-brand px-3.5 text-sm font-bold text-brand transition-colors hover:bg-brand hover:text-white">
                <FigmaIcon name="crosshair" className="size-4 shrink-0" />{t("locateMe")}
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:h-[340px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
              <ul className="flex flex-col overflow-y-auto rounded-xl border border-line">
                {pool.length === 0 && <li className="p-4 text-sm text-muted">{t("emptyListings")}</li>}
                {pool.map((b) => {
                  const c = categoryOf(b.categoryId);
                  return (
                    <li key={b.id} className="relative flex min-h-[64px] items-center gap-3 border-b border-line bg-surface px-3.5 py-2.5 last:border-b-0 hover:bg-surface-2">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft">
                        <FigmaIcon name={(c && ROW_ICON[c.slug]) || "building-2"} className="size-5 text-brand" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/business/${b.slug}`} className="truncate text-sm font-bold after:absolute after:inset-0 after:content-['']">
                          <Text value={localize(b, "name", l)} pageLang={pageLang} />
                        </Link>
                        {c && <span className="truncate text-xs text-muted"><Text value={categoryName(c)} pageLang={pageLang} /></span>}
                      </div>
                      <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0 text-brand" />
                    </li>
                  );
                })}
              </ul>
              <div className="relative min-h-64 overflow-hidden rounded-xl border border-line bg-[var(--map)] lg:min-h-0">
                {mapPoints.length > 0 && <PlacesMap points={mapPoints} className="absolute inset-0" />}
              </div>
            </div>
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
