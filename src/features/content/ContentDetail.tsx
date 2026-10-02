import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatDate, type Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import { localizedUrl, pageMetadata } from "@/lib/seo";
import { descriptionFrom } from "@/lib/seo-server";
import { safeHttpUrl } from "@/lib/urls";
import { PageSchema } from "@/components/ui/PageSchema";
import { JsonLd } from "@/components/ui/JsonLd";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { VerifiedBadge } from "@/components/ui/Badge";
import { Ltr } from "@/components/ui/Bidi";
import { buttonClass } from "@/components/ui/Button";
import { CONTENT, type ContentSection } from "./config";
import { getPublished, textOf } from "./queries";
import { isLive, listingJsonLd, wallClock } from "./pure";
import { formatWhen } from "./EntryCard";

const KIND_KEY = { jobs: "kindJobs", events: "kindEvents", guides: "kindGuides" } as const;

export async function entryMetadata(section: ContentSection, locale: Locale, slug: string): Promise<Metadata> {
  const e = await getPublished(section, slug);
  if (!e) return {};
  const text = textOf(e, locale);
  if (!text) return {};
  const t = await getTranslations({ locale, namespace: "content" });
  const description = await descriptionFrom(locale, text.summary ?? text.body, "entryFallback", { title: text.title, kind: t(KIND_KEY[section]) });
  return pageMetadata({ locale, path: `/${section}/${slug}`, title: text.title, description, ogType: section === "guides" ? "article" : "website" });
}

/** Detail page of an entry: facts that are stored (employer, place, dates, apply link), the text in the visitor's language, structured data, report link. */
export async function ContentDetail({ section, locale, slug }: { section: ContentSection; locale: Locale; slug: string }) {
  const entry = await getPublished(section, slug);
  if (!entry || !isLive({ status: entry.status, expiresAt: entry.expiresAt }, section)) notFound();
  const text = textOf(entry, locale);
  if (!text) notFound();
  const t = await getTranslations();
  const config = CONTENT[section];
  const title = t(`nav.${section}`);
  const other = text.fallback ? LOCALE_META[text.locale] : null;
  const city = entry.city ? localizeText({ ...entry.city, name: entry.city.nameEn }, "name", locale) : null;
  const businessName = entry.business ? localizeText(entry.business, "name", locale) : null;
  const url = localizedUrl(locale, `/${section}/${slug}`);
  const applyUrl = safeHttpUrl(entry.job?.applyUrl);
  const infoUrl = safeHttpUrl(entry.event?.infoUrl);
  const paragraphs = (text.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const jsonLd = listingJsonLd({
    section, url, title: text.title, description: text.summary ?? undefined, inLanguage: LOCALE_META[text.locale].htmlLang,
    datePublished: entry.publishedAt, dateModified: entry.updatedAt,
    business: config.showsBusiness && entry.business && businessName ? { name: businessName, url: localizedUrl(locale, `/business/${entry.business.slug}`) } : null,
    city, countryCode: entry.city?.country.code,
    job: entry.job ? { employmentType: entry.job.employmentType, expiresAt: entry.expiresAt, applyUrl } : null,
    event: entry.event ? { startsAt: entry.event.startsAt, endsAt: entry.event.endsAt, venue: entry.event.venue, infoUrl } : null,
  });

  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5"><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageSchema name={text.title} path={`/${section}/${slug}`} crumbs={[{ name: title, path: `/${section}` }, { name: text.title, path: `/${section}/${slug}` }]} />
      <article className="container-page max-w-3xl py-10">
        <Breadcrumbs items={[{ label: t("nav.home"), href: "/" }, { label: title, href: `/${section}` }, { label: <bdi>{text.title}</bdi> }]} />
        <header>
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-brand">
            {t(`content.${KIND_KEY[section]}`)}
            {entry.verified && <VerifiedBadge />}
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl"><bdi lang={other?.htmlLang} dir={other?.dir}>{text.title}</bdi></h1>
          <span aria-hidden="true" className="mt-3 block h-1 w-12 rounded-full bg-brand" />
          {text.summary && <p className="mt-4 text-lg text-muted"><bdi lang={other?.htmlLang} dir={other?.dir}>{text.summary}</bdi></p>}
        </header>

        <dl className="mt-6 grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
          {entry.business && businessName && config.showsBusiness && fact(t(section === "jobs" ? "content.employer" : "content.organizer"), <Link href={`/business/${entry.business.slug}`} className="text-brand hover:underline"><bdi>{businessName}</bdi></Link>)}
          {(city || entry.event?.venue) && fact(t("content.where"), <bdi>{[entry.event?.venue, city].filter(Boolean).join(", ")}</bdi>)}
          {entry.job && fact(t("content.employmentType"), t(`content.type_${entry.job.employmentType}` as never))}
          {entry.job && entry.job.languages.length > 0 && fact(t("content.languagesRequired"), entry.job.languages.map((l) => LOCALE_META[l as Locale]?.nativeName ?? l).join(", "))}
          {entry.expiresAt && fact(t("content.labelCloses"), <time dateTime={entry.expiresAt.toISOString().slice(0, 10)}>{formatDate(entry.expiresAt, locale, { timeZone: "UTC" })}</time>)}
          {entry.event && fact(t("content.labelStarts"), <time dateTime={wallClock(entry.event.startsAt)}>{formatWhen(entry.event.startsAt, locale)}</time>)}
          {entry.event?.endsAt && fact(t("content.labelEnds"), <time dateTime={wallClock(entry.event.endsAt)}>{formatWhen(entry.event.endsAt, locale)}</time>)}
          {entry.guide?.readMinutes && fact(t("content.labelReading"), t("content.readTime", { count: entry.guide.readMinutes }))}
        </dl>

        {paragraphs.length > 0 && (
          <div className="mt-8 space-y-4 leading-relaxed" lang={other?.htmlLang} dir={other?.dir}>
            {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
        )}

        {(applyUrl || entry.job?.applyEmail || infoUrl) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {applyUrl && <a href={applyUrl} target="_blank" rel="nofollow noopener noreferrer ugc" className={buttonClass("primary")} data-testid="apply-link">{t("content.apply")}</a>}
            {entry.job?.applyEmail && <a href={`mailto:${entry.job.applyEmail}`} rel="nofollow" className={buttonClass(applyUrl ? "secondary" : "primary")} data-testid="apply-email"><Ltr>{entry.job.applyEmail}</Ltr></a>}
            {infoUrl && <a href={infoUrl} target="_blank" rel="nofollow noopener noreferrer ugc" className={buttonClass("secondary")}>{t("content.moreInfo")}</a>}
          </div>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
          {entry.publishedAt && <span>{t("content.postedOn", { date: formatDate(entry.publishedAt, locale, { timeZone: "UTC" }) })}</span>}
          <Link href={{ pathname: "/report", query: { url } }} rel="nofollow" className="inline-flex min-h-9 items-center font-semibold underline hover:text-ink">{t("report.reportThis")}</Link>
        </footer>
      </article>
    </>
  );
}
