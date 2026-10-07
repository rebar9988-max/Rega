import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import type { BusinessCardData } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Text } from "@/components/ui/Bidi";
import { VerifiedBadge } from "@/components/ui/Badge";

const PIN = "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z";

/** Directory row matching the approved REGA concept: image, readable trust details and one clear profile action. */
export async function BusinessCard({ b }: { b: BusinessCardData }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("businesses");
  const tc = await getTranslations("common");
  const pageLang = LOCALE_META[locale].htmlLang;
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;

  return (
    <article className="rega-card group relative grid min-h-[132px] overflow-hidden sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <div className="relative min-h-36 overflow-hidden bg-brand-soft sm:min-h-full">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverUrl} alt="" width={480} height={320} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
        ) : (
          <div className="grid size-full min-h-36 place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--surface),var(--brand-soft))]">
            <Avatar name={name.text} src={b.logoUrl} size="size-16" />
          </div>
        )}
      </div>

      <div className="min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-base font-bold sm:text-lg">
            <Link href={`/business/${b.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              <Text value={name} pageLang={pageLang} />
            </Link>
          </h3>
          {b.verified && <VerifiedBadge />}
        </div>
        <div className="mt-1"><Stars value={b.ratingAvg} count={b.ratingCount} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={PIN} /><circle cx="12" cy="10" r="2.5" /></svg>
            <span className="truncate">{cityName ? <Text value={cityName} pageLang={pageLang} /> : ""}</span>
          </span>
          <span>{t("servicesN", { count: formatNumber(b._count.services, locale) })}</span>
        </div>
      </div>

      <div className="hidden items-center p-5 sm:flex">
        <span className="inline-flex min-h-10 items-center rounded-lg border border-brand px-4 text-xs font-bold text-brand transition group-hover:bg-brand group-hover:text-white">
          {tc("viewDetails")}
        </span>
      </div>
    </article>
  );
}
