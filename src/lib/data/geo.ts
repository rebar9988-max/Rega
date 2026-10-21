/**
 * Read-only geography for the location selector (Country -> Region -> City). Server-only.
 * Everything comes from the existing Country, Region and City tables; nothing is invented. Every query is bounded,
 * because the public selector must never ship the full ~2,000-city gazetteer to the browser (Worker CPU, error 1102).
 * There is no district table, so there is no district level: it appears only if real data for it exists.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { boundingBox } from "@/lib/geo";
import { NEAREST_CITY_MAX_KM, nearestCity, queryVariants, rankByQuery } from "@/lib/location-pref";
import { PUBLIC_BUSINESS } from "@/lib/search-where";
import { DEFAULT_PUBLIC_COUNTRY_CODE, listSelectorCities } from "./index";

export const GEO_CITY_LIMIT = 40;
/** Rows read from the database for one text search before ranking; keeps the query small and the ranking meaningful. */
const SEARCH_CANDIDATES = 100;

type Names = {
  nameEn: string;
  nameCkb: string | null;
  nameKmr: string | null;
  nameDe: string | null;
  nameFa: string | null;
  nameAr: string | null;
  nameTr: string | null;
};

export type GeoCountry = Names & { code: string };
export type GeoRegion = Names & { id: string; slug: string };
export type GeoCity = Names & {
  id: string;
  slug: string | null;
  regionId: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  /** Public listings in this city (0 is shown honestly; cities stay selectable). */
  count: number;
};

const nameColumns = { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameFa: true, nameAr: true, nameTr: true } as const;

const citySelect = {
  id: true,
  slug: true,
  regionId: true,
  ...nameColumns,
  latitude: true,
  longitude: true,
  country: { select: { code: true } },
} satisfies Prisma.CitySelect;

type CityRow = Prisma.CityGetPayload<{ select: typeof citySelect }>;

const noNames = { nameCkb: null, nameKmr: null, nameDe: null, nameFa: null, nameAr: null, nameTr: null } as const;
const cityNames = (c: Names) => [c.nameEn, c.nameCkb, c.nameKmr, c.nameDe, c.nameFa, c.nameAr, c.nameTr];

const publicLocation = { status: "active", deletedAt: null, business: PUBLIC_BUSINESS } satisfies Prisma.LocationWhereInput;

/** Public listing counts for these cities in one grouped query. */
async function countsFor(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.location.groupBy({ by: ["cityId", "businessId"], where: { ...publicLocation, cityId: { in: ids } }, _count: { _all: true } });
  const counts = new Map<string, number>();
  for (const row of rows) if (row.cityId) counts.set(row.cityId, (counts.get(row.cityId) ?? 0) + 1);
  return counts;
}

async function toCities(rows: CityRow[]): Promise<GeoCity[]> {
  const counts = await countsFor(rows.map((r) => r.id));
  return rows.map(({ country, ...city }) => ({ ...city, countryCode: country.code, count: counts.get(city.id) ?? 0 }));
}

/** The public market's country first, then any other active country that already has a public listing. */
export async function geoCountries(selectedCountryCode?: string): Promise<GeoCountry[]> {
  const rows = await prisma.country.findMany({
    where: {
      isActive: true,
      OR: [{ code: DEFAULT_PUBLIC_COUNTRY_CODE }, { code: selectedCountryCode ?? DEFAULT_PUBLIC_COUNTRY_CODE }, { cities: { some: { isActive: true, locations: { some: publicLocation } } } }],
    },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    take: 30,
    select: { code: true, ...nameColumns },
  });
  return [...rows].sort((a, b) => Number(b.code === DEFAULT_PUBLIC_COUNTRY_CODE) - Number(a.code === DEFAULT_PUBLIC_COUNTRY_CODE));
}

const TRANSLATION_COLUMN: Record<string, keyof typeof noNames> = { ckb: "nameCkb", kmr: "nameKmr", de: "nameDe", fa: "nameFa", ar: "nameAr", tr: "nameTr" };

/** Regions of a country that actually contain cities. Empty when the data has no regions for the country. */
export async function geoRegions(countryCode: string): Promise<GeoRegion[]> {
  const rows = await prisma.region.findMany({
    where: { isActive: true, country: { code: countryCode, isActive: true }, cities: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    take: 100,
    select: { id: true, slug: true, nameEn: true, translations: { select: { locale: true, name: true } } },
  });
  return rows.map(({ translations, ...region }) => {
    const names: Record<string, string | null> = { ...noNames };
    for (const t of translations) {
      const column = TRANSLATION_COLUMN[t.locale];
      if (column && t.name.trim()) names[column] = t.name.trim();
    }
    return { ...region, ...(names as Omit<Names, "nameEn">) };
  });
}

/** The most useful cities first (listings, then the curated set), or one region alphabetically, or a text search. */
export async function geoCities(opts: { countryCode: string; regionId?: string; q?: string; limit?: number }): Promise<{ cities: GeoCity[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? GEO_CITY_LIMIT, 1), 50);
  const inCountry = { isActive: true, country: { code: opts.countryCode, isActive: true } } satisfies Prisma.CityWhereInput;
  const q = opts.q?.trim();

  if (q) {
    const variants = queryVariants(q);
    const text = (v: string) => ({ contains: v, mode: "insensitive" as const });
    const or: Prisma.CityWhereInput[] = variants.flatMap((v) => [
      { nameEn: text(v) }, { nameCkb: text(v) }, { nameKmr: text(v) }, { nameDe: text(v) }, { nameFa: text(v) }, { nameAr: text(v) }, { nameTr: text(v) },
      { slug: text(v) },
      { translations: { some: { name: text(v) } } },
    ]);
    const rows = await prisma.city.findMany({ where: { ...inCountry, OR: or }, orderBy: { nameEn: "asc" }, take: SEARCH_CANDIDATES, select: citySelect });
    // Names that start with the text first; a city found only through a stored translation keeps its place after them.
    const preferred = rankByQuery(rows, q, (c) => [...cityNames(c), c.slug], SEARCH_CANDIDATES);
    const seen = new Set(preferred.map((c) => c.id));
    // Among the name matches, cities with public listings come first (stable: equal counts stay alphabetical).
    const counts = await countsFor(rows.map((c) => c.id));
    const byListings = [...preferred].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    const ranked = [...byListings, ...rows.filter((c) => !seen.has(c.id))];
    return { cities: await toCities(ranked.slice(0, limit)), hasMore: ranked.length > limit || rows.length >= SEARCH_CANDIDATES };
  }

  if (opts.regionId) {
    const rows = await prisma.city.findMany({ where: { ...inCountry, regionId: opts.regionId }, orderBy: { nameEn: "asc" }, take: limit + 1, select: citySelect });
    return { cities: await toCities(rows.slice(0, limit)), hasMore: rows.length > limit };
  }

  // Default view: the same bounded, ranked set the page already offers (listings first, then the curated cities).
  const ranked = await listSelectorCities({ countryCode: opts.countryCode });
  const ids = ranked.slice(0, limit).map((c) => c.id);
  const [rows, total] = await Promise.all([
    prisma.city.findMany({ where: { ...inCountry, id: { in: ids } }, select: citySelect }),
    prisma.city.count({ where: inCountry }),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  return { cities: await toCities(ordered), hasMore: total > ordered.length };
}

/** One active city by id (used to label a saved or shared choice). */
export async function geoCityById(id: string): Promise<GeoCity | null> {
  const row = await prisma.city.findFirst({ where: { id, isActive: true, country: { isActive: true } }, select: citySelect });
  return row ? (await toCities([row]))[0] : null;
}

/** The known city nearest to a position, within NEAREST_CITY_MAX_KM. Coordinates are used for this lookup only. */
export async function geoNearestCity(point: { lat: number; lng: number }): Promise<{ city: GeoCity; km: number } | null> {
  const box = boundingBox(point, NEAREST_CITY_MAX_KM);
  const rows = await prisma.city.findMany({
    where: {
      isActive: true,
      country: { isActive: true },
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    },
    take: 300,
    select: citySelect,
  });
  const found = nearestCity(point, rows);
  if (!found) return null;
  return { city: (await toCities([found.city]))[0], km: Math.round(found.km * 10) / 10 };
}
