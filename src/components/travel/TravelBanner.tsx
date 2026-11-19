import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { TRAVEL_SHORTCUTS } from "@/config/travel";
import { TravelRouteArt, TravelServiceIcon } from "./TravelArt";

type CategoryRow = { id: string; slug: string };

/**
 * Rega24Travel home banner (owner 2026-11-19 12:31): compact, calm card on the brand red — title, subtitle, short
 * description and route illustration, six service tiles (real travel categories, each opening /travel filtered to it)
 * and one white CTA. No decorative borders or heavy shadows.
 */
export async function TravelBanner({ categories, className = "" }: { categories: readonly CategoryRow[]; className?: string }) {
  const t = await getTranslations("travel");
  const tn = await getTranslations("nav");
  const shortcuts = TRAVEL_SHORTCUTS.flatMap((slug) => {
    const c = categories.find((x) => x.slug === slug);
    return c ? [{ slug, id: c.id }] : [];
  });
  return (
    <section className={className} aria-labelledby="home-travel">
      <div className="rtb" data-testid="home-travel-banner">
        <div className="rtb-top">
          <div className="rtb-copy">
            <h2 id="home-travel" className="rtb-title"><bdi>Rega24<span>Travel</span></bdi></h2>
            <p className="rtb-sub">{tn("travel")}</p>
            <p className="rtb-body">{t("bannerBody")}</p>
          </div>
          <TravelRouteArt className="rtb-art" />
        </div>
        {shortcuts.length > 0 && (
          <ul className="rtb-services" aria-label={t("categoriesLabel")}>
            {shortcuts.map((s) => (
              <li key={s.slug}>
                <Link href={`/travel?category=${s.id}`} className="rtb-service" data-testid={`travel-shortcut-${s.slug}`}>
                  <span className="rtb-service-icon"><TravelServiceIcon slug={s.slug} className="size-5" /></span>
                  <span className="rtb-service-label">{t(`shortcut.${s.slug}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/travel" className="rtb-cta" data-testid="home-travel-cta">
          <span>{t("bannerVisit")} <bdi className="rtb-cta-brand">Rega24Travel</bdi></span>
          <svg viewBox="0 0 24 24" className="rtl-flip size-5 shrink-0" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </div>
    </section>
  );
}
