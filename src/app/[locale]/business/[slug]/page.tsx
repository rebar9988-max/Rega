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
import { directionsUrl, mapLinks, safeHttpUrl, safeTel } from "@/lib/urls";
import { whatsappLink } from "@/lib/whatsapp";
import { offerTimezone } from "@/lib/offers";
import { OfferList } from "@/components/business/OfferList";
import { ExpandableText } from "@/components/business/ExpandableText";
import { ShareButton } from "@/components/business/ShareButton";
import { DirectionsMenu } from "@/components/business/DirectionsMenu";
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
import { BusinessSocialLinks } from "@/components/business/BusinessSocialLinks";
import { BUSINESS_SOCIAL_PLATFORMS, BUSINESS_SOCIAL_FIELDS, normalizeBusinessSocialUrl } from "@/lib/business-social";
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
  const mainAddress = mainLoc ? placeAddress(mainLoc) : "";
  const mainCity = mainLoc?.city ? localize({ ...mainLoc.city, name: mainLoc.city.nameEn }, "name", l) : null;
  const directions = mainLoc ? mapLinks(mainLoc.latitude, mainLoc.longitude, mainAddress, name.text) : null;
  // Gallery: the cover plus up to three further images, in the owner's order (older listings may store more; they stay saved).
  const gallery = [b.coverUrl, ...b.photos.slice(0, 3)].map((u) => safeHttpUrl(u)).filter((u): u is string => Boolean(u));
  const showLocations = b.locations.length > 1 || mapPoints.length > 0 || b.locations.some((loc) => hasHours(loc.openingHours));
  const tm = await getTranslations("map");
  const pageUrl = `https://${process.env.CANONICAL_HOST || "www.rega24.com"}/${locale}/business/${slug}`;
  const mainHours = mainLoc && hasHours(mainLoc.openingHours) ? mainLoc : null;
  const services = b.services.map((s) => ({ ...s, cover: safeHttpUrl(s.coverUrl) }));
  const serviceCovers = services.some((s) => s.cover);
  const hasContact = Boolean(tel || whatsapp || b.email || website);
  // Primary action uses the real phone when available, otherwise the real destination.
  const primaryAction = tel ? "call" : "directions";
  const actionCount = (tel ? 1 : 0) + (directions ? 1 : 0) + 1;
  const actionClass = (kind: "call" | "directions" | "share") =>
    buttonClass(kind === primaryAction ? "primary" : "secondary", "min-h-12 w-full gap-2 px-3 text-center leading-tight shadow-sm motion-safe:active:scale-[.98]");

  const socialUrls = BUSINESS_SOCIAL_PLATFORMS.flatMap((p) => { const r = normalizeBusinessSocialUrl(p, b[BUSINESS_SOCIAL_FIELDS[p]]); return r.ok && r.value ? [r.value] : []; });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: name.text,
    description: about.text || undefined,
    url: pageUrl,
    image: b.logoUrl || b.coverUrl || undefined,
    telephone: b.phone || undefined,
    email: b.email || undefined,
    sameAs: website || socialUrls.length ? [...(website ? [website] : []), ...socialUrls] : undefined,
    aggregateRating: b.ratingCount ? { "@type": "AggregateRating", ratingValue: b.ratingAvg, reviewCount: b.ratingCount } : undefined,
    address: b.locations[0] ? { "@type": "PostalAddress", streetAddress: b.locations[0].addressLine1, postalCode: b.locations[0].postalCode || undefined, addressCountry: b.locations[0].countryCode, addressLocality: b.locations[0].city?.nameEn } : undefined,
  };

  return (
    <article>
      <JsonLd data={jsonLd} />
      <PageSchema name={name.text} path={`/business/${slug}`} crumbs={[{ name: t("businesses.title"), path: "/businesses" }, { name: name.text, path: `/business/${slug}` }]} />
      <ViewPing slug={b.slug} />
      <div className="container-page pt-6">
        <Breadcrumbs items={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title"), href: "/businesses" }, { label: <Text value={name} pageLang={pageLang} /> }]} />

        {/* One profile for every business: identity, actions and facts; each part only when the business has the data. */}
        {/* No overflow clipping: the directions menu opens below its button and must stay visible. */}
        <header className={`rega-shell ${gallery.length ? "lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : ""}`} data-testid="business-profile">
          {gallery.length > 0 && (
            // Same gallery on every screen: one main image and a row of up to three more; sizes reserved, no layout shift.
            <div className="space-y-2 p-2 pb-0 sm:p-3 sm:pb-0" data-testid="business-gallery">
              <a href={gallery[0]} target="_blank" rel="noopener noreferrer" aria-label={t("businesses.openPhoto", { n: formatNumber(1, l) })}
                className="relative block aspect-[16/9] overflow-hidden rounded-xl bg-brand-soft sm:aspect-[21/9] lg:aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gallery[0]} alt={name.text} width={1200} height={500} decoding="async" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
                {gallery.length > 1 && (
                  <span className="absolute bottom-2 end-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                    <FigmaIcon name="grid-3x3" className="size-3.5" />{t("businesses.photoCount", { count: formatNumber(gallery.length, l) })}
                  </span>
                )}
              </a>
              {gallery.length > 1 && (
                <ul className="grid grid-cols-3 gap-2 sm:max-w-md">
                  {gallery.slice(1).map((src, i) => (
                    <li key={src}>
                      <a href={src} target="_blank" rel="noopener noreferrer" aria-label={t("businesses.openPhoto", { n: formatNumber(i + 2, l) })} className="block overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={name.text} width={400} height={300} loading="lazy" decoding="async" className="aspect-[4/3] w-full bg-surface-2 object-cover transition-transform motion-safe:hover:scale-[1.03]" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-4">
              {(b.logoUrl || gallery.length === 0) && <Avatar name={name.text} src={b.logoUrl} size="size-14 shrink-0 shadow-card sm:size-16" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="rega-display min-w-0 text-2xl! [overflow-wrap:anywhere] sm:text-3xl!"><Text value={name} pageLang={pageLang} /></h1>
                  {b.verified && <VerifiedBadge />}
                </div>
                {(categoryName || primaryCity) && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    {categoryName && <span><Text value={categoryName} pageLang={pageLang} /></span>}
                    {categoryName && primaryCity && <span aria-hidden="true">·</span>}
                    {primaryCity && (
                      <span className="inline-flex items-center gap-1"><FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand" /><Text value={primaryCity} pageLang={pageLang} /></span>
                    )}
                  </p>
                )}
                {(b.ratingCount > 0 || b.featured) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {b.ratingCount > 0 && <Rating value={b.ratingAvg} count={b.ratingCount} />}
                    {b.featured && <Chip>{t("businesses.featured")}</Chip>}
                  </div>
                )}
              </div>
            </div>

            <div className={`relative mt-5 grid gap-2 sm:gap-3 lg:max-w-2xl ${actionCount === 3 ? "grid-cols-3" : actionCount === 2 ? "grid-cols-2" : "grid-cols-1"}`} data-testid="business-actions">
              {tel && (
                <a href={`tel:${tel}`} aria-label={`${t("businesses.call")} – ${name.text}`} className={actionClass("call")}>
                  <FigmaIcon name="phone" className="size-5 shrink-0" /><span>{t("businesses.call")}</span>
                </a>
              )}
              {directions && (
                <DirectionsMenu links={directions} address={mainAddress} label={tm("directions")} openWith={tm("openWith")} otherApp={tm("otherApp")}
                  ariaLabel={`${tm("directions")} – ${name.text}`} className={actionClass("directions")} />
              )}
              <ShareButton url={pageUrl} title={name.text} label={t("businesses.share")} copiedLabel={t("businesses.linkCopied")} className={actionClass("share")} />
            </div>

            {(mainAddress || mainHours || langs.length > 0) && (
              <ul className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:max-w-2xl" data-testid="business-facts">
                {mainAddress && (
                  <li className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 min-[380px]:col-span-2">
                    <FigmaIcon name="map-pin" className="size-5 shrink-0 text-brand" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{t("locations.address")}</span>
                      <address className="block text-xs not-italic text-muted" data-testid="business-address">
                        {/* Latin street and postcode stay LTR inside RTL pages; the city keeps its own language. */}
                        <Ltr>{mainLoc!.addressLine1.replace(/[\s,]+$/, "")}</Ltr>{mainLoc!.addressLine2 && <>, <Ltr>{mainLoc!.addressLine2}</Ltr></>}
                        {(mainLoc!.postalCode || mainCity) && ", "}
                        {mainLoc!.postalCode && <><Ltr>{mainLoc!.postalCode}</Ltr>{" "}</>}{mainCity && <Text value={mainCity} pageLang={pageLang} />}
                      </address>
                    </span>
                  </li>
                )}
                {mainHours && (
                  <li>
                    <a href="#locations" className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 hover:border-brand">
                      <FigmaIcon name="clock" className="size-5 shrink-0 text-brand" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{t("locations.openingHours")}</span>
                        <OpenState hours={mainHours.openingHours} countryCode={mainHours.countryCode} className="mt-0.5" />
                      </span>
                    </a>
                  </li>
                )}
                {langs.length > 0 && (
                  <li className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                    <FigmaIcon name="languages" className="size-5 shrink-0 text-brand" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{t("bizForm.languagesSpoken")}</span>
                      <span className="block text-xs text-muted" data-testid="business-languages">{langs.join(" · ")}</span>
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0 space-y-8">
            <BusinessSocialLinks business={b} name={name.text} />
            {about.text && (
              <section aria-labelledby="about">
                <h2 id="about" className="mb-3 text-xl font-bold">{t("businesses.about")}</h2>
                <ExpandableText long={about.text.length > 320} more={t("businesses.readMore")} less={t("businesses.readLess")}>
                  <Text value={about} pageLang={pageLang} />
                </ExpandableText>
              </section>
            )}


            {services.length > 0 && (
              <section aria-labelledby="services">
                <h2 id="services" className="mb-3 text-xl font-bold">{t("businesses.servicesCount")}</h2>
                {serviceCovers ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {await Promise.all(services.map(async (s) => (
                      <li key={s.id}>
                        <Link href={`/services/${b.slug}/${s.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card hover:border-brand/40">
                          {s.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.cover} alt="" width={400} height={300} loading="lazy" decoding="async" className="aspect-[4/3] w-full bg-surface-2 object-cover" />
                          ) : (
                            <span aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center bg-brand-soft"><FigmaIcon name="sparkles" className="size-8 text-brand" /></span>
                          )}
                          <span className="flex flex-1 flex-col gap-1 p-3">
                            <span className="text-sm font-semibold leading-snug"><Text value={localize(s, "name", l)} pageLang={pageLang} /></span>
                            <span className="mt-auto text-xs text-muted">{(await priceLabel(s, l)) ?? t("services.priceOnRequest")}</span>
                          </span>
                        </Link>
                      </li>
                    )))}
                  </ul>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
                    {await Promise.all(services.map(async (s) => (
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
            )}


            <OfferList offers={offers} serverNow={new Date().toISOString()} timeZone={offerTimezone(b.locations[0]?.countryCode)} />

            {showLocations && (
              <section aria-labelledby="locations-title" id="locations" className="scroll-mt-24">
                <h2 className="mb-3 text-xl font-bold" id="locations-title">{t("locations.title")}</h2>
                {mapPoints.length > 0 && <PlacesMap points={mapPoints} className="mb-4 h-64 sm:h-72" />}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {b.locations.map((loc) => {
                    const city = loc.city ? localize({ ...loc.city, name: loc.city.nameEn }, "name", l) : null;
                    // Monday first; once any day is set, a day without hours is shown as closed.
                    const hours = hasHours(loc.openingHours) ? hoursRows(loc.openingHours) : [];
                    const single = b.locations.length === 1;
                    // One location: its address is already in the facts at the top, so the card holds the opening hours only.
                    if (single && hours.length === 0) return null;
                    return (
                      <div key={loc.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="font-bold">{single ? t("locations.openingHours") : loc.label || t("locations.singular")}</h3>
                          {loc.isPrimary && b.locations.length > 1 && <Chip>{t("businesses.primary")}</Chip>}
                        </div>
                        {!single && (
                          <address className="text-sm not-italic text-muted">
                            <Ltr>{loc.addressLine1}</Ltr>{loc.addressLine2 && <>, <Ltr>{loc.addressLine2}</Ltr></>}<br />
                            {loc.postalCode && <><Ltr>{loc.postalCode}</Ltr>{" "}</>}{city && <Text value={city} pageLang={pageLang} />}
                          </address>
                        )}
                        {hours.length > 0 && (
                          <>
                            {/* The open state of the main location is shown once, in the facts at the top. */}
                            {loc.id !== mainHours?.id && <OpenState hours={loc.openingHours} countryCode={loc.countryCode} />}
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
            )}

            <ReviewSection businessId={b.id} businessSlug={b.slug} />

            {!hasContact && (
              <Link href={{ pathname: "/report", query: { url: pageUrl } }} rel="nofollow" className="inline-flex min-h-9 items-center text-xs font-semibold text-muted underline hover:text-ink">{t("report.reportThis")}</Link>
            )}
          </div>

          {hasContact && (
            <aside aria-label={t("businesses.contact")} className="rega-shell h-fit space-y-3 p-4 sm:p-5 lg:sticky lg:top-24">
              <h2 className="text-lg font-bold">{t("businesses.contact")}</h2>
              {b.phone && (
                <p className="flex items-center gap-2 text-sm">
                  <FigmaIcon name="phone" className="size-4 shrink-0 text-brand" />
                  <span className="sr-only">{t("businesses.phone")}</span>
                  {tel ? <a href={`tel:${tel}`} className="font-semibold hover:text-brand"><Ltr>{b.phone}</Ltr></a> : <Ltr>{b.phone}</Ltr>}
                </p>
              )}
              {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`${t("businesses.whatsapp")} – ${name.text}`} className={buttonClass("secondary", "w-full")} data-testid="whatsapp-button">{t("businesses.whatsapp")}</a>}
              {b.email && <a href={`mailto:${b.email}`} title={t("businesses.sendEmail")} className={buttonClass("secondary", "w-full")}><span className="sr-only">{t("businesses.sendEmail")}: </span><span className="min-w-0 truncate"><Ltr>{b.email}</Ltr></span></a>}
              {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("secondary", "w-full")}>{t("businesses.visitWebsite")}</a>}
              <Link href={{ pathname: "/report", query: { url: pageUrl } }} rel="nofollow" className="inline-flex min-h-9 items-center text-xs font-semibold text-muted underline hover:text-ink">{t("report.reportThis")}</Link>
            </aside>
          )}
        </div>
      </div>
    </article>
  );
}
