import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { descriptionFrom } from "@/lib/seo-server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { Link } from "@/i18n/routing";
import { localize, localizeText } from "@/lib/content";
import { getService } from "@/lib/data";
import { safeTel } from "@/lib/urls";
import { priceLabel } from "@/components/cards/ServiceCard";
import { Chip, VerifiedBadge } from "@/components/ui/Badge";
import { Text } from "@/components/ui/Bidi";
import { buttonClass } from "@/components/ui/Button";
import { JsonLd } from "@/components/ui/JsonLd";
import { Breadcrumbs } from "@/components/ui/PageHeader";

type Props = { params: Promise<{ locale: string; businessSlug: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, businessSlug, slug } = await params;
  const s = await getService(businessSlug, slug);
  if (!s) return {};
  const description = await descriptionFrom(locale as Locale, localizeText(s, "description", locale as Locale), "serviceFallback", { name: localizeText(s, "name", locale as Locale), provider: localizeText(s.business, "name", locale as Locale) });
  return pageMetadata({ locale: locale as Locale, path: `/services/${businessSlug}/${slug}`, title: localizeText(s, "name", locale as Locale), description });
}

export default async function ServicePage({ params }: Props) {
  const { locale, businessSlug, slug } = await params;
  setRequestLocale(locale);
  const s = await getService(businessSlug, slug);
  if (!s) notFound();

  const l = (await getLocale()) as Locale;
  const t = await getTranslations();
  const pageLang = LOCALE_META[l].htmlLang;
  const name = localize(s, "name", l);
  const desc = localize(s, "description", l);
  const provider = localize(s.business, "name", l);
  const category = s.category ? localize(s.category, "name", l) : null;
  const price = await priceLabel(s, l);
  const tel = safeTel(s.business.phone);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: name.text,
    description: desc.text || undefined,
    provider: { "@type": "LocalBusiness", name: provider.text },
    offers: s.priceFrom != null ? { "@type": "Offer", price: Number(s.priceFrom), priceCurrency: s.currency } : undefined,
  };

  return (
    <div className="container-page py-8">
      <JsonLd data={jsonLd} />
      <PageSchema name={name.text} path={`/services/${businessSlug}/${slug}`} crumbs={[{ name: t("services.title"), path: "/services" }, { name: name.text, path: `/services/${businessSlug}/${slug}` }]} />
      <Breadcrumbs items={[{ label: t("nav.home"), href: "/" }, { label: t("services.title"), href: "/services" }, { label: <Text value={name} pageLang={pageLang} /> }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          {category && <div className="mb-3"><Chip><Text value={category} pageLang={pageLang} /></Chip></div>}
          <h1 className="text-3xl font-extrabold sm:text-4xl"><Text value={name} pageLang={pageLang} /></h1>
          {desc.text && <p className="mt-6 whitespace-pre-line text-pretty leading-relaxed"><Text value={desc} pageLang={pageLang} /></p>}
        </div>
        <aside className="h-fit space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24">
          <div>
            <p className="text-2xl font-extrabold">{price ?? <span className="text-base font-semibold text-muted">{t("services.priceOnRequest")}</span>}</p>
            {s.durationMin ? <p className="mt-1 text-sm text-muted">{t("services.duration")}: {formatNumber(s.durationMin, l)} {t("services.minutes")}</p> : null}
          </div>
          <div className="border-t border-line pt-4">
            <p className="text-sm text-muted">{t("services.offeredBy")}</p>
            <p className="flex flex-wrap items-center gap-2 font-bold"><Link href={`/business/${s.business.slug}`} className="hover:underline"><Text value={provider} pageLang={pageLang} /></Link>{s.business.verified && <VerifiedBadge />}</p>
          </div>
          {tel && <a href={`tel:${tel}`} className={buttonClass("primary", "w-full")}>{t("businesses.call")}</a>}
          <Link href={`/business/${s.business.slug}`} className={buttonClass("secondary", "w-full")}>{t("common.viewDetails")}</Link>
          <Link href={{ pathname: "/report", query: { url: `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}/${locale}/services/${businessSlug}/${slug}` } }} rel="nofollow" className="inline-flex min-h-9 items-center text-xs font-semibold text-muted underline hover:text-ink">{t("report.reportThis")}</Link>
        </aside>
      </div>
    </div>
  );
}
