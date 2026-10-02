import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { Link } from "@/i18n/routing";
import { localize, localizeText } from "@/lib/content";
import { getBusiness } from "@/lib/data";
import { safeHttpUrl, safeTel } from "@/lib/urls";
import { priceLabel } from "@/components/cards/ServiceCard";
import { Avatar } from "@/components/ui/Avatar";
import { Chip, VerifiedBadge } from "@/components/ui/Badge";
import { Ltr, Text } from "@/components/ui/Bidi";
import { buttonClass } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { Rating } from "@/components/ui/Rating";
import { JsonLd } from "@/components/ui/JsonLd";
import { ViewPing } from "@/components/ui/ViewPing";
import { PlacesMap, type PlacePoint } from "@/components/map/PlacesMap";
import { isValidCoordinate } from "@/lib/coordinates";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await getBusiness(slug);
  if (!b) return {};
  const l = locale as Locale;
  const description = localizeText(b, "description", l).slice(0, 160) || undefined;
  return pageMetadata({ locale: l, path: `/businesses/${slug}`, title: localizeText(b, "name", l), description, image: b.coverUrl || b.logoUrl });
}

export default async function BusinessPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const b = await getBusiness(slug);
  if (!b) notFound();

  const l = (await getLocale()) as Locale;
  const t = await getTranslations();
  const pageLang = LOCALE_META[l].htmlLang;
  const name = localize(b, "name", l);
  const mapPoints: PlacePoint[] = b.locations.flatMap((loc) => isValidCoordinate(loc.latitude, loc.longitude) && loc.longitude != null
    ? [{ id: loc.id, lat: loc.latitude, lng: loc.longitude, name: loc.label || name.text, sub: [loc.addressLine1, loc.postalCode].filter(Boolean).join(", ") }]
    : []);
  const about = localize(b, "description", l);
  const website = safeHttpUrl(b.website);
  const tel = safeTel(b.phone);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: name.text,
    description: about.text || undefined,
    url: `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}/${locale}/businesses/${slug}`,
    image: b.logoUrl || b.coverUrl || undefined,
    telephone: b.phone || undefined,
    email: b.email || undefined,
    sameAs: website ? [website] : undefined,
    aggregateRating: b.ratingCount ? { "@type": "AggregateRating", ratingValue: b.ratingAvg, reviewCount: b.ratingCount } : undefined,
    address: b.locations[0] ? { "@type": "PostalAddress", streetAddress: b.locations[0].addressLine1, postalCode: b.locations[0].postalCode || undefined, addressCountry: b.locations[0].countryCode, addressLocality: b.locations[0].city?.nameEn } : undefined,
  };

  return (
    <article>
      <JsonLd data={jsonLd} />
      <PageSchema name={name.text} path={`/businesses/${slug}`} crumbs={[{ name: t("businesses.title"), path: "/businesses" }, { name: name.text, path: `/businesses/${slug}` }]} />
      <ViewPing slug={b.slug} />
      {b.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.coverUrl} alt="" width={1200} height={320} decoding="async" fetchPriority="high" className="h-40 w-full object-cover sm:h-64" />
      )}
      <div className="container-page pt-8">
        <Breadcrumbs items={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title"), href: "/businesses" }, { label: <Text value={name} pageLang={pageLang} /> }]} />
        <header className="flex flex-wrap items-start gap-4">
          <Avatar name={name.text} src={b.logoUrl} size="size-20" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold sm:text-4xl"><Text value={name} pageLang={pageLang} /></h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Rating value={b.ratingAvg} count={b.ratingCount} />
              {b.verified && <VerifiedBadge />}
              {b.featured && <Chip>{t("businesses.featured")}</Chip>}
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-10">
            {about.text && (
              <section aria-labelledby="about">
                <h2 id="about" className="mb-3 text-xl font-bold">{t("businesses.about")}</h2>
                <p className="whitespace-pre-line text-pretty leading-relaxed"><Text value={about} pageLang={pageLang} /></p>
              </section>
            )}

            <section aria-labelledby="services">
              <h2 id="services" className="mb-3 text-xl font-bold">{t("businesses.servicesCount")}</h2>
              {b.services.length === 0 ? <p className="text-muted">{t("businesses.noServices")}</p> : (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                  {await Promise.all(b.services.map(async (s) => (
                    <li key={s.id}>
                      <Link href={`/services/${b.slug}/${s.slug}`} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2">
                        <span className="font-semibold"><Text value={localize(s, "name", l)} pageLang={pageLang} /></span>
                        <span className="shrink-0 text-sm text-muted">{(await priceLabel(s, l)) ?? t("services.priceOnRequest")}</span>
                      </Link>
                    </li>
                  )))}
                </ul>
              )}
            </section>

            <section aria-labelledby="locations">
              <h2 id="locations" className="mb-3 text-xl font-bold">{t("locations.title")}</h2>
              {mapPoints.length > 0 && <PlacesMap points={mapPoints} className="mb-4 h-72" />}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {b.locations.map((loc) => {
                  const city = loc.city ? localize({ ...loc.city, name: loc.city.nameEn }, "name", l) : null;
                  const hours = loc.openingHours && typeof loc.openingHours === "object" && !Array.isArray(loc.openingHours) ? Object.entries(loc.openingHours as Record<string, string>) : [];
                  return (
                    <div key={loc.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-bold">{loc.label || t("locations.singular")}</h3>
                        {loc.isPrimary && <Chip>{t("businesses.primary")}</Chip>}
                      </div>
                      <address className="text-sm not-italic text-muted">
                        <Ltr>{loc.addressLine1}</Ltr>{loc.addressLine2 && <>, <Ltr>{loc.addressLine2}</Ltr></>}<br />
                        {loc.postalCode && <><Ltr>{loc.postalCode}</Ltr>{" "}</>}{city && <Text value={city} pageLang={pageLang} />}
                      </address>
                      {hours.length > 0 && (
                        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                          {hours.map(([day, value]) => (
                            <div key={day} className="contents"><dt className="text-muted">{t.has(`days.${day.toLowerCase().slice(0, 3)}`) ? t(`days.${day.toLowerCase().slice(0, 3)}`) : day}</dt><dd><Ltr>{String(value)}</Ltr></dd></div>
                          ))}
                        </dl>
                      )}
                      {loc.latitude != null && loc.longitude != null && (
                        <a href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=16/${loc.latitude}/${loc.longitude}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline">
                          {t("locations.viewOnMap")} <span aria-hidden="true" className="rtl-flip ms-1">↗</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside aria-label={t("businesses.contact")} className="h-fit space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">{t("businesses.contact")}</h2>
            {tel && <a href={`tel:${tel}`} className={buttonClass("primary", "w-full")}>{t("businesses.call")}</a>}
            {b.email && <a href={`mailto:${b.email}`} className={buttonClass("secondary", "w-full")}>{t("businesses.sendEmail")}</a>}
            {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("secondary", "w-full")}>{t("businesses.visitWebsite")}</a>}
            <dl className="space-y-1 pt-2 text-sm text-muted">
              {b.phone && <div><dt className="sr-only">{t("businesses.phone")}</dt><dd><Ltr>{b.phone}</Ltr></dd></div>}
              {b.email && <div><dt className="sr-only">{t("businesses.email")}</dt><dd className="break-all"><Ltr>{b.email}</Ltr></dd></div>}
            </dl>
            {b.ratingCount > 0 && <p className="text-xs text-muted">{t("businesses.reviewsCount", { count: formatNumber(b.ratingCount, l) })}</p>}
          </aside>
        </div>
      </div>
    </article>
  );
}
