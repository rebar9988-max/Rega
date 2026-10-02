import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fallbackChain, type Locale } from "@/config/locales";
import { searchTokens } from "@/lib/text";
import { PER_PAGE } from "@/lib/data/params";
import { pickTranslation } from "./pure";
import type { ContentSection } from "./config";

const names = { select: { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } } as const;
const catNames = { select: { id: true, slug: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } } as const;

export const entrySelect = {
  id: true, slug: true, sectionKey: true, status: true, verified: true, publishedAt: true, updatedAt: true, expiresAt: true, businessId: true,
  translations: { select: { locale: true, title: true, summary: true, body: true } },
  business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, verified: true } },
  city: { select: { id: true, slug: true, ...names.select, country: { select: { code: true } } } },
  category: catNames,
  job: true, event: true, guide: true,
} satisfies Prisma.ListingSelect;

export type Entry = Prisma.ListingGetPayload<{ select: typeof entrySelect }>;

/** Text of an entry in the visitor's language (with the fallback chain of the locale config). */
export function textOf(entry: Pick<Entry, "translations">, locale: Locale) {
  const picked = pickTranslation(entry.translations, locale, fallbackChain(locale));
  return picked ? { title: picked.value.title, summary: picked.value.summary, body: picked.value.body, locale: picked.value.locale as Locale, fallback: picked.fallback } : null;
}

export type PublicFilters = { q?: string; city?: string; category?: string; employmentType?: string; when?: "upcoming" | "past"; page: number };

export function publicWhere(section: ContentSection, f: Omit<PublicFilters, "page">, now = new Date()): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [];
  if (section === "jobs") and.push({ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] });
  if (section === "events") and.push({ event: f.when === "past" ? { OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }] } : { OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] } });
  if (section === "jobs" && f.employmentType) and.push({ job: { employmentType: f.employmentType } });
  for (const t of searchTokens(f.q)) and.push({ searchText: { contains: t } });
  return { sectionKey: section, status: "published", deletedAt: null, ...(f.city ? { cityId: f.city } : {}), ...(f.category ? { categoryId: f.category } : {}), ...(and.length ? { AND: and } : {}) };
}

const orderFor = (section: ContentSection, when?: "upcoming" | "past"): Prisma.ListingOrderByWithRelationInput[] =>
  section === "events" ? [{ event: { startsAt: when === "past" ? "desc" : "asc" } }] : [{ publishedAt: "desc" }, { createdAt: "desc" }];

export async function listPublished(section: ContentSection, filters: PublicFilters) {
  const where = publicWhere(section, filters);
  const [total, items] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({ where, orderBy: orderFor(section, filters.when), skip: (filters.page - 1) * PER_PAGE, take: PER_PAGE, select: entrySelect }),
  ]);
  return { total, items, page: filters.page, pages: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

/** One published entry by slug. Past events stay reachable (their page is still linked and indexed); expired jobs are hidden. */
export const getPublished = cache(async (section: ContentSection, slug: string) =>
  section === "events"
    ? prisma.listing.findFirst({ where: { sectionKey: section, slug, status: "published", deletedAt: null }, select: entrySelect })
    : prisma.listing.findFirst({ where: { ...publicWhere(section, {}), slug }, select: entrySelect }),
);

/** Categories of a section (admin-managed tree filtered by Category.sectionKey). */
export const sectionCategories = cache(async (section: ContentSection) =>
  prisma.category.findMany({ where: { sectionKey: section, isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }], select: catNames.select }),
);

/** Cities that can be chosen (active, admin-managed geography) with the number of published entries of the section. */
export const sectionCities = cache(async (section: ContentSection) => {
  const rows = await prisma.city.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, slug: true, ...names.select, _count: { select: { listings: { where: { sectionKey: section, status: "published", deletedAt: null } } } } } });
  return rows.map(({ _count, ...c }) => ({ ...c, count: _count.listings }));
});
