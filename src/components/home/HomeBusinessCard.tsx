import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/locales";
import { formatNumber } from "@/i18n/locales";
import { countryName, localize, type Localized } from "@/lib/content";
import type { HomeBusinessData } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Bidi";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { OpenBadge } from "@/components/home/OpenBadge";
import { responsiveImage } from "@/features/business-images/variants";
import { directionsUrl, safeTel } from "@/lib/urls";
import { whatsappLink } from "@/lib/whatsapp";

/**
 * Home business card of the approved REGA24 reference: cover photo (or the business's own logo / initial, never a
 * stock photo), real rating and review count only when reviews exist, "open now" computed in the visitor's browser
 * from the stored hours, name with its category icon, category · city · country, and Call / WhatsApp / Directions,
 * each only when the business has that data. The name is a stretched link (one focus stop for the profile); the
 * actions sit above it. No favourites heart: that feature does not exist on REGA24.
 */
export function HomeBusinessCard({ b, locale, pageLang, category, icon }: { b: HomeBusinessData; locale: Locale; pageLang: string; category: Localized | null; icon: string }) {
  const t = useTranslations("businesses");
  const th = useTranslations("home");
  const tn = useTranslations("nearby");
  const name = localize(b, "name", locale);
  const loc = b.locations[0];
  const city = loc?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;
  const country = loc?.countryCode ? countryName({ code: loc.countryCode }, locale) : null;
  const tel = safeTel(b.phone ?? loc?.phone);
  const whatsapp = whatsappLink(b.whatsapp);
  const directions = loc ? directionsUrl(loc.latitude, loc.longitude) : null;
  return (
    <article className="rega-home-business rh-biz">
      <div className="rh-biz-media">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...responsiveImage(b.coverUrl)} sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 72vw" alt="" width={480} height={300} loading="lazy" decoding="async" className="rh-biz-img" />
        ) : (
          <div className="rh-biz-fallback"><Avatar name={name.text} src={b.logoUrl} size="size-16" /></div>
        )}
        <div className="rh-biz-shade" aria-hidden="true" />
        {b.verified && (
          <span className="rh-verified">
            <FigmaIcon name="badge-check" className="size-4 shrink-0" />
            {t("verified")}
          </span>
        )}
        {b.ratingCount > 0 && (
          <span className="rh-rating" role="img" aria-label={th("ratingLabel", { rating: formatNumber(b.ratingAvg, locale, { maximumFractionDigits: 1 }), count: b.ratingCount })}>
            <FigmaIcon name="star" className="rh-rating-star" />
            <span aria-hidden="true">{formatNumber(b.ratingAvg, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ({formatNumber(b.ratingCount, locale)})</span>
          </span>
        )}
        {loc && <OpenBadge hours={loc.openingHours} countryCode={loc.countryCode} regionSlug={city?.region?.slug} label={th("openNow")} />}
      </div>
      <div className="rh-biz-body">
        <h3 className="rh-biz-name">
          <FigmaIcon name={icon} className="rh-biz-icon" />
          <Link href={`/business/${b.slug}`} className="rh-stretch">
            <Text value={name} pageLang={pageLang} />
          </Link>
        </h3>
        {(category || cityName || country) && (
          <p className="rh-biz-meta">
            {category && <span className="rh-biz-meta-item"><Text value={category} pageLang={pageLang} /></span>}
            {cityName && <span className="rh-biz-meta-item"><Text value={cityName} pageLang={pageLang} /></span>}
            {country && <span className="rh-biz-meta-item">{country}</span>}
          </p>
        )}
        {(tel || whatsapp || directions) && (
          <div className="rh-biz-actions">
            {tel && (
              <a href={`tel:${tel}`} className="rh-act" aria-label={`${t("call")} – ${name.text}`}>
                <FigmaIcon name="phone" className="size-4 shrink-0" />{t("call")}
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rh-act" aria-label={`${t("whatsapp")} – ${name.text}`}>
                <FigmaIcon name="message-circle" className="rh-act-wa size-4 shrink-0" />{t("whatsapp")}
              </a>
            )}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="rh-act rh-act-dir" aria-label={`${tn("directions")} – ${name.text}`}>
                <FigmaIcon name="navigation" className="size-4 shrink-0" />{tn("directions")}
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
