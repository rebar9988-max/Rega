import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import type { BusinessCardData } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Text } from "@/components/ui/Bidi";

const PIN = "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z";

/**
 * Provider card (REGA design reference): cover image on top with a badge, then name, star rating,
 * city and service count. Without a cover photo, a branded panel with the business logo/initial is shown
 * (never a stock photo that would misrepresent the business).
 */
export async function BusinessCard({ b }: { b: BusinessCardData }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("businesses");
  const pageLang = LOCALE_META[locale].htmlLang;
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card card-lift hover:border-brand/40">
      <div className="relative h-32 overflow-hidden bg-brand-soft sm:h-36">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverUrl} alt="" width={640} height={288} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--surface),var(--brand-soft))]">
            <Avatar name={name.text} src={b.logoUrl} size="size-16" />
          </div>
        )}
        {b.verified && (
          <span className="absolute start-3 top-3 rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink shadow">{t("verified")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="truncate text-base font-bold">
          {/* Stretched link: whole card is clickable, one focus stop, one accessible name. */}
          <Link href={`/business/${b.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            <Text value={name} pageLang={pageLang} />
          </Link>
        </h3>
        <Stars value={b.ratingAvg} count={b.ratingCount} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted">
          <span className="inline-flex min-w-0 items-center gap-1">
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={PIN} /><circle cx="12" cy="10" r="2.5" /></svg>
            <span className="truncate">{cityName ? <Text value={cityName} pageLang={pageLang} /> : ""}</span>
          </span>
          <span className="shrink-0">{t("servicesN", { count: formatNumber(b._count.services, locale) })}</span>
        </div>
      </div>
    </article>
  );
}
