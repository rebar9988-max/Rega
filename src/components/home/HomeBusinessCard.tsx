import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/locales";
import { localize, type Localized } from "@/lib/content";
import type { BusinessCardData } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Text } from "@/components/ui/Bidi";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { responsiveImage } from "@/features/business-images/variants";

/**
 * Home business card of the approved REGA24 reference: cover photo (or the business's own logo / initial, never a
 * stock photo), verified mark only when the business is verified, name, rating only when real reviews exist, category
 * and city, and the red "view profile" bar. The whole card is one link (stretched name link): one focus stop, one name.
 */
export function HomeBusinessCard({ b, locale, pageLang, category, viewLabel }: { b: BusinessCardData; locale: Locale; pageLang: string; category: Localized | null; viewLabel: string }) {
  const t = useTranslations("businesses");
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;
  return (
    <article className="rega-home-business rh-biz group">
      <div className="rh-biz-media">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...responsiveImage(b.coverUrl)} sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 80vw" alt="" width={480} height={300} loading="lazy" decoding="async" className="rh-biz-img" />
        ) : (
          <div className="rh-biz-fallback"><Avatar name={name.text} src={b.logoUrl} size="size-16" /></div>
        )}
        {b.verified && (
          <span className="rh-verified">
            <FigmaIcon name="badge-check" className="size-4 shrink-0" />
            {t("verified")}
          </span>
        )}
      </div>
      <div className="rh-biz-body">
        <h3 className="rh-biz-name">
          <Link href={`/business/${b.slug}`} className="rh-stretch">
            <Text value={name} pageLang={pageLang} />
          </Link>
        </h3>
        {b.ratingCount > 0 && <Stars value={b.ratingAvg} count={b.ratingCount} />}
        {category && (
          <p className="rh-biz-meta">
            <FigmaIcon name="layout-grid" className="size-4 shrink-0 text-brand-text" />
            <span className="truncate"><Text value={category} pageLang={pageLang} /></span>
          </p>
        )}
        {cityName && (
          <p className="rh-biz-meta">
            <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand-text" />
            <span className="truncate"><Text value={cityName} pageLang={pageLang} /></span>
          </p>
        )}
        <span aria-hidden="true" className="rh-biz-cta">
          {viewLabel}
          <FigmaIcon name="arrow-right" className="rtl-flip size-4 shrink-0" />
        </span>
      </div>
    </article>
  );
}
