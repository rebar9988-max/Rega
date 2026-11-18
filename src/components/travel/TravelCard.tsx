import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { getCategories, type BusinessCardData } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Bidi";
import { VerifiedBadge } from "@/components/ui/Badge";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { SaveButton } from "@/components/business/SaveButton";
import { responsiveImage } from "@/features/business-images/variants";

/**
 * Rega24Travel result row (owner mockup 2026-11-18): favourite, name, category, real rating, city, photo. Same data
 * as the shared BusinessCard; opens the normal business profile. Rating appears only when real reviews exist.
 */
export async function TravelCard({ b }: { b: BusinessCardData }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("saved");
  const pageLang = LOCALE_META[locale].htmlLang;
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;
  const category = b.categoryId ? (await getCategories()).find((c) => c.id === b.categoryId) : undefined;
  const categoryName = category ? localize({ ...category, name: category.nameDe }, "name", locale) : null;
  const image = b.coverUrl ?? b.logoUrl;

  return (
    <article className="rt-card group" data-testid="travel-card">
      <SaveButton slug={b.slug} label={t("save")} savedLabel={t("saved")} addedText={t("added")} removedText={t("removed")}
        icon="heart" iconOnly className="rt-card-save" />
      <div className="rt-card-body">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="rt-card-title">
            <Link href={`/business/${b.slug}`} className="rt-card-link"><Text value={name} pageLang={pageLang} /></Link>
          </h3>
          {b.verified && <VerifiedBadge />}
        </div>
        {categoryName && <p className="rt-card-cat"><Text value={categoryName} pageLang={pageLang} /></p>}
        <div className="rt-card-meta">
          {b.ratingCount > 0 && (
            <span className="inline-flex items-center gap-1" dir="ltr">
              <FigmaIcon name="star" className="size-3.5 shrink-0 fill-current text-[#e19a12]" />
              <span className="font-bold text-ink">{formatNumber(Math.round(b.ratingAvg * 10) / 10, locale)}</span>
              <span>({formatNumber(b.ratingCount, locale)})</span>
            </span>
          )}
          {cityName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <FigmaIcon name="map-pin" className="size-3.5 shrink-0 text-ink" />
              <span className="truncate"><Text value={cityName} pageLang={pageLang} /></span>
            </span>
          )}
        </div>
      </div>
      <div className="rt-card-media">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...responsiveImage(image)} sizes="112px" alt="" width={224} height={160} loading="lazy" decoding="async"
            className={b.coverUrl ? "size-full object-cover" : "size-full bg-surface object-contain p-2"} />
        ) : <span className="grid size-full place-items-center bg-brand-soft"><Avatar name={name.text} size="size-12" /></span>}
      </div>
    </article>
  );
}
