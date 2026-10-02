import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatCurrency, formatNumber, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import type { ServiceCardData } from "@/lib/data";
import { Text } from "@/components/ui/Bidi";
import { Chip } from "@/components/ui/Badge";

type PriceInput = { priceFrom: unknown; priceTo: unknown; currency: string };

/** Prices are Decimal in the DB; format on the server so Kurdish digits never depend on the device. */
export async function priceLabel({ priceFrom, priceTo, currency }: PriceInput, locale: Locale): Promise<string | null> {
  const from = priceFrom == null ? null : Number(priceFrom);
  const to = priceTo == null ? null : Number(priceTo);
  if (from == null && to == null) return null;
  const t = await getTranslations({ locale, namespace: "services" });
  if (from != null && to != null && to !== from) return `${formatCurrency(from, locale, currency)} – ${formatCurrency(to, locale, currency)}`;
  return from != null ? `${to == null ? t("priceFrom") + " " : ""}${formatCurrency(from, locale, currency)}` : formatCurrency(to as number, locale, currency);
}

export async function ServiceCard({ s }: { s: ServiceCardData }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("services");
  const pageLang = LOCALE_META[locale].htmlLang;
  const name = localize(s, "name", locale);
  const provider = localize(s.business, "name", locale);
  const category = s.category ? localize(s.category, "name", locale) : null;
  const price = await priceLabel(s, locale);

  return (
    <article className="relative flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 card-lift shadow-card hover:border-brand/40">
      {category && <div><Chip><Text value={category} pageLang={pageLang} /></Chip></div>}
      <h3 className="text-base font-bold">
        <Link href={`/services/${s.business.slug}/${s.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
          <Text value={name} pageLang={pageLang} />
        </Link>
      </h3>
      <p className="text-sm text-muted">{t("offeredBy")} <Text value={provider} pageLang={pageLang} /></p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
        <span className="font-semibold">{price ?? <span className="font-normal text-muted">{t("priceOnRequest")}</span>}</span>
        {s.durationMin ? <span className="text-xs text-muted">{formatNumber(s.durationMin, locale)} {t("minutes")}</span> : null}
      </div>
    </article>
  );
}
