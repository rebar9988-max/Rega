import { PageSchema } from "@/components/ui/PageSchema";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessCard } from "@/components/cards/BusinessCard";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LOCALE_META, isLocale, type Locale } from "@/i18n/locales";
import { HomeIcon } from "@/components/home/icons";
import { SocialSection } from "@/components/home/SocialSection";
import { Stars } from "@/components/ui/Stars";
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

const CATEGORY_ICON: Record<string, string> = { health: "health", food: "food", legal: "legal", admin: "admin" };

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
  const l = locale as Locale;
  const pageLang = LOCALE_META[l].htmlLang;
  let degraded = false;
  const failed = () => { degraded = true; };
  const [data, categories, cities] = await Promise.all([homeData(), safe(getCategories, [], failed), safe(getCities, [], failed)]);
  if (!data) degraded = true;
  const cards = [...(data?.featured ?? []), ...(data?.latest ?? []).filter((b) => !data?.featured.some((f) => f.id === b.id))].slice(0, 4);
  const listed = cards.slice(0, 2);
  const mapPoints: PlacePoint[] = cards.flatMap((b) => {
    const loc = b.locations[0];
    return loc && isValidCoordinate(loc.latitude, loc.longitude) && loc.longitude != null
      ? [{ id: b.id, lat: loc.latitude, lng: loc.longitude, name: localize(b, "name", l).text, sub: loc.city ? localize({ ...loc.city, name: loc.city.nameEn }, "name", l).text : undefined, href: `/businesses/${b.slug}` }]
      : [];
  });
  const topCategories = categories.filter((c) => !c.parentId).slice(0, 7);
  const quick = [
    { href: "/nearby", label: tn("nearby"), icon: "near" },
    { href: "/nearby?open=1", label: t("openNow"), icon: "clock" },
    { href: "/services", label: tn("services"), icon: "grid" },
    { href: "/businesses", label: tn("businesses"), icon: "store" },
    { href: "/locations", label: tn("locations"), icon: "pin" },
  ];
  const cityName = (c: { nameEn: string } & Record<string, unknown>) => localize({ ...c, name: c.nameEn }, "name", l);

  return (
    <>
      <PageSchema name={t("ask")} description={t("lead")} />
      {degraded && <NoEdgeCache />}

      {/* ---------- Hero ---------- */}
      <section className="hero-dusk relative isolate overflow-hidden text-white">
        <svg aria-hidden="true" viewBox="0 0 1200 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-20 w-full fill-[oklch(0.13_0.03_268/0.85)] sm:h-28">
          <path d="M0 120V84h40V70h24V90h30V58h18V40l8-14 8 14v18h20V76h36V52h22V92h30V64h26V30l10-24 10 24v34h24V80h40V96h34V60h20V44h28V88h32V68h24V92h38V56h20V36l9-20 9 20v20h24V78h40V94h36V70h24V50h26V86h34V62h20V90h40V72h28V44l10-22 10 22v28h24V88h38V66h22V96h32V74h26V58h30V92h36V78h40V98h40V70h26V84h44v36Z" />
        </svg>
        <div className="container-page grid gap-6 py-7 sm:py-8 lg:grid-cols-[1fr_2.3fr] lg:items-start lg:py-10" style={{ maxWidth: "80rem" }}>
          {/* Brand block: reading-start column (right in RTL, left in LTR), as in the reference. */}
          <div className="hidden pt-6 text-start lg:block">
            <p className="text-4xl font-extrabold tracking-wide"><span dir="ltr">REGA</span></p>
            <p className="mt-2 text-2xl font-bold">{t("brandTag")}</p>
            <p className="mt-1 text-base text-white/85">{t("brandSub")}</p>
            <span aria-hidden="true" className="mt-3 inline-block h-1 w-14 rounded-full bg-brand" />
          </div>
          <div className="lg:text-end">
            <h1 className="text-4xl font-extrabold sm:text-5xl lg:text-6xl">
              <span className="relative inline-block">{t("ask")}<span aria-hidden="true" className="absolute inset-x-0 -bottom-1 h-1 rounded-full bg-brand sm:w-2/5" /></span>
            </h1>
            <p className="mt-4 text-base text-white/90 sm:text-lg">{t("lead")}</p>

            <form action={`/${locale}/businesses`} role="search" className="mt-6 flex text-start flex-col gap-2 rounded-2xl bg-surface p-2 text-ink shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)] sm:flex-row sm:items-center sm:gap-0">
              <label className="flex min-w-0 flex-[1.4] items-center gap-2 px-3">
                <HomeIcon name="search" className="size-5 shrink-0 text-brand" />
                <span className="sr-only">{t("what")}</span>
                <input name="q" type="search" autoComplete="off" maxLength={120} placeholder={t("what")} className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted sm:text-base" />
              </label>
              <span aria-hidden="true" className="hidden h-8 w-px bg-line sm:block" />
              <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
                <HomeIcon name="pin" className="size-5 shrink-0 text-brand" />
                <span className="sr-only">{t("where")}</span>
                <select name="city" defaultValue="" className="min-h-12 min-w-0 flex-1 bg-transparent text-sm text-muted outline-none sm:text-base">
                  <option value="">{t("where")}</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c).text}</option>)}
                </select>
              </label>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold text-brand-ink transition-colors hover:bg-brand-hover">
                <HomeIcon name="search" className="size-5" />{tn("search")}
              </button>
            </form>

            <ul className="mt-4 flex flex-wrap gap-2.5 lg:justify-end">
              {quick.map((q) => (
                <li key={q.label}>
                  <Link href={q.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-bold text-ink shadow-card transition-colors hover:text-brand">
                    <HomeIcon name={q.icon} className="size-5 text-brand" />{q.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="container-page" style={{ maxWidth: "80rem" }}>
        {/* ---------- Categories ---------- */}
        {topCategories.length > 0 && (
          <nav aria-label={t("categoriesTitle")} className="mt-5">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:[&>li]:flex-1">
              {topCategories.map((c) => (
                <li key={c.id}>
                  <Link href={`/businesses?category=${c.id}`} className="flex h-full flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-4 text-center shadow-card card-lift hover:border-brand/40">
                    <HomeIcon name={CATEGORY_ICON[c.slug] ?? "grid"} className="size-8 text-brand" filled={c.slug === "health"} />
                    <span className="text-sm font-bold"><Text value={localize({ ...c, name: c.nameDe }, "name", l)} pageLang={pageLang} /></span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/businesses" className="flex h-full flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-4 text-center shadow-card card-lift hover:border-brand/40">
                  <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-ink"><HomeIcon name="all" className="size-5" /></span>
                  <span className="text-sm font-bold">{t("allCategories")}</span>
                  <span className="text-xs text-muted">{t("allCategoriesSub")}</span>
                </Link>
              </li>
            </ul>
          </nav>
        )}

        {/* ---------- Businesses nearby ---------- */}
        <section className="mt-10" aria-labelledby="home-near">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="flex items-start gap-2">
              <HomeIcon name="flame" className="mt-1 size-7 text-brand" filled />
              <div>
                <h2 id="home-near" className="text-xl font-extrabold sm:text-2xl">{t("nearTitle")}</h2>
                <p className="text-sm text-muted">{t("nearSub")}</p>
              </div>
            </div>
            <Link href="/businesses" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink">
              {t("viewAll")}<HomeIcon name="arrow" className="size-4 rtl-flip" />
            </Link>
          </div>
          {cards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map((b) => <BusinessCard key={b.id} b={b} />)}</div>
          ) : (
            <p className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center text-muted">{t("emptyListings")}</p>
          )}
        </section>

        {/* ---------- Near you · map · new services ---------- */}
        <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.25fr_1fr]">
          <div className="flex flex-col">
            <div className="mb-3 flex items-start gap-2">
              <HomeIcon name="pin" className="mt-1 size-6 text-brand" />
              <div><h2 className="text-lg font-extrabold">{t("nearMe")}</h2><p className="text-sm text-muted">{t("nearMeSub")}</p></div>
            </div>
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
              {listed.length === 0 && <li className="p-4 text-sm text-muted">{t("emptyListings")}</li>}
              {listed.map((b) => {
                const city = b.locations[0]?.city;
                return (
                  <li key={b.id} className="relative flex items-center gap-3 p-3">
                    <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-brand-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {b.coverUrl || b.logoUrl ? <img src={(b.coverUrl || b.logoUrl)!} alt="" width={64} height={64} loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xl font-bold text-brand">{Array.from(localize(b, "name", l).text)[0]}</span>}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/businesses/${b.slug}`} className="block truncate text-sm font-bold after:absolute after:inset-0 after:content-['']"><Text value={localize(b, "name", l)} pageLang={pageLang} /></Link>
                      <Stars value={b.ratingAvg} count={b.ratingCount} />
                      {city && <p className="flex items-center gap-1 text-xs text-muted"><HomeIcon name="pin" className="size-3.5 text-brand" /><Text value={cityName(city)} pageLang={pageLang} /></p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href="/nearby" className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 self-end rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink">
              {t("viewAll")}<HomeIcon name="arrow" className="size-4 rtl-flip" />
            </Link>
          </div>

          <div className="relative min-h-72 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-2 shadow-card">
            {mapPoints.length > 0 ? (
              <PlacesMap points={mapPoints} className="absolute inset-0" />
            ) : (
              <div className="grid size-full min-h-72 place-items-center bg-[radial-gradient(circle_at_50%_40%,var(--surface),var(--surface-2))]">
                <HomeIcon name="pin" className="size-14 text-brand" />
              </div>
            )}
            <Link href="/nearby" className={`absolute ${mapPoints.length > 0 ? "top-3" : "bottom-3"} start-3 z-10 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink shadow-card hover:bg-brand-hover`}>
              <HomeIcon name="near" className="size-4" />{t("openMap")}
            </Link>
          </div>

          <div className="flex flex-col">
            <div className="mb-3 flex items-start gap-2">
              <HomeIcon name="briefcase" className="mt-1 size-6 text-brand" />
              <div><h2 className="text-lg font-extrabold">{t("newServices")}</h2><p className="text-sm text-muted">{t("newServicesSub")}</p></div>
            </div>
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
              {(data?.newServices ?? []).length === 0 && <li className="p-4 text-sm text-muted">{t("emptyListings")}</li>}
              {(data?.newServices ?? []).map((s) => {
                const city = s.business.locations[0]?.city;
                return (
                  <li key={s.id} className="relative flex items-center gap-3 p-3">
                    <HomeIcon name="grid" className="size-5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/services/${s.business.slug}/${s.slug}`} className="block truncate text-sm font-bold after:absolute after:inset-0 after:content-['']"><Text value={localize(s, "name", l)} pageLang={pageLang} /></Link>
                      <p className="flex items-center gap-1 truncate text-xs text-muted"><HomeIcon name="pin" className="size-3.5 text-brand" /><Text value={localize(s.business, "name", l)} pageLang={pageLang} />{city && <> · <Text value={cityName(city)} pageLang={pageLang} /></>}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{t("isNew")}</span>
                  </li>
                );
              })}
            </ul>
            <Link href="/services" className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 self-end rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink">
              {t("allServices")}<HomeIcon name="arrow" className="size-4 rtl-flip" />
            </Link>
          </div>
        </section>

        <SocialSection />
      </div>
    </>
  );
}
