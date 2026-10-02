/**
 * GET /api/v1/search — unified, API-driven search across businesses, services and locations.
 * Returns one page per type plus exact totals; the client never downloads the full dataset.
 * Every word of `q` must match (order-free); Kurdish/Arabic/Persian keyboard variants are folded.
 * `cityId` and `categoryId` narrow results AND totals with the same rules as the public pages.
 */
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleError, normalizeSearch, ok, pageParams } from "@/lib/api";
import { PUBLIC_BUSINESS, businessInCategories, businessInCity, textWhere } from "@/lib/search-where";
import { searchTokens } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchType = "all" | "businesses" | "services" | "locations";
const TYPES: SearchType[] = ["all", "businesses", "services", "locations"];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const raw = (url.searchParams.get("q") ?? "").slice(0, 120);
    const q = normalizeSearch(raw);
    const type = TYPES.find((t) => t === url.searchParams.get("type")) ?? "all";
    const cityId = url.searchParams.get("cityId")?.trim().slice(0, 64) || null;
    const categoryId = url.searchParams.get("categoryId")?.trim().slice(0, 64) || null;
    const { page, perPage, skip, take } = pageParams(url, 12, 50);

    if (searchTokens(raw).length === 0) {
      return ok({ businesses: [], services: [], locations: [], totals: { businesses: 0, services: 0, locations: 0 }, query: q });
    }

    const categoryIds = categoryId
      ? [categoryId, ...(await prisma.category.findMany({ where: { parentId: categoryId, deletedAt: null }, select: { id: true } })).map((c) => c.id)]
      : null;

    const businessWhere: Prisma.BusinessWhereInput = {
      ...PUBLIC_BUSINESS,
      ...textWhere(raw),
      ...(categoryIds ? businessInCategories(categoryIds) : {}),
      ...(cityId ? businessInCity(cityId) : {}),
    };
    const serviceWhere: Prisma.ServiceWhereInput = {
      status: "published",
      deletedAt: null,
      ...textWhere(raw),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      business: { ...PUBLIC_BUSINESS, ...(cityId ? businessInCity(cityId) : {}) },
    };
    const locationWhere: Prisma.LocationWhereInput = {
      status: "active",
      deletedAt: null,
      ...textWhere(raw),
      ...(cityId ? { cityId } : {}),
      business: { ...PUBLIC_BUSINESS, ...(categoryIds ? businessInCategories(categoryIds) : {}) },
    };

    const wantBusinesses = type === "all" || type === "businesses";
    const wantServices = type === "all" || type === "services";
    const wantLocations = type === "all" || type === "locations";

    const [businesses, services, locations, totalBusinesses, totalServices, totalLocations] = await Promise.all([
      wantBusinesses
        ? prisma.business.findMany({
            where: businessWhere,
            skip,
            take,
            orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }, { id: "asc" }],
            select: { id: true, slug: true, name: true, nameCkb: true, logoUrl: true, ratingAvg: true, featured: true, verified: true },
          })
        : Promise.resolve([]),
      wantServices
        ? prisma.service.findMany({
            where: serviceWhere,
            skip,
            take,
            orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              slug: true,
              name: true,
              nameCkb: true,
              priceFrom: true,
              currency: true,
              coverUrl: true,
              business: { select: { slug: true, name: true } },
            },
          })
        : Promise.resolve([]),
      wantLocations
        ? prisma.location.findMany({
            where: locationWhere,
            skip,
            take,
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            select: {
              id: true,
              addressLine1: true,
              postalCode: true,
              city: { select: { nameEn: true, nameCkb: true } },
              business: { select: { slug: true, name: true } },
            },
          })
        : Promise.resolve([]),
      wantBusinesses ? prisma.business.count({ where: businessWhere }) : 0,
      wantServices ? prisma.service.count({ where: serviceWhere }) : 0,
      wantLocations ? prisma.location.count({ where: locationWhere }) : 0,
    ]);

    return ok({
      query: q,
      type,
      businesses,
      services,
      locations,
      totals: { businesses: totalBusinesses, services: totalServices, locations: totalLocations },
      page,
      perPage,
    });
  } catch (error) {
    return handleError(error, "search");
  }
}
