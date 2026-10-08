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

const PIN = "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z";

/** Directory row of the approved concept (page 3): image, name and verification, category, rating, place and languages, one clear profile action. */
export async function BusinessCard({ b }: { b: BusinessCardData }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("businesses");
  const tc = await getTranslations("common");
  const pageLang = LOCALE_META[locale].htmlLang;
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;

  const category = b.categoryId ? (await getCategories()).find((c) => c.id === b.categoryId) : undefined;
  const categoryName = category ? localize({ ...category, name: category.nameDe }, "name", locale) : null;
  const langs = languageNames(b.languages);

  return (
    <article className="rega-card group relative grid grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
      <div className="relative min-h-[8.5rem] overflow-hidden bg-brand-soft sm:m-3 sm:min-h-[7.5rem] sm:rounded-lg">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverUrl} alt="" width={480} height={320} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
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
              <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={PIN} /><circle cx="12" cy="10" r="2.5" /></svg>
              <span className="truncate"><Text value={cityName} pageLang={pageLang} /></span>
            </span>
          )}
          {langs.length > 0 && <span className="truncate">{langs.join(" · ")}</span>}
          <span>{t("servicesN", { count: formatNumber(b._count.services, locale) })}</span>
        </div>
      </div>

      <div className="hidden items-center p-5 sm:flex">
        <span className="inline-flex min-h-10 items-center rounded-lg border border-brand px-4 text-sm font-bold text-brand transition group-hover:bg-brand group-hover:text-white">
          {tc("viewDetails")}
        </span>
      </div>
    </article>
  );
}
