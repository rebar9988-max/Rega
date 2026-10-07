import { PageSchema } from "@/components/ui/PageSchema";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LOCALE_META, isLocale, type Locale } from "@/i18n/locales";
import { CATEGORY_ICON, FigmaIcon, ROW_ICON } from "@/components/home/FigmaIcon";
import { LatestCard } from "@/components/home/LatestCard";
import { SocialSection } from "@/components/home/SocialSection";
import { Text } from "@/components/ui/Bidi";
import { localize } from "@/lib/content";
import { PlacesMap, type PlacePoint } from "@/components/map/PlacesMap";
import { isValidCoordinate } from "@/lib/coordinates";
import { getCategories, getCities, getHomeData } from "@/lib/data";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";

/** The landing page must render even if the database is briefly unavailable. */
async function homeData() {
  try { return await getHomeData(); } catch (error) { log.error("home.data", { error: String(error) }); return null; }
}

/** Section frame of design 204:912: 1440px frame, 62px side padding on desktop. */
const BAND = "mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-[62px]";

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
  const [data, categories, cities] = await Promise.all([homeData(), safe(getCategories, [], failed), safe(getCities, [], failed)]);
  if (!data) degraded = true;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryName = (c: (typeof categories)[number]) => localize({ ...c, name: c.nameDe }, "name", l);
  const categoryOf = (id: string | null | undefined) => (id ? categoryById.get(id) : undefined);
  const cityName = (c: { nameEn: string } & Record<string, unknown>) => localize({ ...c, name: c.nameEn }, "name", l);
  const rootCategories = categories.filter((c) => !c.parentId);

  // Latest additions (the frame's "latest" row); nearby lists: featured first, then the latest, without repeats.
  const latest = data?.latest ?? [];
  const pool = [...(data?.featured ?? []), ...latest.filter((b) => !data?.featured.some((f) => f.id === b.id))].slice(0, 6);
  const nearbyLists = [pool.slice(0, 3), pool.slice(3, 6)];
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

        {/* ---------- Approved REGA home hero ---------- */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-[1220px] gap-0 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-0 lg:py-10">
            <div className="flex min-h-[300px] flex-col justify-center px-0 py-6 text-start lg:px-8">
              <span className="rega-kicker" aria-hidden="true" />
              <h1 className="rega-display mt-5 max-w-xl text-[clamp(2.4rem,5vw,4.6rem)]">
                {t("ask")}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:text-base">{t("heroLead")}</p>
            </div>
            <div className="rega-red-panel relative hidden min-h-[300px] overflow-hidden rounded-s-[5.5rem] lg:block" aria-hidden="true">
              <div className="absolute -end-20 -top-20 size-72 rounded-full border-[34px] border-white/18" />
              <div className="absolute end-20 top-16 size-44 rounded-full border-[24px] border-white/12" />
              <div className="absolute bottom-8 start-10 max-w-xs text-white">
                <p dir="ltr" className="text-4xl font-black tracking-tight">REGA</p>
                <p className="mt-2 text-sm font-semibold text-white/88">{t("brandTag")}</p>
              </div>
            </div>

            <form action={`/${locale}/businesses`} role="search"
              className="rega-search-shell z-10 col-span-full -mt-1 grid overflow-hidden sm:grid-cols-[minmax(0,1.7fr)_minmax(12rem,.8fr)_auto] lg:mx-8 lg:-mt-8">
              <label className="flex min-h-14 min-w-0 items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)]">
                <FigmaIcon name="search" className="size-5 shrink-0 text-brand" />
                <span className="sr-only">{t("what")}</span>
                <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("searchWhat")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
              </label>
              <label className="flex min-h-14 min-w-0 items-center gap-2 border-t border-line px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--ring)] sm:border-s sm:border-t-0">
                <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand" />
                <span className="sr-only">{t("where")}</span>
                <select name="city" defaultValue="" className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-sm text-muted outline-none">
                  <option value="">{t("anyCity")}</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c).text}</option>)}
                </select>
                <FigmaIcon name="chevron-down" className="pointer-events-none size-4 shrink-0 text-muted" />
              </label>
              <button type="submit" className="min-h-14 bg-brand px-8 text-sm font-bold text-white transition hover:bg-brand-hover">
                {tn("search")}
              </button>
            </form>
          </div>
        </section>

        {/* ---------- Categories (frame 204:966) ---------- */}
        {rootCategories.length > 0 && (
          <section className="border-b border-line bg-surface" aria-labelledby="home-cats">
            <div className={`${BAND} pb-[10px] pt-5`}>
              <div className="flex items-center justify-between gap-4">
                <h2 id="home-cats" className="text-[14px] font-bold leading-[inherit]">{t("browseByCategory")}</h2>
                <Link href="/businesses" className="text-[11px] font-bold text-brand hover:underline">{t("viewAll")}</Link>
              </div>
              <nav aria-label={t("categoriesTitle")} className="mt-[14px]">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  <li className="lg:min-w-0 lg:flex-1">
                    <Link href="/businesses" className="rega-card flex min-h-[92px] flex-col items-center justify-center gap-2 px-2 text-center transition-colors hover:text-brand">
                      <FigmaIcon name="grid-3x3" className="size-6 shrink-0 text-brand" />
                      <span className="line-clamp-2 text-[11px] font-semibold">{t("allSections")}</span>
                    </Link>
                  </li>
                  {rootCategories.slice(0, 6).map((c) => (
                    <li key={c.id} className="lg:min-w-0 lg:flex-1">
                      <Link href={`/businesses/${c.slug}`} className="rega-card flex min-h-[92px] flex-col items-center justify-center gap-2 px-2 text-center transition-colors hover:text-brand">
                        <FigmaIcon name={CATEGORY_ICON[c.slug] ?? "briefcase-business"} className="size-6 shrink-0 text-brand" />
                        <span className="line-clamp-2 text-[11px] font-semibold"><Text value={categoryName(c)} pageLang={pageLang} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </section>
        )}

        {/* ---------- Latest additions (frame 204:998) ---------- */}
        <section className="bg-surface" aria-labelledby="home-latest">
          <div className={`${BAND} py-3`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-px">
                <h2 id="home-latest" className="text-[21px] font-extrabold leading-[inherit]">{t("latestTitle")}</h2>
                <p className="text-[10px] text-muted">{t("latestSub")}</p>
              </div>
              <Link href="/businesses?sort=newest" className="shrink-0 rounded-[4px] border border-brand px-[14px] py-[6px] text-[11px] font-bold text-brand transition-colors hover:bg-brand hover:text-white">{t("seeMore")}</Link>
            </div>
            {latest.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latest.slice(0, 4).map((b) => {
                  const c = categoryOf(b.categoryId);
                  return <LatestCard key={b.id} b={b} locale={l} pageLang={pageLang} category={c ? categoryName(c) : null} newLabel={t("newBadge")} />;
                })}
              </div>
            ) : (
              <div className="mt-2 rounded-[8px] border border-line bg-surface p-6 text-center text-[13px] text-muted">
                <p>{t("emptyListings")}</p>
                <Link href="/for-business" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-brand px-5 text-[13px] font-bold text-brand-ink hover:bg-brand-hover" data-testid="home-be-first">{te("beFirstCta")}</Link>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Nearby (frame 204:1066): list · map · list ---------- */}
        <section className="bg-surface" aria-labelledby="home-nearby">
          <div className={`${BAND} pb-7 pt-5`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-px">
                <h2 id="home-nearby" className="text-[21px] font-extrabold leading-[inherit]">{t("nearTitle")}</h2>
                <p className="text-[10px] text-muted">{t("nearbySub")}</p>
              </div>
              <Link href="/nearby" className="inline-flex shrink-0 items-center gap-[6px] rounded-[4px] border border-brand px-3 py-[6px] text-[10px] font-bold text-brand transition-colors hover:bg-brand hover:text-white">
                <FigmaIcon name="crosshair" className="size-[13px] shrink-0" />{t("locateMe")}
              </Link>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-5 lg:h-[218px] lg:grid-cols-[325fr_626fr_325fr]">
              {[0, null, 1].map((slot) => slot === null ? (
                <div key="map" className="relative min-h-64 overflow-hidden rounded-[8px] border border-line bg-[var(--map)] lg:min-h-0">
                  {mapPoints.length > 0 && <PlacesMap points={mapPoints} className="absolute inset-0" />}
                </div>
              ) : (
                <ul key={slot} className="flex flex-col overflow-hidden rounded-[8px] border border-line">
                  {nearbyLists[slot].length === 0 && slot === 0 && <li className="p-4 text-[13px] text-muted">{t("emptyListings")}</li>}
                  {nearbyLists[slot].map((b) => {
                    const c = categoryOf(b.categoryId);
                    return (
                      <li key={b.id} className="relative flex min-h-[72px] flex-1 items-center justify-between border-b border-line bg-surface px-3 py-[7px]">
                        <div className="flex min-w-0 items-center gap-[9px]">
                          <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-brand-soft">
                            <FigmaIcon name={(c && ROW_ICON[c.slug]) || "building-2"} className="size-[17px] text-brand" />
                          </span>
                          <div className="flex min-w-0 flex-col gap-px">
                            <Link href={`/business/${b.slug}`} className="truncate text-[11px] font-bold after:absolute after:inset-0 after:content-['']">
                              <Text value={localize(b, "name", l)} pageLang={pageLang} />
                            </Link>
                            {c && <span className="truncate text-[9px] text-muted"><Text value={categoryName(c)} pageLang={pageLang} /></span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}
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
