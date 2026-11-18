import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { TRAVEL_SHORTCUTS } from "@/config/travel";
import { PlaneSwoosh, TravelSceneArt, TravelServiceIcon } from "./TravelArt";

type CategoryRow = { id: string; slug: string };

/**
 * Rega24Travel home banner (owner reference 2026-11-18 21:32): brand title with airplane swoosh, subtitle pill,
 * travel scene, six service shortcuts (real travel categories, each opening /travel filtered to it) and the CTA.
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
          <TravelSceneArt className="rtb-art" />
          <div className="rtb-copy">
            <div className="rtb-brand" dir="ltr">
              <h2 id="home-travel" className="rtb-title">Rega24<span>Travel</span></h2>
              <PlaneSwoosh className="rtb-swoosh" />
            </div>
            <p className="rtb-pill">
              {tn("travel")}
              <svg viewBox="0 0 24 24" className="rtb-pill-icon" aria-hidden="true" focusable="false">
                <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <rect x="4" y="6" width="16" height="15" rx="3" fill="currentColor" />
                <path d="M9 6v15M15 6v15" stroke="#fff" strokeOpacity=".45" strokeWidth="1.4" />
              </svg>
            </p>
            <span className="rtb-rule" aria-hidden="true" />
            <p className="rtb-body">{t("bannerBody")}</p>
          </div>
        </div>
        {shortcuts.length > 0 && (
          <ul className="rtb-services" aria-label={t("categoriesLabel")}>
            {shortcuts.map((s) => (
              <li key={s.slug}>
                <Link href={`/travel?category=${s.id}`} className="rtb-service" data-testid={`travel-shortcut-${s.slug}`}>
                  <TravelServiceIcon slug={s.slug} className="rtb-service-icon" />
                  <span className="rtb-service-label">{t(`shortcut.${s.slug}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/travel" className="rtb-cta" data-testid="home-travel-cta">
          <span className="rtb-cta-text">
            <span className="rtb-cta-top">{t("bannerVisit")}</span>
            <strong className="rtb-cta-brand" dir="ltr">Rega24Travel</strong>
          </span>
          <span className="rtb-cta-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="rtl-flip size-6"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </Link>
      </div>
    </section>
  );
}
