/**
 * Search index: builds the denormalized `searchText` columns of Business, Service and Location.
 *
 * A business is found by its names, description, tags, category, city and published services; a service by its own
 * texts plus category, provider and city; a location by its address, city and business. Everything goes through
 * `normalizeSearch`, the same function applied to queries, so Kurdish/Arabic/Persian keyboard variants match.
 *
 * Pure data access with an injected client (no `server-only`): used by server actions, API routes and the seed.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeSearch } from "./text";

type Db = PrismaClient | Prisma.TransactionClient;
type Named = Record<string, unknown>;

const NAME_KEYS = ["name", "nameCkb", "nameKmr", "nameDe", "nameEn", "nameAr", "nameFa", "nameTr"] as const;
const DESC_KEYS = ["description", "descriptionCkb", "descriptionKmr", "descriptionDe", "descriptionAr", "descriptionTr"] as const;
/** Long descriptions only need their opening to be findable; keeps the index rows small. */
const DESC_MAX = 600;
const TEXT_MAX = 6000;

function names(row: Named | null | undefined, extra: string[] = []): string[] {
  if (!row) return [];
  return [...NAME_KEYS, ...extra].map((k) => row[k]).filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}
function descriptions(row: Named): string[] {
  return DESC_KEYS.map((k) => row[k]).filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.slice(0, DESC_MAX));
}
/** One normalized, de-duplicated, bounded search string. */
export function composeSearchText(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const n = p ? normalizeSearch(p) : "";
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out.join(" ").slice(0, TEXT_MAX);
}

const categoryNames = { select: { nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } } as const;
const cityNames = { select: { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameTr: true } } as const;

/** Recomputes the search text of one business and of all its services and locations. Missing ids are ignored. */
export async function reindexBusinessTree(db: Db, businessId: string): Promise<void> {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true,
      description: true, descriptionCkb: true, descriptionKmr: true, descriptionDe: true, descriptionAr: true, descriptionTr: true,
      tags: true,
      category: categoryNames,
      services: {
        where: { deletedAt: null },
        select: {
          id: true, status: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true,
          description: true, descriptionCkb: true, descriptionDe: true, descriptionAr: true,
          category: categoryNames,
        },
      },
      locations: {
        where: { deletedAt: null },
        select: { id: true, status: true, label: true, addressLine1: true, addressLine2: true, postalCode: true, city: cityNames },
      },
    },
  });
  if (!b) return;
  const bizNames = names(b);
  const activeCities = b.locations.filter((l) => l.status === "active").flatMap((l) => names(l.city, ["nameEn"]));
  const publishedServices = b.services.filter((s) => s.status === "published");

  await db.business.update({
    where: { id: b.id },
    data: {
      searchText: composeSearchText([
        ...bizNames, ...b.tags, ...names(b.category), ...activeCities,
        ...publishedServices.flatMap((s) => [...names(s), ...names(s.category)]),
        ...descriptions(b),
      ]),
    },
  });
  for (const s of b.services) {
    await db.service.update({
      where: { id: s.id },
      data: { searchText: composeSearchText([...names(s), ...names(s.category), ...bizNames, ...names(b.category), ...activeCities, ...descriptions(s)]) },
    });
  }
  for (const l of b.locations) {
    await db.location.update({
      where: { id: l.id },
      data: { searchText: composeSearchText([l.label, l.addressLine1, l.addressLine2, l.postalCode, ...names(l.city, ["nameEn"]), ...bizNames]) },
    });
  }
}

/** Businesses whose index mentions a category (own category or a service in it). Bounded. */
export async function businessesInCategory(db: Db, categoryId: string, take = 2000): Promise<string[]> {
  const rows = await db.business.findMany({
    where: { deletedAt: null, OR: [{ categoryId }, { services: { some: { categoryId, deletedAt: null } } }] },
    select: { id: true },
    take,
  });
  return rows.map((r) => r.id);
}

/** Rebuilds every business tree, in id order and small batches. Idempotent; used by the seed after upgrades. */
export async function reindexAll(db: Db, batch = 100): Promise<number> {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const rows = await db.business.findMany({
      where: { deletedAt: null }, orderBy: { id: "asc" }, take: batch, select: { id: true },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const r of rows) await reindexBusinessTree(db, r.id);
    count += rows.length;
    cursor = rows[rows.length - 1].id;
  }
  return count;
}
