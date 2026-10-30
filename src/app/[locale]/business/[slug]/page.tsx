import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { descriptionFrom } from "@/lib/seo-server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LOCALE_META, formatDate, formatNumber, type Locale } from "@/i18n/locales";
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
import { JsonLd } from "@/components/ui/JsonLd";
import { ViewPing } from "@/components/ui/ViewPing";
import { PlacesMap, type PlacePoint } from "@/components/map/PlacesMap";
import { isMappableCoordinate } from "@/lib/coordinates";
import { closedOnHolidays, hasHours, hasHoursInfo, hoursRows, upcomingExceptions } from "@/lib/opening-hours";
import { timezoneFor } from "@/lib/geo";
import { OpenState } from "@/components/ui/OpenState";
import { preload } from "react-dom";
import { responsiveImage } from "@/features/business-images/variants";
import { ReviewSection } from "@/features/reviews/ReviewSection";
import { ProfileTabs } from "@/components/business/ProfileTabs";
import { SocialLinks } from "@/components/business/SocialLinks";
import { socialLinks } from "@/lib/social-links";

const STAR = "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3Z";
const StarIcon = ({ className }: { className: string }) => <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>;

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
  // The cover is the largest paint: announced in <head>, so the browser starts it (and the media connection) early.
  // Main image: full width up to the page container (1216 px); thumbnails: a third of it, at most 144 px from sm up.
  const coverSizes = "(min-width: 1280px) 1216px, 100vw";
  const cover = gallery[0] ? responsiveImage(gallery[0]) : null;
  if (cover) preload(cover.src, { as: "image", fetchPriority: "high", ...(cover.srcSet ? { imageSrcSet: cover.srcSet, imageSizes: coverSizes } : {}) });
  const mainHours = mainLoc && hasHoursInfo(mainLoc.openingHours) ? mainLoc : null;
  // The main location's hours are in the Hours tab; the locations section is for further places and the map.
  const showLocations = b.locations.length > 1 || mapPoints.length > 0 || b.locations.some((loc) => loc.id !== mainHours?.id && hasHoursInfo(loc.openingHours));
  const tm = await getTranslations("map");
  const pageUrl = `https://${process.env.CANONICAL_HOST || "www.rega24.com"}/${locale}/business/${slug}`;
  // Closures and special hours still to come, in the location's own calendar; dates shown as plain calendar days.
  const localToday = (countryCode: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezoneFor(countryCode), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const day = (date: string) => formatDate(`${date}T00:00:00Z`, locale as Locale, { timeZone: "UTC" });
  const services = b.services.map((s) => ({ ...s, cover: safeHttpUrl(s.coverUrl) }));
  const serviceCovers = services.some((s) => s.cover);
  // Only the platforms the business entered, each re-checked against its own domain (lib/social-links.ts).
  const social = socialLinks(b);
  const hasContact = Boolean(b.phone || whatsapp || b.email || website || social.length > 0);
  const ratingText = formatNumber(b.ratingAvg, l, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Primary (red) action: directions when the place can be found, else the call; share is always possible.
  const primaryAction = directions ? "directions" : "call";
  const actionCount = (tel ? 1 : 0) + (directions ? 1 : 0) + 1;
  const actionClass = (kind: "call" | "directions" | "share") =>
    buttonClass(kind === primaryAction ? "primary" : "secondary", "min-h-12 w-full gap-2 px-3 text-center leading-tight shadow-sm motion-safe:active:scale-[.98]");

  /** Weekly hours (Monday first; once any day is set, a day without hours is closed), upcoming changes and holiday closure. */
  const hoursDetail = (loc: (typeof b.locations)[number]) => {
    const hours = hasHours(loc.openingHours) ? hoursRows(loc.openingHours) : [];
    const changes = upcomingExceptions(loc.openingHours, localToday(loc.countryCode));
    const holidaysClosed = closedOnHolidays(loc.openingHours);
    return (
      <>
        {hours.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="opening-hours">
            {hours.map(({ day, value }) => (
              <div key={day} className="contents"><dt className="text-muted">{t(`days.${day}`)}</dt><dd>{!value || value === "closed" ? t("nearby.closed") : <Ltr>{value}</Ltr>}</dd></div>
            ))}
          </dl>
        )}
        {(changes.length > 0 || holidaysClosed) && (
          <div className="mt-3 text-sm" data-testid="hours-changes">
            {holidaysClosed && <p className="text-muted">{t("locations.closedOnHolidays")}</p>}
            {changes.length > 0 && (
              <>
                <h4 className="mt-2 font-semibold">{t("locations.hoursChanges")}</h4>
                <ul className="mt-1 space-y-1">
                  {changes.map((e) => (
                    <li key={`${e.from}-${e.to}-${e.hours}`}>
                      <time dateTime={e.from}>{day(e.from)}</time>{e.to !== e.from && <>{" – "}<time dateTime={e.to}>{day(e.to)}</time></>}{": "}
                      {e.hours === "closed" ? t("nearby.closed") : <Ltr>{e.hours}</Ltr>}
                      {e.reason && <span className="text-muted"> · <bdi>{e.reason}</bdi></span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </>
    );
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: name.text,
    description: about.text || undefined,
    url: pageUrl,
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
      {/* Breadcrumbs from sm up; on phones the back button on the cover takes their place (the JSON-LD trail stays). */}
      <div className="container-page hidden pt-6 sm:block">
        <Breadcrumbs items={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title"), href: "/businesses" }, { label: <Text value={name} pageLang={pageLang} /> }]} />
      </div>

      {/* One profile for every business: cover, identity card, actions and facts; each part only when the business has the data. */}
      {/* No overflow clipping on the card: the directions menu opens below its button and must stay visible. */}
      <header className="rega-profile mx-auto w-full max-w-[90rem] sm:px-6 sm:pt-4 lg:px-14" data-testid="business-profile">
        {/* Cover: full width on phones, rounded from sm up; up to three more photos as thumbnails on it. Sizes reserved, no layout shift.
            Without photos a short REGA-tinted band keeps the back button and the card overlap (never a stock photo). */}
        <div className={`relative overflow-hidden sm:rounded-3xl ${gallery.length > 0 ? "h-64 bg-surface-2 min-[400px]:h-72 sm:h-80 lg:h-[26rem]" : "h-28 bg-brand-soft sm:h-36"}`} {...(gallery.length > 0 ? { "data-testid": "business-gallery" } : {})}>
          {gallery.length > 0 && (
            <a href={gallery[0]} target="_blank" rel="noopener noreferrer" aria-label={t("businesses.openPhoto", { n: formatNumber(1, l) })} className="absolute inset-0 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...cover} sizes={cover?.srcSet ? coverSizes : undefined} alt="" width={1200} height={500} decoding="async" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
            </a>
          )}
          <Link href="/businesses" aria-label={t("common.back")} data-testid="business-back"
            className="absolute start-4 top-4 grid size-11 place-items-center rounded-full bg-white text-slate-900 shadow-sm transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-safe:active:scale-95">
            <FigmaIcon name="arrow-left" className="rtl-flip size-5" />
          </Link>
          {gallery.length > 1 && (
            <span className="absolute end-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
              <FigmaIcon name="grid-3x3" className="size-3.5" />{t("businesses.photoCount", { count: formatNumber(gallery.length, l) })}
            </span>
          )}
          {gallery.length > 1 && (
            <ul className="absolute bottom-12 end-4 flex gap-2 sm:bottom-16">
              {gallery.slice(1).map((src, i) => (
                <li key={src}>
                  <a href={src} target="_blank" rel="noopener noreferrer" aria-label={t("businesses.openPhoto", { n: formatNumber(i + 2, l) })} className="block overflow-hidden rounded-xl shadow-sm ring-2 ring-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img {...responsiveImage(src)} sizes="(min-width: 640px) 64px, 48px" alt="" width={400} height={300} loading="lazy" decoding="async" className="size-12 bg-surface-2 object-cover transition-transform motion-safe:hover:scale-[1.05] sm:size-16" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Identity card, pulled up over the cover: name, category and city on the reading side, the rating opposite. */}
        <div className="relative z-10 mx-4 -mt-8 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:mx-6 sm:-mt-12 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {(b.logoUrl || gallery.length === 0) && <Avatar name={name.text} src={b.logoUrl} size="size-14 shrink-0 shadow-card sm:size-16" />}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="rega-display min-w-0 text-2xl! [overflow-wrap:anywhere] sm:text-3xl!"><Text value={name} pageLang={pageLang} /></h1>
                  {b.verified && <VerifiedBadge />}
                </div>
                {categoryName && <p className="mt-1 text-sm text-muted"><Text value={categoryName} pageLang={pageLang} /></p>}
                {primaryCity && (
                  <p className="mt-1.5 flex items-center gap-1 text-sm text-muted"><FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand-text" /><Text value={primaryCity} pageLang={pageLang} /></p>
                )}
                {b.featured && <div className="mt-2"><Chip>{t("businesses.featured")}</Chip></div>}
              </div>
            </div>
            {b.ratingCount > 0 && (
              <a href="#reviews" className="shrink-0 rounded-xl text-end hover:opacity-80" data-testid="business-rating"
                aria-label={t("home.ratingLabel", { rating: ratingText, count: b.ratingCount })}>
                <span className="inline-flex items-center gap-1 text-lg font-bold" aria-hidden="true"><StarIcon className="size-5 text-sun" /><bdi>{ratingText}</bdi></span>
                <span className="block text-xs text-muted" aria-hidden="true">{t("businesses.reviewsCount", { count: formatNumber(b.ratingCount, l) })}</span>
              </a>
            )}
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

          {(mainAddress || langs.length > 0) && (
            <ul className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:max-w-2xl" data-testid="business-facts">
              {mainAddress && (
                <li className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 min-[380px]:col-span-2">
                  <FigmaIcon name="map-pin" className="size-5 shrink-0 text-brand-text" />
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
              {langs.length > 0 && (
                <li className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 min-[380px]:col-span-2">
                  <FigmaIcon name="languages" className="size-5 shrink-0 text-brand-text" />
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

      <div className="container-page">
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
          {/* About / Hours / Reviews: the main location's hours live in the Hours tab only (shown once). */}
          <div className="min-w-0 lg:col-start-1">
            <ProfileTabs label={name.text} tabs={[
              {
                key: "about", label: t("businesses.about"), panel: (
                  <section aria-labelledby="about">
                    <h2 id="about" className="sr-only">{t("businesses.about")}</h2>
                    {about.text ? (
                      <ExpandableText long={about.text.length > 320} more={t("businesses.readMore")} less={t("businesses.readLess")}>
                        <Text value={about} pageLang={pageLang} />
                      </ExpandableText>
                    ) : <p className="text-sm text-muted">{t("businesses.noAbout")}</p>}
                  </section>
                ),
              },
              {
                key: "hours", label: t("businesses.tabHours"), panel: mainHours ? (
                  <div>
                    <div className="flex items-start gap-2">
                      <FigmaIcon name="clock" className="mt-1 size-5 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <h2 className="font-semibold">{t("locations.openingHours")}</h2>
                        <OpenState hours={mainHours.openingHours} countryCode={mainHours.countryCode} regionSlug={mainHours.city?.region?.slug} className="mt-1" />
                      </div>
                    </div>
                    {hoursDetail(mainHours)}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <FigmaIcon name="clock" className="mt-0.5 size-5 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <h2 className="font-semibold">{t("locations.openingHours")}</h2>
                      <p className="mt-1 text-sm text-muted">{t("businesses.hoursSoon")}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "reviews", label: t("businesses.rating"), panel: (
                  <div>
                    {b.ratingCount > 0 ? (
                      <div className="flex items-center gap-4" data-testid="business-rating-summary">
                        <span className="text-5xl font-extrabold leading-none"><bdi>{ratingText}</bdi></span>
                        <span className="min-w-0">
                          <span className="flex gap-0.5" dir="ltr" role="img" aria-label={t("home.ratingLabel", { rating: ratingText, count: b.ratingCount })}>
                            {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} className={`size-5 ${i < Math.round(b.ratingAvg) ? "text-sun" : "text-line"}`} />)}
                          </span>
                          <span className="mt-1 block text-sm text-muted">{t("businesses.reviewsCount", { count: formatNumber(b.ratingCount, l) })}</span>
                        </span>
                      </div>
                    ) : <p className="text-sm text-muted">{t("businesses.noRating")}</p>}
                    <a href="#reviews" className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-brand-text hover:underline">
                      {t("businesses.reviews")} <span aria-hidden="true" className="rtl-flip ms-1">↓</span>
                    </a>
                  </div>
                ),
              },
            ]} />
          </div>

          {hasContact && (
            // One contact card: the phone row, then the business's own social profiles (only those it entered), then the other channels.
            <aside aria-label={t("businesses.contact")} className="h-fit rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1" data-testid="business-contact">
              <h2 className="sr-only">{t("businesses.contact")}</h2>
              {b.phone && (tel ? (
                <a href={`tel:${tel}`} className="group flex min-h-11 items-center gap-3 rounded-xl">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text transition group-hover:bg-brand group-hover:text-brand-ink"><FigmaIcon name="phone" className="size-5" /></span>
                  <span className="sr-only">{t("businesses.phone")}: </span>
                  <span className="min-w-0 truncate text-base font-bold text-ink group-hover:text-brand-text"><Ltr>{b.phone}</Ltr></span>
                </a>
              ) : (
                <p className="flex min-h-11 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text"><FigmaIcon name="phone" className="size-5" /></span>
                  <span className="sr-only">{t("businesses.phone")}</span>
                  <span className="min-w-0 truncate text-base font-bold"><Ltr>{b.phone}</Ltr></span>
                </p>
              ))}
              {social.length > 0 && (
                <div className={b.phone ? "mt-3.5 border-t border-line pt-3.5" : ""}>
                  <SocialLinks links={social} label={t("businesses.socialLabel")} ariaLabel={(platform) => t("businesses.socialAria", { name: name.text, platform })} />
                </div>
              )}
              {(whatsapp || b.email || website) && (
                <div className={`grid gap-2 ${b.phone || social.length > 0 ? "mt-3.5 border-t border-line pt-3.5" : ""}`}>
                  {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`${t("businesses.whatsapp")} – ${name.text}`} className={buttonClass("secondary", "w-full")} data-testid="whatsapp-button">{t("businesses.whatsapp")}</a>}
                  {b.email && <a href={`mailto:${b.email}`} title={t("businesses.sendEmail")} className={buttonClass("secondary", "w-full")}><span className="sr-only">{t("businesses.sendEmail")}: </span><span className="min-w-0 truncate"><Ltr>{b.email}</Ltr></span></a>}
                  {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("secondary", "w-full")}>{t("businesses.visitWebsite")}</a>}
                </div>
              )}
              <Link href={{ pathname: "/report", query: { url: pageUrl } }} rel="nofollow" className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-muted underline hover:text-ink">{t("report.reportThis")}</Link>
            </aside>
          )}

          <div className="min-w-0 space-y-8 pt-4 lg:col-start-1">

            <OfferList offers={offers} serverNow={new Date().toISOString()} timeZone={offerTimezone(b.locations[0]?.countryCode)} />

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
                            <span aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center bg-brand-soft"><FigmaIcon name="sparkles" className="size-8 text-brand-text" /></span>
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


            {showLocations && (
              <section aria-labelledby="locations-title" id="locations" className="scroll-mt-24">
                <h2 className="mb-3 text-xl font-bold" id="locations-title">{t("locations.title")}</h2>
                {mapPoints.length > 0 && <PlacesMap points={mapPoints} className="mb-4 h-64 sm:h-72" />}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {b.locations.map((loc) => {
                    const city = loc.city ? localize({ ...loc.city, name: loc.city.nameEn }, "name", l) : null;
                    // One location: address in the facts, hours in the Hours tab, so it needs no card here (the map stays).
                    if (b.locations.length === 1) return null;
                    // The main location's hours are shown once, in the Hours tab.
                    const hoursHere = loc.id !== mainHours?.id && hasHoursInfo(loc.openingHours);
                    return (
                      <div key={loc.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="font-bold">{loc.label || t("locations.singular")}</h3>
                          {loc.isPrimary && <Chip>{t("businesses.primary")}</Chip>}
                        </div>
                        <address className="text-sm not-italic text-muted">
                          <Ltr>{loc.addressLine1}</Ltr>{loc.addressLine2 && <>, <Ltr>{loc.addressLine2}</Ltr></>}<br />
                          {loc.postalCode && <><Ltr>{loc.postalCode}</Ltr>{" "}</>}{city && <Text value={city} pageLang={pageLang} />}
                        </address>
                        {hoursHere && <OpenState hours={loc.openingHours} countryCode={loc.countryCode} regionSlug={loc.city?.region?.slug} />}
                        {hoursHere && hoursDetail(loc)}
                        {b.locations.length > 1 && directionsUrl(loc.latitude, loc.longitude, placeAddress(loc)) && (
                          <a href={directionsUrl(loc.latitude, loc.longitude, placeAddress(loc))!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-brand-text hover:underline">
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

        </div>
      </div>
    </article>
  );
}
