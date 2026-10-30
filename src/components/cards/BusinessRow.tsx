import { Link } from "@/i18n/routing";
import { LOCALE_META, isLocale, type Locale } from "@/i18n/locales";
import { localize, type Localized } from "@/lib/content";
import type { BusinessCardData } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Text } from "@/components/ui/Bidi";
import { FigmaIcon } from "@/components/home/FigmaIcon";

/** Native names of the languages a business lists (only real locale codes; unknown values are skipped). */
export function languageNames(codes: readonly string[] | undefined): string[] {
  return (codes ?? []).filter(isLocale).map((c) => LOCALE_META[c].nativeName);
}

/**
 * Compact horizontal business card of the approved red/white concept (home "popular" row, nearby lists): square
 * image (cover, logo or initial; never a stock photo), name, rating when real reviews exist, languages, category and
 * city, and a red arrow. The whole card is one link (stretched), so it is one focus stop with one accessible name.
 */
export function BusinessRow({ b, locale, pageLang, category, layout, viewLabel }: { layout?: "home"; viewLabel?: string; b: BusinessCardData; locale: Locale; pageLang: string; category: Localized | null }) {
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;
  const langs = languageNames(b.languages);
  return (
    <article className={`rega-card group relative flex min-h-[112px] items-center gap-3 p-3 ${layout === "home" ? "rega-home-business lg:min-h-[310px] lg:flex-col lg:items-stretch" : ""}`}>
      <div className={`size-[88px] shrink-0 overflow-hidden rounded-xl bg-surface-2 ${layout === "home" ? "lg:h-[148px] lg:w-full" : ""}`}>
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverUrl} alt="" width={176} height={176} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid size-full place-items-center bg-surface-2">
            <Avatar name={name.text} src={b.logoUrl} size="size-12" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="truncate text-[15px] font-bold leading-snug text-ink">
          <Link href={`/business/${b.slug}`} className="after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none">
            <Text value={name} pageLang={pageLang} />
          </Link>
        </h3>
        {b.ratingCount > 0 && <Stars value={b.ratingAvg} count={b.ratingCount} />}
        {langs.length > 0 && <p className="truncate text-xs text-muted">{langs.join(" · ")}</p>}
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted">
          {category && <span className="truncate"><Text value={category} pageLang={pageLang} /></span>}
          {category && cityName && <span aria-hidden="true">·</span>}
          {cityName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <FigmaIcon name="map-pin" className="size-3 shrink-0 text-brand-text" />
              <span className="truncate"><Text value={cityName} pageLang={pageLang} /></span>
            </span>
          )}
        </p>
      </div>
      {layout === "home" && viewLabel
        ? <span aria-hidden="true" className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-brand-text lg:w-full lg:rounded-[13px] lg:bg-brand lg:px-4 lg:text-brand-ink">{viewLabel}<FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0" /></span>
        : <FigmaIcon name="arrow-right" className="rtl-flip size-5 shrink-0 text-brand-text transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />}

    </article>
  );
}
