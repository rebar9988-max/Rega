import { useLocale, useTranslations } from "next-intl";
import { formatNumber, type Locale } from "@/i18n/locales";

export function Rating({ value, count }: { value: number; count: number }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("businesses");
  if (!count) return <span className="text-xs text-muted">{t("noRating")}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" title={t("reviewsCount", { count: formatNumber(count, locale) })}>
      <svg viewBox="0 0 24 24" className="size-4 text-sun" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3Z" /></svg>
      <span className="font-semibold">{formatNumber(value, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      <span className="text-muted">({formatNumber(count, locale)})</span>
    </span>
  );
}
