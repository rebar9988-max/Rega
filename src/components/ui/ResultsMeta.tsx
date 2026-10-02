import { useLocale, useTranslations } from "next-intl";
import { formatNumber, type Locale } from "@/i18n/locales";

export function ResultsMeta({ total }: { total: number }) {
  const t = useTranslations("search");
  const locale = useLocale() as Locale;
  return <p aria-live="polite" className="container-page mb-4 text-sm text-muted">{t("resultCount", { count: formatNumber(total, locale) })}</p>;
}
