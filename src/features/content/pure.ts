/** Pure helpers of the content sections (unit-tested): validation, slugs, visibility rules and schema.org builders. */
import { z } from "zod";
import { LOCALES, localeSuffix, type Locale } from "@/config/locales";
import { EMPLOYMENT_TYPES, type ContentSection } from "./config";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optionalUrl = z.union([z.literal(""), z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u))]).optional().transform((v) => v || undefined);
const optionalDate = z.union([z.literal(""), z.string().trim()]).optional().transform((v) => (v ? new Date(v) : undefined)).refine((d) => d === undefined || !Number.isNaN(d.getTime()), "date");
/** "Shown until <day>": a date-only value lasts through the end of that day (all times are wall-clock times stored as UTC). */
const optionalLastDay = z.union([z.literal(""), z.string().trim()]).optional().transform((v) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59Z` : v) : undefined)).refine((d) => d === undefined || !Number.isNaN(d.getTime()), "date");

/** Per-language texts come from fields title<Suffix>, summary<Suffix>, body<Suffix> (Suffix = locale code capitalised). */
export function readTranslations(raw: Record<string, unknown>): { locale: Locale; title: string; summary?: string; body?: string }[] {
  const text = (k: string, max: number) => String(raw[k] ?? "").trim().slice(0, max);
  return LOCALES.flatMap((l) => {
    const s = localeSuffix(l);
    const title = text(`title${s}`, 200);
    if (!title) return [];
    return [{ locale: l, title, summary: text(`summary${s}`, 400) || undefined, body: text(`body${s}`, 20_000) || undefined }];
  });
}

export const baseSchema = z.object({
  id: optional(64),
  businessId: optional(64),
  cityId: optional(64),
  categoryId: optional(64),
  intent: z.enum(["save", "publish", "submit"]).default("save"),
});

const jobSchema = baseSchema.extend({
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  applyUrl: optionalUrl,
  applyEmail: z.union([z.literal(""), z.string().trim().email().max(200)]).optional().transform((v) => v || undefined),
  expiresAt: optionalLastDay,
  languages: z.array(z.enum(LOCALES)).max(LOCALES.length).default([]),
}).refine((v) => v.applyUrl || v.applyEmail, { path: ["applyEmail"], message: "apply" });

const eventSchema = baseSchema.extend({
  startsAt: z.string().trim().min(1).transform((v) => new Date(v)).refine((d) => !Number.isNaN(d.getTime()), "date"),
  endsAt: optionalDate,
  venue: optional(200),
  infoUrl: optionalUrl,
}).refine((v) => !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "order" });

const guideSchema = baseSchema.extend({ readMinutes: z.coerce.number().int().min(1).max(240).optional().or(z.literal("").transform(() => undefined)) });

export const SCHEMAS = { jobs: jobSchema, events: eventSchema, guides: guideSchema } as const;

/** Needs at least one translation with a title; the body is required for guides. */
export function translationsOk(section: ContentSection, tr: { title: string; body?: string }[]): boolean {
  return tr.length > 0 && (section !== "guides" || tr.every((t) => Boolean(t.body)));
}

/** URL slug from the first title (German, else English, else any), unique-suffixed by the caller when taken. */
export function listingSlugBase(titles: Partial<Record<string, string>>): string {
  const t = titles.de ?? titles.en ?? Object.values(titles).find(Boolean) ?? "";
  const base = t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60).replace(/^-|-$/g, "");
  return base || "entry";
}

/** Visibility on public pages. `now` is injectable for tests. */
export function isLive(e: { status: string; expiresAt?: Date | null; endsAt?: Date | null; startsAt?: Date | null }, section: ContentSection, now = new Date()): boolean {
  if (e.status !== "published") return false;
  if (section === "jobs") return !e.expiresAt || e.expiresAt >= now;
  return true;
}

export const isUpcoming = (event: { startsAt: Date; endsAt?: Date | null }, now = new Date()) => (event.endsAt ?? event.startsAt) >= now;

/** Event times are stored as the wall-clock time at the venue (typed in the form, kept as UTC): ISO without an offset, as schema.org allows. */
export const wallClock = (d: Date) => d.toISOString().slice(0, 16);

/** schema.org structured data of a detail page. Only facts that are stored; no invented fields. */
export function listingJsonLd(args: {
  section: ContentSection;
  url: string;
  title: string;
  description?: string;
  inLanguage: string;
  datePublished?: Date | null;
  dateModified?: Date | null;
  business?: { name: string; url?: string } | null;
  city?: string | null;
  countryCode?: string | null;
  job?: { employmentType: string; expiresAt?: Date | null; applyUrl?: string | null } | null;
  event?: { startsAt: Date; endsAt?: Date | null; venue?: string | null; infoUrl?: string | null } | null;
}) {
  const org = args.business ? { "@type": "Organization", name: args.business.name, ...(args.business.url ? { url: args.business.url } : {}) } : undefined;
  const place = args.city ? { "@type": "Place", ...(args.event?.venue ? { name: args.event.venue } : {}), address: { "@type": "PostalAddress", addressLocality: args.city, ...(args.countryCode ? { addressCountry: args.countryCode } : {}) } } : undefined;
  const common = { "@context": "https://schema.org", url: args.url, inLanguage: args.inLanguage, ...(args.description ? { description: args.description } : {}) };
  if (args.section === "jobs") {
    const type = ({ full_time: "FULL_TIME", part_time: "PART_TIME", mini_job: "PART_TIME", apprenticeship: "OTHER", internship: "INTERN", freelance: "CONTRACTOR" } as Record<string, string>)[args.job?.employmentType ?? "full_time"];
    return { ...common, "@type": "JobPosting", title: args.title, ...(args.datePublished ? { datePosted: args.datePublished.toISOString() } : {}), ...(args.job?.expiresAt ? { validThrough: args.job.expiresAt.toISOString() } : {}), employmentType: type, ...(org ? { hiringOrganization: org } : {}), ...(place ? { jobLocation: place } : {}) };
  }
  if (args.section === "events") {
    return { ...common, "@type": "Event", name: args.title, ...(args.event ? { startDate: wallClock(args.event.startsAt), ...(args.event.endsAt ? { endDate: wallClock(args.event.endsAt) } : {}) } : {}), ...(place ? { location: place } : {}), ...(org ? { organizer: org } : {}) };
  }
  return { ...common, "@type": "Article", headline: args.title, ...(args.datePublished ? { datePublished: args.datePublished.toISOString() } : {}), ...(args.dateModified ? { dateModified: args.dateModified.toISOString() } : {}) };
}

/** Picks the text of an entry for a locale: its own translation, else the first language of the fallback chain that has one. */
export function pickTranslation<T extends { locale: string }>(translations: T[], locale: Locale, chain: readonly Locale[]): { value: T; fallback: boolean } | null {
  const own = translations.find((t) => t.locale === locale);
  if (own) return { value: own, fallback: false };
  for (const l of chain) {
    const t = translations.find((x) => x.locale === l);
    if (t) return { value: t, fallback: true };
  }
  return translations[0] ? { value: translations[0], fallback: true } : null;
}
