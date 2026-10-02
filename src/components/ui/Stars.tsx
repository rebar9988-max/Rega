import { useLocale, useTranslations } from "next-intl";
import { formatNumber, type Locale } from "@/i18n/locales";

const STAR = "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3Z";

/** Five-star row + value + (count), as in the REGA design reference. Renders "no reviews" when count is 0. */
export function Stars({ value, count }: { value: number; count: number }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("businesses");
  if (!count) return <span className="text-xs text-muted">{t("noRating")}</span>;
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1 text-sm" dir="ltr" title={t("reviewsCount", { count: formatNumber(count, locale) })}>
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <svg key={i} viewBox="0 0 24 24" className={`size-3.5 ${i < full ? "text-sun" : "text-line"}`} fill="currentColor"><path d={STAR} /></svg>
        ))}
      </span>
      <span className="font-bold">{formatNumber(value, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      <span className="text-muted">({formatNumber(count, locale)})</span>
    </span>
  );
}
