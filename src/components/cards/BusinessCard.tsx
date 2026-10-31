import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { getCategories, type BusinessCardData } from "@/lib/data";
import { languageNames } from "./BusinessRow";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Text } from "@/components/ui/Bidi";
import { VerifiedBadge } from "@/components/ui/Badge";
import { responsiveImage } from "@/features/business-images/variants";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { OpenBadge } from "@/components/home/OpenBadge";

const PIN = "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z";
const STAR = "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3Z";

/**
 * Shared business card. "directory" is the reference grid card (two columns on phones): cover photo (else the
 * business's own logo / initial, never a stock photo) with the verified pill and the "open" pill computed in the
 * browser from the stored hours, then name, category, city and the real rating. "search" keeps its row layout.
 */
export async function BusinessCard({ b, variant = "search" }: { b: BusinessCardData; variant?: "search" | "directory" }) {
  const directory = variant === "directory";
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("businesses");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nearby");
  const pageLang = LOCALE_META[locale].htmlLang;
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;

  const category = b.categoryId ? (await getCategories()).find((c) => c.id === b.categoryId) : undefined;
  const categoryName = category ? localize({ ...category, name: category.nameDe }, "name", locale) : null;
  const langs = languageNames(b.languages);
  const loc = b.locations[0];

  if (directory) return (
    <article className="rega-directory-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl! border border-line bg-surface shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]!">
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-soft">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...responsiveImage(b.coverUrl)} sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, 50vw" alt="" width={480} height={360} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...responsiveImage(b.logoUrl)} sizes="(min-width: 640px) 160px, 30vw" alt="" width={160} height={160} loading="lazy" decoding="async" className="absolute inset-0 m-auto aspect-square w-1/2 rounded-xl bg-surface object-contain" />
        ) : (
          <div className="absolute inset-0 grid place-items-center"><Avatar name={name.text} size="size-14" /></div>
        )}
        {b.verified && (
          <span className="absolute end-2.5 top-2.5 inline-flex min-h-7 max-w-[calc(100%-1.25rem)] items-center gap-1 rounded-full bg-white px-2.5 text-xs font-bold text-[#15803d] shadow-sm">
            <FigmaIcon name="badge-check" className="size-4 shrink-0" /><span className="truncate">{t("verified")}</span>
          </span>
        )}
        {loc && <OpenBadge hours={loc.openingHours} countryCode={loc.countryCode} regionSlug={loc.city?.region?.slug} label={tn("open")}
          className="absolute bottom-2.5 start-2.5 inline-flex min-h-7 items-center rounded-full bg-[#15803d] px-3 text-xs font-bold text-white shadow-sm" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug [overflow-wrap:anywhere]">
          <Link href={`/business/${b.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <Text value={name} pageLang={pageLang} />
          </Link>
        </h3>
        {categoryName && <p className="mt-0.5 truncate text-sm text-muted"><Text value={categoryName} pageLang={pageLang} /></p>}
        {(cityName || b.ratingCount > 0) && (
          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
            {cityName ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-muted">
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-brand-text" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={PIN} /><circle cx="12" cy="10" r="2.5" /></svg>
                <span className="truncate"><Text value={cityName} pageLang={pageLang} /></span>
              </span>
            ) : <span />}
            {b.ratingCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 font-bold" title={t("reviewsCount", { count: formatNumber(b.ratingCount, locale) })}>
                <bdi>{formatNumber(b.ratingAvg, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</bdi>
                <svg viewBox="0 0 24 24" className="size-4 text-sun" fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>
                <span className="sr-only">{t("reviewsCount", { count: formatNumber(b.ratingCount, locale) })}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );

  return (
    <article className="rega-card group relative grid grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
      <div className="relative min-h-[8.5rem] overflow-hidden rounded-xl bg-surface-2 sm:m-3 sm:min-h-[7.5rem]">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...responsiveImage(b.coverUrl)} sizes="(min-width: 640px) 176px, 104px" alt="" width={480} height={320} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--surface),var(--brand-soft))]">
            <Avatar name={name.text} src={b.logoUrl} size="size-14" />
          </div>
        )}
      </div>

      <div className="min-w-0 p-3.5 sm:px-2 sm:py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate text-base font-bold sm:text-lg">
            <Link href={`/business/${b.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              <Text value={name} pageLang={pageLang} />
            </Link>
          </h3>
          {b.verified && <VerifiedBadge />}
        </div>
        {categoryName && <p className="mt-0.5 truncate text-sm text-muted"><Text value={categoryName} pageLang={pageLang} /></p>}
        <div className="mt-2"><Stars value={b.ratingAvg} count={b.ratingCount} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {cityName && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-brand-text" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={PIN} /><circle cx="12" cy="10" r="2.5" /></svg>
              <span className="truncate"><Text value={cityName} pageLang={pageLang} /></span>
            </span>
          )}
          {langs.length > 0 && <span className="truncate">{langs.join(" · ")}</span>}
          <span>{t("servicesN", { count: formatNumber(b._count.services, locale) })}</span>
        </div>
      </div>

      <div className="hidden items-center p-5 sm:flex">
        <span className="inline-flex min-h-10 items-center rounded-lg border border-brand px-4 text-sm font-bold text-brand-text transition group-hover:bg-brand group-hover:text-brand-ink">
          {tc("viewDetails")}
        </span>
      </div>
    </article>
  );
}
