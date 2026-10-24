import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { descriptionFrom } from "@/lib/seo-server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { Link } from "@/i18n/routing";
import { localize, localizeText } from "@/lib/content";
import { getBusiness, getCategories } from "@/lib/data";
import { languageNames } from "@/components/cards/BusinessRow";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { directionsUrl, safeHttpUrl, safeTel } from "@/lib/urls";
import { whatsappLink } from "@/lib/whatsapp";
import { offerTimezone } from "@/lib/offers";
import { OfferList } from "@/components/business/OfferList";
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
import { isMappableCoordinate } from "@/lib/coordinates";
import { hasHours, hoursRows } from "@/lib/opening-hours";
import { OpenState } from "@/components/ui/OpenState";
import { ReviewSection } from "@/features/reviews/ReviewSection";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await getBusiness(slug);
  if (!b) return {};
  const l = locale as Locale;
  const nameText = localizeText(b, "name", l);
  const city = b.locations[0]?.city ? localizeText({ ...b.locations[0].city, name: b.locations[0].city.nameEn }, "name", l) : "";
  // The business's own description when it has one, else a generated one; always 120-155 characters.
  const description = await descriptionFrom(l, localizeText(b, "description", l), city ? "businessFallback" : "businessFallbackNoPlace", { name: nameText, place: city });
  return pageMetadata({ locale: l, path: `/business/${slug}`, title: localizeText(b, "name", l), description, image: b.coverUrl || b.logoUrl });
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
  const mapPoints: PlacePoint[] = b.locations.flatMap((loc) => isMappableCoordinate(loc.latitude, loc.longitude) && loc.longitude != null
    ? [{ id: loc.id, lat: loc.latitude, lng: loc.longitude, name: loc.label || name.text, sub: [loc.addressLine1, loc.postalCode].filter(Boolean).join(", ") }]
    : []);
  const about = localize(b, "description", l);
  const website = safeHttpUrl(b.website);
  const tel = safeTel(b.phone);
  // Only the business's public WhatsApp number (never an account phone), and only when it is a valid stored number.
  const whatsapp = whatsappLink(b.whatsapp);
  const offers = b.offers.map((o) => ({ ...o, discountValue: o.discountValue == null ? null : Number(o.discountValue), startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString() }));
  const category = b.categoryId ? (await getCategories()).find((c) => c.id === b.categoryId) : undefined;
  const categoryName = category ? localize({ ...category, name: category.nameDe }, "name", l) : null;
  const primaryCity = b.locations[0]?.city ? localize({ ...b.locations[0].city, name: b.locations[0].city.nameEn }, "name", l) : null;
  const langs = languageNames(b.languages);
  // One location button for the whole page: the primary location (else the first) in the device's map app.
  const placeAddress = (loc: (typeof b.locations)[number]) => [loc.addressLine1, loc.addressLine2, [loc.postalCode, loc.city?.nameEn].filter(Boolean).join(" ")]
    .map((part) => (part ?? "").replace(/[\s,]+$/, "")).filter(Boolean).join(", ");
  const mainLoc = b.locations.find((loc) => loc.isPrimary) ?? b.locations[0];
  const directions = mainLoc ? directionsUrl(mainLoc.latitude, mainLoc.longitude, placeAddress(mainLoc)) : null;
  const tm = await getTranslations("map");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: name.text,
    description: about.text || undefined,
    url: `https://${process.env.CANONICAL_HOST || "www.rega24.com"}/${locale}/business/${slug}`,
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
      <PageSchema name={name.text} path={`/business/${slug}`} crumbs={[{ name: t("businesses.title"), path: "/businesses" }, { name: name.text, path: `/business/${slug}` }]} />
      <ViewPing slug={b.slug} />
      <div className="container-page pt-8">
        <Breadcrumbs items={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title"), href: "/businesses" }, { label: <Text value={name} pageLang={pageLang} /> }]} />

        <header className="rega-shell overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(18rem,.95fr)_minmax(0,1.3fr)]">
            <div className="relative h-44 bg-brand-soft sm:h-56 lg:h-auto lg:min-h-[17rem]">
              {b.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.coverUrl} alt="" width={900} height={650} decoding="async" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--surface),var(--brand-soft))]">
                  <Avatar name={name.text} src={b.logoUrl} size="size-20 shadow-card lg:size-28" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col justify-center p-5 sm:p-6 lg:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="rega-display min-w-0 text-2xl! sm:text-3xl!"><Text value={name} pageLang={pageLang} /></h1>
                {b.verified && <VerifiedBadge />}
              </div>
              {(categoryName || primaryCity) && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted">
                  {categoryName && <span><Text value={categoryName} pageLang={pageLang} /></span>}
                  {categoryName && primaryCity && <span aria-hidden="true">·</span>}
                  {primaryCity && (
                    <span className="inline-flex items-center gap-1"><FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand" /><Text value={primaryCity} pageLang={pageLang} /></span>
                  )}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Rating value={b.ratingAvg} count={b.ratingCount} />
                {b.featured && <Chip>{t("businesses.featured")}</Chip>}
              </div>
              {about.text && <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-7 text-muted"><Text value={about} pageLang={pageLang} /></p>}
              {(tel || directions || whatsapp) && (
                <div className="mt-5 flex flex-wrap gap-2 [&>a]:flex-1 sm:[&>a]:flex-none">
                  {tel && <a href={`tel:${tel}`} aria-label={`${t("businesses.call")} – ${name.text}`} className={buttonClass("primary")}>{t("businesses.call")}</a>}
                  {directions && (
                    <a href={directions} target="_blank" rel="noopener noreferrer" aria-label={`${tm("directions")} – ${name.text}`} className={buttonClass("secondary", "gap-1.5")} data-testid="directions-button">
                      <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand" />{tm("directions")}
                    </a>
                  )}
                  {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`${t("businesses.whatsapp")} – ${name.text}`} className={buttonClass("secondary")} data-testid="whatsapp-button">{t("businesses.whatsapp")}</a>}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-10">
            {about.text && (
              <section aria-labelledby="about">
                <h2 id="about" className="mb-3 text-xl font-bold">{t("businesses.about")}</h2>
                <p className="whitespace-pre-line text-pretty leading-relaxed"><Text value={about} pageLang={pageLang} /></p>
              </section>
            )}

            <OfferList offers={offers} serverNow={new Date().toISOString()} timeZone={offerTimezone(b.locations[0]?.countryCode)} />

            {b.photos.length > 0 && (
              <section aria-labelledby="photos">
                <h2 id="photos" className="mb-3 text-xl font-bold">{t("businesses.photos")}</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {b.photos.map((src) => (
                    <li key={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-xl border border-line bg-surface-2 object-cover" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {langs.length > 0 && (
              <section aria-labelledby="languages">
                <h2 id="languages" className="mb-3 text-xl font-bold">{t("bizForm.languagesSpoken")}</h2>
                <ul className="flex flex-wrap gap-2">
                  {langs.map((lang) => <li key={lang} className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium">{lang}</li>)}
                </ul>
              </section>
            )}

            <section aria-labelledby="services">
              <h2 id="services" className="mb-3 text-xl font-bold">{t("businesses.servicesCount")}</h2>
              {b.services.length === 0 ? <p className="text-muted">{t("businesses.noServices")}</p> : (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
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
                  // Monday first; once any day is set, a day without hours is shown as closed.
                  const hours = hasHours(loc.openingHours) ? hoursRows(loc.openingHours) : [];
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
                        <>
                          <OpenState hours={loc.openingHours} countryCode={loc.countryCode} />
                          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="opening-hours">
                            {hours.map(({ day, value }) => (
                              <div key={day} className="contents"><dt className="text-muted">{t(`days.${day}`)}</dt><dd>{!value || value === "closed" ? t("nearby.closed") : <Ltr>{value}</Ltr>}</dd></div>
                            ))}
                          </dl>
                        </>
                      )}
                      {b.locations.length > 1 && directionsUrl(loc.latitude, loc.longitude, placeAddress(loc)) && (
                        <a href={directionsUrl(loc.latitude, loc.longitude, placeAddress(loc))!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline">
                          {tm("directions")} <span aria-hidden="true" className="rtl-flip ms-1">↗</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <ReviewSection businessId={b.id} businessSlug={b.slug} />
          </div>

          <aside aria-label={t("businesses.contact")} className="rega-shell order-first h-fit space-y-3 p-5 lg:order-none lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">{t("businesses.contact")}</h2>
            {b.email && <a href={`mailto:${b.email}`} className={buttonClass("secondary", "w-full")}>{t("businesses.sendEmail")}</a>}
            {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("secondary", "w-full")}>{t("businesses.visitWebsite")}</a>}
            <dl className="space-y-1 pt-2 text-sm text-muted">
              {b.phone && <div><dt className="sr-only">{t("businesses.phone")}</dt><dd>{tel ? <a href={`tel:${tel}`} className="hover:text-brand"><Ltr>{b.phone}</Ltr></a> : <Ltr>{b.phone}</Ltr>}</dd></div>}
              {b.email && <div><dt className="sr-only">{t("businesses.email")}</dt><dd className="break-all"><Ltr>{b.email}</Ltr></dd></div>}
            </dl>
            {b.ratingCount > 0 && <p className="text-xs text-muted">{t("businesses.reviewsCount", { count: formatNumber(b.ratingCount, l) })}</p>}
            <Link href={{ pathname: "/report", query: { url: jsonLd.url } }} rel="nofollow" className="inline-flex min-h-9 items-center text-xs font-semibold text-muted underline hover:text-ink">{t("report.reportThis")}</Link>
          </aside>
        </div>
      </div>
    </article>
  );
}
