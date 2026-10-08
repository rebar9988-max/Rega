/**
 * Read-side data access for the public site. Server-only.
 * Every query is bounded (pagination), published-only, and selects just the columns the UI renders.
 */
import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PUBLIC_BUSINESS, businessInCategories, businessInCity, textWhere } from "@/lib/search-where";
import { searchTokens } from "@/lib/text";
import { PER_PAGE } from "./params";
import { descendantIds } from "@/lib/category-tree";
import { MAJOR_CITY_SLUGS, rankSelectorCities } from "@/lib/selector-cities";
const skipTake = (page: number) => ({ skip: (page - 1) * PER_PAGE, take: PER_PAGE });
const pageCount = (total: number) => Math.max(1, Math.ceil(total / PER_PAGE));

const cityInclude = { select: { id: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameTr: true } } as const;

const businessCard = {
  id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true,
  description: true, descriptionCkb: true, descriptionKmr: true, descriptionDe: true, descriptionAr: true, descriptionTr: true,
  logoUrl: true, coverUrl: true, verified: true, featured: true, ratingAvg: true, ratingCount: true, categoryId: true, languages: true,
  locations: { where: { isPrimary: true, deletedAt: null, status: "active" }, take: 1, select: { city: cityInclude, latitude: true, longitude: true } },
  _count: { select: { services: { where: { status: "published", deletedAt: null } } } },
} satisfies Prisma.BusinessSelect;

// ------------------------------------------------------------------ taxonomy

/**
 * Active categories with `count` = published businesses in the category and its sub-categories. Categories with no
 * listings yet stay in the list (count 0): filters never hide a choice just because it is empty today.
 */
export const getCategories = cache(async () => {
  const [rows, perCategory] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
      select: { id: true, slug: true, parentId: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true },
    }),
    prisma.business.groupBy({ by: ["categoryId"], where: { ...PUBLIC_BUSINESS, categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const own = new Map(perCategory.map((r) => [r.categoryId, r._count._all]));
  return rows.map((c) => ({ ...c, count: descendantIds(rows, c.id).reduce((n, id) => n + (own.get(id) ?? 0), 0) }));
});

/** Germany is the current public market. Locale/language is intentionally independent from country. */
export const DEFAULT_PUBLIC_COUNTRY_CODE = "DE";

/**
 * Active cities for one country. `count` follows the currently relevant public-business filters so category pages
 * show useful per-city totals without leaking cities from other countries into the selector.
 *
 * Future country pages can pass another ISO code; callers that do not select a market explicitly stay Germany-first.
 */
export type CityScope = {
  countryCode?: string;
  categoryId?: string;
  q?: string;
  verified?: "1";
};

export const getCities = cache(async (scope: CityScope = {}) => {
  const countryCode = scope.countryCode?.toUpperCase();
  const cats = scope.categoryId ? await categoryIds(scope.categoryId) : undefined;
  const businessWhere: Prisma.BusinessWhereInput = {
    ...PUBLIC_BUSINESS,
    ...textWhere(scope.q),
    ...(scope.verified ? { verified: true } : {}),
    ...(cats ? businessInCategories(cats) : {}),
  };

  const rows = await prisma.city.findMany({
    where: {
      isActive: true,
      ...(countryCode ? { country: { code: countryCode, isActive: true } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameCkb: true,
      nameKmr: true,
      nameDe: true,
      nameAr: true,
      nameTr: true,
      _count: {
        select: {
          locations: {
            where: {
              status: "active",
              deletedAt: null,
              ...(countryCode ? { countryCode } : {}),
              business: businessWhere,
            },
          },
        },
      },
    },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, count: _count.locations }));
});

const cityNameSelect = {
  id: true,
  slug: true,
  nameEn: true,
  nameCkb: true,
  nameKmr: true,
  nameDe: true,
  nameAr: true,
  nameTr: true,
} as const;

/**
 * Cities safe to embed in public HTML: the curated German set, plus cities that
 * already have a matching public listing. Does not load the ~2,000-row gazetteer.
 */
export const listSelectorCities = cache(async (scope: CityScope = {}) => {
  const countryCode = (scope.countryCode ?? DEFAULT_PUBLIC_COUNTRY_CODE).toUpperCase();
  const cats = scope.categoryId ? await categoryIds(scope.categoryId) : undefined;
  const businessWhere: Prisma.BusinessWhereInput = {
    ...PUBLIC_BUSINESS,
    ...textWhere(scope.q),
    ...(scope.verified ? { verified: true } : {}),
    ...(cats ? businessInCategories(cats) : {}),
  };
  const locWhere: Prisma.LocationWhereInput = {
    status: "active",
    deletedAt: null,
    countryCode,
    business: businessWhere,
  };
  const inCountry = { isActive: true, country: { code: countryCode, isActive: true } };
  const select = { ...cityNameSelect, _count: { select: { locations: { where: locWhere } } } } as const;

  const [majors, listed] = await Promise.all([
    prisma.city.findMany({
      where: { ...inCountry, slug: { in: [...MAJOR_CITY_SLUGS] } },
      select,
    }),
    prisma.city.findMany({
      where: { ...inCountry, locations: { some: locWhere } },
      select,
    }),
  ]);

  const byId = new Map<string, Omit<(typeof majors)[number], "_count"> & { count: number }>();
  for (const row of [...listed, ...majors]) {
    const { _count, ...city } = row;
    byId.set(city.id, { ...city, count: _count.locations });
  }
  return rankSelectorCities([...byId.values()]);
});

/** One active city by its public slug. Does not scan the full city table. */
export const getCityBySlug = cache(async (slug: string) =>
  prisma.city.findFirst({ where: { slug, isActive: true }, select: cityNameSelect }),
);

/** A category filter also matches all of its sub-categories, at any depth. */
async function categoryIds(id?: string): Promise<string[] | undefined> {
  if (!id) return undefined;
  return descendantIds(await getCategories(), id);
}

// ------------------------------------------------------------------ businesses

export type BusinessQuery = { q?: string; category?: string; city?: string; verified?: "1"; sort: "featured" | "rating" | "newest" | "name"; page: number };

const businessOrder = {
  featured: [{ featured: "desc" }, { ratingAvg: "desc" }, { name: "asc" }],
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  newest: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  name: [{ name: "asc" }],
} satisfies Record<BusinessQuery["sort"], Prisma.BusinessOrderByWithRelationInput[]>;

export async function listBusinesses(query: BusinessQuery) {
  const cats = await categoryIds(query.category);
  const where: Prisma.BusinessWhereInput = {
    ...PUBLIC_BUSINESS,
    ...textWhere(query.q),
    ...(query.verified ? { verified: true } : {}),
    ...(cats ? businessInCategories(cats) : {}),
    ...(query.city ? businessInCity(query.city) : {}),
  };
  const [total, items] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({ where, orderBy: businessOrder[query.sort], select: businessCard, ...skipTake(query.page) }),
  ]);
  return { items, total, pages: pageCount(total), page: query.page };
}

export type BusinessCardData = Awaited<ReturnType<typeof listBusinesses>>["items"][number];

export const getBusiness = cache(async (slug: string) =>
  prisma.business.findFirst({
    where: { slug, ...PUBLIC_BUSINESS },
    select: {
      ...businessCard, email: true, phone: true, website: true, coverUrl: true, tags: true, updatedAt: true,
      services: {
        where: { status: "published", deletedAt: null },
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
        select: { id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, priceFrom: true, priceTo: true, currency: true, durationMin: true },
      },
      locations: {
        where: { status: "active", deletedAt: null },
        orderBy: { isPrimary: "desc" },
        select: { id: true, label: true, addressLine1: true, addressLine2: true, postalCode: true, countryCode: true, latitude: true, longitude: true, phone: true, email: true, openingHours: true, isPrimary: true, city: cityInclude },
      },
    },
  }),
);

// ------------------------------------------------------------------ services

export type ServiceQuery = { q?: string; category?: string; city?: string; sort: "featured" | "priceAsc" | "priceDesc" | "newest"; page: number };

const serviceCard = {
  id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true,
  priceFrom: true, priceTo: true, currency: true, durationMin: true,
  business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, verified: true } },
  category: { select: { nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } },
} satisfies Prisma.ServiceSelect;

const serviceOrder = {
  featured: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  priceAsc: [{ priceFrom: { sort: "asc", nulls: "last" } }],
  priceDesc: [{ priceFrom: { sort: "desc", nulls: "last" } }],
  newest: [{ createdAt: "desc" }],
} satisfies Record<ServiceQuery["sort"], Prisma.ServiceOrderByWithRelationInput[]>;

export async function listServices(query: ServiceQuery) {
  const cats = await categoryIds(query.category);
  const where: Prisma.ServiceWhereInput = {
    status: "published",
    deletedAt: null,
    business: { ...PUBLIC_BUSINESS, ...(query.city ? businessInCity(query.city) : {}) },
    ...textWhere(query.q),
    ...(cats ? { categoryId: { in: cats } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({ where, orderBy: serviceOrder[query.sort], select: serviceCard, ...skipTake(query.page) }),
  ]);
  return { items, total, pages: pageCount(total), page: query.page };
}

export type ServiceCardData = Awaited<ReturnType<typeof listServices>>["items"][number];

export const getService = cache(async (businessSlug: string, slug: string) =>
  prisma.service.findFirst({
    where: { slug, status: "published", deletedAt: null, business: { slug: businessSlug, ...PUBLIC_BUSINESS } },
    select: {
      ...serviceCard,
      description: true, descriptionCkb: true, descriptionAr: true, descriptionDe: true,
      business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, verified: true, phone: true, email: true } },
    },
  }),
);

// ------------------------------------------------------------------ locations

export type LocationQuery = { q?: string; city?: string; category?: string; page: number };

const locationCard = {
  id: true, label: true, addressLine1: true, postalCode: true, countryCode: true, latitude: true, longitude: true, phone: true, isPrimary: true,
  city: cityInclude,
  business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, verified: true } },
} satisfies Prisma.LocationSelect;

export async function listLocations(query: LocationQuery) {
  const cats = await categoryIds(query.category);
  const where: Prisma.LocationWhereInput = {
    status: "active",
    deletedAt: null,
    business: { ...PUBLIC_BUSINESS, ...(cats ? businessInCategories(cats) : {}) },
    ...textWhere(query.q),
    ...(query.city ? { cityId: query.city } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.location.count({ where }),
    prisma.location.findMany({ where, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }], select: locationCard, ...skipTake(query.page) }),
  ]);
  return { items, total, pages: pageCount(total), page: query.page };
}

export type LocationCardData = Awaited<ReturnType<typeof listLocations>>["items"][number];

// ------------------------------------------------------------------ search / home

export type SearchType = "all" | "businesses" | "services" | "locations";

export async function searchAll({ q, type, page }: { q: string; type: SearchType; page: number }) {
  const empty = { items: [], total: 0, pages: 1, page } as const;
  if (searchTokens(q).length === 0) return { businesses: empty, services: empty, locations: empty };
  const want = (t: SearchType) => type === "all" || type === t;
  const [businesses, services, locations] = await Promise.all([
    want("businesses") ? listBusinesses({ q, sort: "featured", page }) : empty,
    want("services") ? listServices({ q, sort: "featured", page }) : empty,
    want("locations") ? listLocations({ q, page }) : empty,
  ]);
  return { businesses, services, locations };
}

export const getHomeData = unstable_cache(
  async () => {
    const [businesses, services, locations, featured, latest, newServices] = await Promise.all([
      prisma.business.count({ where: PUBLIC_BUSINESS }),
      prisma.service.count({ where: { status: "published", deletedAt: null, business: PUBLIC_BUSINESS } }),
      prisma.location.count({ where: { status: "active", deletedAt: null, business: PUBLIC_BUSINESS } }),
      prisma.business.findMany({ where: { ...PUBLIC_BUSINESS, featured: true }, orderBy: [{ ratingAvg: "desc" }], take: 6, select: businessCard }),
      prisma.business.findMany({ where: PUBLIC_BUSINESS, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 4, select: businessCard }),
      prisma.service.findMany({
        where: { status: "published", deletedAt: null, business: PUBLIC_BUSINESS },
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: {
          id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, createdAt: true,
          business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { city: cityInclude } } } },
        },
      }),
    ]);
    return { stats: { businesses, services, locations }, featured, latest, newServices };
  },
  ["home-data"],
  { revalidate: 120 },
);

// ------------------------------------------------------------------ nearby discovery

export type NearbyQuery = {
  lat: number; lng: number; radiusKm: number; q?: string; category?: string; openNow?: boolean;
  sort: "distance" | "rating"; page: number;
  /** "map": every match in range (up to NEARBY_MAP_MAX) in one response, for the map's markers. */
  mode?: "list" | "map";
};

/** Upper bound of candidate locations read per request (bounding box pre-filter keeps this small in practice). */
const NEARBY_CANDIDATES = 1500;
export const NEARBY_PER_PAGE = 20;
export const NEARBY_MAP_MAX = 500;

/**
 * Businesses near a point: indexed bounding-box pre-filter, exact haversine distance, one card per business
 * (its nearest location), optional open-now filter in each location's own timezone. Coordinates are never logged.
 */
export async function nearbyBusinesses(query: NearbyQuery) {
  const { boundingBox, distanceKm, isOpenNow } = await import("@/lib/geo");
  const box = boundingBox(query, query.radiusKm);
  const tokens = searchTokens(query.q);
  const cats = await categoryIds(query.category);
  const rows = await prisma.location.findMany({
    where: {
      status: "active",
      deletedAt: null,
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
      business: {
        ...PUBLIC_BUSINESS,
        AND: [
          // Each word must match the business (names, category, city, services) or one of its addresses.
          ...tokens.map((t) => ({ OR: [{ searchText: { contains: t } }, { locations: { some: { searchText: { contains: t }, deletedAt: null } } }] })),
          ...(cats ? [businessInCategories(cats)] : []),
        ],
      },
    },
    take: NEARBY_CANDIDATES,
    select: {
      id: true, addressLine1: true, postalCode: true, countryCode: true, latitude: true, longitude: true, phone: true, openingHours: true,
      city: cityInclude,
      business: {
        select: {
          id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, logoUrl: true, coverUrl: true, verified: true, ratingAvg: true, ratingCount: true,
          // Category for the map preview: the business's own, else that of its first published service.
          category: { select: { nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } },
          services: { where: { status: "published", deletedAt: null, categoryId: { not: null } }, orderBy: { createdAt: "asc" }, take: 1, select: { category: { select: { nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } } } },
        },
      },
    },
  });

  const nearest = new Map<string, ReturnType<typeof toItem>>();
  function toItem(r: (typeof rows)[number]) {
    const distance = distanceKm(query, { lat: r.latitude!, lng: r.longitude! });
    const { openingHours, business: { services, category, ...business }, ...rest } = r;
    return { ...rest, business, category: category ?? services[0]?.category ?? null, distanceKm: Math.round(distance * 100) / 100, openNow: isOpenNow(openingHours, r.countryCode) };
  }
  for (const r of rows) {
    const item = toItem(r);
    if (item.distanceKm > query.radiusKm) continue;
    if (query.openNow && item.openNow !== true) continue;
    const seen = nearest.get(r.business.id);
    if (!seen || item.distanceKm < seen.distanceKm) nearest.set(r.business.id, item);
  }

  const all = [...nearest.values()].sort((a, b) =>
    query.sort === "rating"
      ? b.business.ratingAvg - a.business.ratingAvg || b.business.ratingCount - a.business.ratingCount || a.distanceKm - b.distanceKm
      : a.distanceKm - b.distanceKm,
  );
  if (query.mode === "map") {
    return { items: all.slice(0, NEARBY_MAP_MAX), total: all.length, page: 1, pages: 1, truncated: rows.length >= NEARBY_CANDIDATES || all.length > NEARBY_MAP_MAX };
  }
  const pages = Math.max(1, Math.ceil(all.length / NEARBY_PER_PAGE));
  const page = Math.min(query.page, pages);
  return { items: all.slice((page - 1) * NEARBY_PER_PAGE, page * NEARBY_PER_PAGE), total: all.length, page, pages, truncated: rows.length >= NEARBY_CANDIDATES };
}

export type NearbyItem = Awaited<ReturnType<typeof nearbyBusinesses>>["items"][number];

/** Cities that have coordinates and public listings: the manual fallback when location permission is not given. */
/** Germany-first ordering for the manual picker (by country, never by a specific city); then alphabetical. */
const PRIMARY_COUNTRY = "DE";
export const getNearbyCities = cache(async () =>
  (await prisma.city.findMany({
    where: {
      isActive: true,
      country: { code: PRIMARY_COUNTRY, isActive: true },
      latitude: { not: null },
      longitude: { not: null },
      locations: { some: { status: "active", deletedAt: null, business: PUBLIC_BUSINESS } },
    },
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameTr: true, latitude: true, longitude: true, country: { select: { code: true } } },
  })).sort((a, b) => Number(b.country.code === PRIMARY_COUNTRY) - Number(a.country.code === PRIMARY_COUNTRY) || a.nameEn.localeCompare(b.nameEn)),
);
