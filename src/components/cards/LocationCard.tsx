import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import type { LocationCardData } from "@/lib/data";
import { Ltr, Text } from "@/components/ui/Bidi";

export async function LocationCard({ l }: { l: LocationCardData }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("locations");
  const pageLang = LOCALE_META[locale].htmlLang;
  const biz = localize(l.business, "name", locale);
  const city = l.city ? localize({ ...l.city, name: l.city.nameEn }, "name", locale) : null;

  return (
    <article className="relative flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5 card-lift shadow-card hover:border-brand/40">
      <h3 className="text-base font-bold">
        <Link href={`/businesses/${l.business.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
          <Text value={biz} pageLang={pageLang} />
        </Link>
      </h3>
      {/* Street addresses are usually Latin script: isolate them so RTL pages don't scramble punctuation. */}
      <address className="text-sm not-italic text-muted"><Ltr>{l.addressLine1}</Ltr>{l.postalCode && <>, <Ltr>{l.postalCode}</Ltr></>}</address>
      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted">
        <span>{city ? <Text value={city} pageLang={pageLang} /> : t("singular")}</span>
        {l.isPrimary && <span className="text-brand">★</span>}
      </div>
    </article>
  );
}
