/**
 * Admin write-side for businesses: one place that creates/updates a business together with its primary location,
 * resolves city and country, and decides whether it may be published. Server-only; callers check permissions.
 */
import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/api";
import { geocodeCity } from "@/lib/geocoder";
import { isValidCoordinate, publishReadiness } from "@/lib/coordinates";
import { WEEK, parseOpeningHours, type OpeningHours } from "@/lib/opening-hours";
import { reindexBusinessTree } from "@/lib/search-index";
import { LOCALES } from "@/config/locales";

/** ISO 3166-1 alpha-2 codes offered in the form (plus any country already in the database). */
export const FORM_COUNTRIES = ["DE", "AT", "CH", "NL", "BE", "LU", "FR", "GB", "IE", "DK", "SE", "NO", "FI", "IT", "ES", "PL", "CZ", "IQ", "TR", "IR", "SY", "US", "CA", "AU"] as const;

const httpsUrl = z.union([z.literal(""), z.string().trim().max(500).url().refine((u) => u.startsWith("https://"))]).optional().transform((v) => v || undefined);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const coordinate = (min: number, max: number) => z.union([z.literal(""), z.coerce.number().min(min).max(max)]).optional().transform((v) => (v === "" || v === undefined ? undefined : v));

export const businessFormSchema = z.object({
  id: optionalText(64),
  name: z.string().trim().min(2).max(200),
  nameCkb: optionalText(200),
  categoryId: z.string().trim().min(1).max(64),
  description: optionalText(8000),
  descriptionCkb: optionalText(8000),
  // Other languages: legacy columns for kmr/de/ar/tr, BusinessTranslation rows for en/fa (and any language added later).
  descriptionKmr: optionalText(8000),
  descriptionDe: optionalText(8000),
  descriptionAr: optionalText(8000),
  descriptionTr: optionalText(8000),
  descriptionEn: optionalText(8000),
  descriptionFa: optionalText(8000),
  /** Languages spoken at the business. */
  languages: z.array(z.enum(LOCALES)).max(LOCALES.length).default([]),
  phone: optionalText(50),
  email: z.union([z.literal(""), z.string().trim().email().max(200)]).optional().transform((v) => v || undefined),
  website: z.union([z.literal(""), z.string().trim().url().max(300).refine((u) => /^https?:\/\//i.test(u))]).optional().transform((v) => v || undefined),
  addressLine1: z.string().trim().min(3).max(300),
  postalCode: optionalText(20),
  city: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  coordsSource: z.enum(["geocoded", "manual", ""]).optional(),
  coordsConfirmed: z.enum(["1"]).optional(),
  // Logo / cover: an https image URL (the upload control fills in REGA's media URL), or empty to remove.
  logoUrl: httpsUrl,
  coverUrl: httpsUrl,
  ...Object.fromEntries(WEEK.map((d) => [`hours_${d}`, z.string().trim().max(120).optional()])) as Record<`hours_${(typeof WEEK)[number]}`, z.ZodOptional<z.ZodString>>,
  intent: z.enum(["save", "publish", "submit"]).default("save"),
}).superRefine((v, ctx) => {
  const hasLat = v.latitude !== undefined;
  const hasLng = v.longitude !== undefined;
  if (hasLat !== hasLng) ctx.addIssue({ code: "custom", path: ["latitude"], message: "both" });
  if (hasLat && hasLng && !isValidCoordinate(v.latitude, v.longitude)) ctx.addIssue({ code: "custom", path: ["latitude"], message: "invalid" });
  const hours = parseOpeningHours(Object.fromEntries(WEEK.map((d) => [d, v[`hours_${d}`] ?? ""])));
  if (!hours.ok) for (const d of hours.invalid) ctx.addIssue({ code: "custom", path: [`hours_${d}`], message: "invalid" });
});

/** Opening hours from the validated form (null = none entered = unknown). */
export function formHours(input: BusinessForm): OpeningHours | null {
  const parsed = parseOpeningHours(Object.fromEntries(WEEK.map((d) => [d, input[`hours_${d}`] ?? ""])));
  return parsed.ok ? parsed.value : null;
}
export type BusinessForm = z.infer<typeof businessFormSchema>;

/** Country row for a code, created from the ISO code and the runtime's standard display names when missing. */
async function ensureCountry(tx: Prisma.TransactionClient, code: string) {
  const existing = await tx.country.findUnique({ where: { code } });
  if (existing) return existing;
  const name = (locale: string) => { try { return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? undefined; } catch { return undefined; } };
  return tx.country.create({ data: { code, nameEn: name("en") ?? code, nameDe: name("de"), nameAr: name("ar"), nameTr: name("tr") } });
}

/** Existing city by any of its names (case-insensitive), else a new city in that country. */
async function resolveCity(tx: Prisma.TransactionClient, countryId: string, typed: string, allowCreate: boolean) {
  const name = typed.trim();
  const match = await tx.city.findFirst({
    where: { countryId, OR: (["nameEn", "nameCkb", "nameKmr", "nameDe", "nameAr", "nameTr"] as const).map((k) => ({ [k]: { equals: name, mode: "insensitive" } })) },
  });
  if (match) return { city: match, created: false };
  // Owners choose from the geography the team maintains; only staff add new places (otherwise anyone could litter the city list).
  if (!allowCreate) throw new CityUnknown();
  return { city: await tx.city.create({ data: { countryId, nameEn: name } }), created: true };
}

export type SaveResult =
  | { ok: true; id: string; slug: string; published: boolean; submitted: boolean; submittedNow: boolean; missing: string[] }
  | { ok: false; error: "not_found" | "published_incomplete" | "city_unknown" };

class PublishedIncomplete extends Error {}
class CityUnknown extends Error {}

/** What the acting user may do beyond editing: staff publish and add cities, owners only submit for review. */
export type SavePerms = { canPublish: boolean; canCreateCity: boolean };

/**
 * Creates or updates a business and its primary location in one transaction. Coordinates that change without an
 * explicit confirmation lose their verification, so a moved marker must be confirmed again before publishing.
 * With intent "publish" the business is published only when every publish requirement is met.
 */
export async function saveBusiness(input: BusinessForm, actor: { id: string }, perms: SavePerms): Promise<SaveResult> {
  try {
    return await save(input, actor, perms);
  } catch (error) {
    if (error instanceof PublishedIncomplete) return { ok: false, error: "published_incomplete" };
    if (error instanceof CityUnknown) return { ok: false, error: "city_unknown" };
    throw error;
  }
}

async function save(input: BusinessForm, actor: { id: string }, { canPublish, canCreateCity }: SavePerms): Promise<SaveResult> {
  const result = await prisma.$transaction(async (tx) => {
    const country = await ensureCountry(tx, input.countryCode);
    const { city, created: cityCreated } = await resolveCity(tx, country.id, input.city, canCreateCity);

    const before = input.id
      ? await tx.business.findFirst({ where: { id: input.id, deletedAt: null }, include: { locations: { where: { isPrimary: true, deletedAt: null }, take: 1 } } })
      : null;
    if (input.id && !before) return { ok: false as const, error: "not_found" as const };

    const businessData = {
      name: input.name, nameCkb: input.nameCkb ?? null, categoryId: input.categoryId,
      description: input.description ?? null, descriptionCkb: input.descriptionCkb ?? null, descriptionKmr: input.descriptionKmr ?? null,
      descriptionDe: input.descriptionDe ?? null, descriptionAr: input.descriptionAr ?? null, descriptionTr: input.descriptionTr ?? null,
      languages: input.languages,
      phone: input.phone ?? null, email: input.email ?? null, website: input.website ?? null,
      logoUrl: input.logoUrl ?? null, coverUrl: input.coverUrl ?? null,
    };
    let business;
    if (before) {
      business = await tx.business.update({ where: { id: before.id }, data: businessData });
    } else {
      let slug = slugify(input.name) || "business";
      // /businesses/<slug> is a category URL when a category has that slug, so a business never takes a category's slug.
      const taken = (await tx.business.findUnique({ where: { slug }, select: { id: true } })) || (await tx.category.findUnique({ where: { slug }, select: { id: true } }));
      if (taken) slug = `${slug}-${Date.now().toString(36)}`;
      business = await tx.business.create({ data: { ...businessData, slug, status: "draft", createdById: actor.id } });
    }

    // Languages without a column of their own (en, fa) live in BusinessTranslation rows.
    for (const [locale, description] of [["en", input.descriptionEn], ["fa", input.descriptionFa]] as const) {
      if (description) await tx.businessTranslation.upsert({ where: { businessId_locale: { businessId: business.id, locale } }, update: { description }, create: { businessId: business.id, locale, description } });
      else await tx.businessTranslation.deleteMany({ where: { businessId: business.id, locale } });
    }

    const prev = before?.locations[0] ?? null;
    const hasCoords = input.latitude !== undefined && input.longitude !== undefined;
    const moved = !prev || prev.latitude !== (input.latitude ?? null) || prev.longitude !== (input.longitude ?? null);
    const verifiedAt = !hasCoords ? null : input.coordsConfirmed === "1" ? (moved || !prev?.coordsVerifiedAt ? new Date() : prev.coordsVerifiedAt) : moved ? null : prev?.coordsVerifiedAt ?? null;
    const locationData = {
      addressLine1: input.addressLine1, postalCode: input.postalCode ?? null, countryCode: input.countryCode, cityId: city.id,
      latitude: hasCoords ? input.latitude! : null, longitude: hasCoords ? input.longitude! : null,
      coordsSource: hasCoords ? (input.coordsSource || prev?.coordsSource || "manual") : null,
      coordsVerifiedAt: verifiedAt,
      openingHours: (formHours(input) as Prisma.InputJsonObject | null) ?? Prisma.DbNull,
    };
    const location = prev
      ? await tx.location.update({ where: { id: prev.id }, data: locationData })
      : await tx.location.create({ data: { ...locationData, businessId: business.id, isPrimary: true, status: "active" } });

    const readiness = publishReadiness({ name: business.name, categoryId: business.categoryId, primary: location });
    // A live business must stay complete: an edit that would leave it without a confirmed location is rolled back.
    if (business.status === "published" && !readiness.ok) throw new PublishedIncomplete();
    let published = business.status === "published";
    let submitted = business.status === "pending";
    let submittedNow = false;
    if (input.intent === "publish" && canPublish && readiness.ok && !published) {
      await tx.business.update({ where: { id: business.id }, data: { status: "published", publishedAt: new Date(), archivedAt: null } });
      published = true;
    }
    // Owners cannot publish: a complete draft is submitted for moderation (draft -> pending).
    if (input.intent === "submit" && !canPublish && readiness.ok && business.status === "draft") {
      await tx.business.update({ where: { id: business.id }, data: { status: "pending" } });
      submitted = true;
      submittedNow = true;
    }
    return { ok: true as const, id: business.id, slug: business.slug, published, submitted, submittedNow, missing: readiness.missing, cityId: cityCreated ? city.id : null };
  });

  if (!result.ok) return result;
  await reindexBusinessTree(prisma, result.id);
  // A newly created city gets its public centre coordinates (for the Nearby city picker) outside the transaction.
  if (result.cityId) {
    const centre = await geocodeCity(input.city, input.countryCode).catch(() => null);
    if (centre) await prisma.city.update({ where: { id: result.cityId }, data: { latitude: centre.lat, longitude: centre.lng } });
  }
  return { ok: true, id: result.id, slug: result.slug, published: result.published, submitted: result.submitted, submittedNow: result.submittedNow, missing: result.missing };
}

/** Publish requirements for an existing business (used by every publish path: form, list, API, bulk). */
export async function readinessFor(businessId: string) {
  const b = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
    select: { name: true, categoryId: true, locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { addressLine1: true, cityId: true, countryCode: true, latitude: true, longitude: true, coordsVerifiedAt: true } } },
  });
  if (!b) return { ok: false, missing: ["name"] as string[] };
  return publishReadiness({ name: b.name, categoryId: b.categoryId, primary: b.locations[0] ?? null });
}

/** Location health of all (non-deleted) businesses, for the dashboard audit. Counts only; nothing is changed. */
export async function locationAudit() {
  const primary = { isPrimary: true, deletedAt: null } as const;
  const inRange: Prisma.LocationWhereInput = {
    latitude: { gte: -90, lte: 90 }, longitude: { gte: -180, lte: 180 }, NOT: { AND: [{ latitude: 0 }, { longitude: 0 }] },
  };
  const live = { deletedAt: null } as const;
  const [published, unpublished, missing, invalid, unverified] = await Promise.all([
    prisma.business.count({ where: { ...live, status: "published" } }),
    prisma.business.count({ where: { ...live, status: { not: "published" } } }),
    prisma.business.count({ where: { ...live, NOT: { locations: { some: { ...primary, latitude: { not: null }, longitude: { not: null } } } } } }),
    prisma.business.count({ where: { ...live, locations: { some: { ...primary, latitude: { not: null }, longitude: { not: null }, NOT: inRange } } } }),
    prisma.business.count({ where: { ...live, locations: { some: { ...primary, ...inRange, coordsVerifiedAt: null } } } }),
  ]);
  return { published, unpublished, missing, invalid, unverified };
}
