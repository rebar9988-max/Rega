/**
 * GET /api/v1/search — unified, API-driven search across businesses, services and locations.
 * Returns one page per type plus exact totals; the client never downloads the full dataset.
 * Designed so an AI/vector ranker can be layered on later without changing this contract.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleError, normalizeSearch, ok, pageParams } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchType = "all" | "businesses" | "services" | "locations";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = normalizeSearch((url.searchParams.get("q") ?? "").slice(0, 120));
    const type = (url.searchParams.get("type") ?? "all") as SearchType;
    const cityId = url.searchParams.get("cityId");
    const categoryId = url.searchParams.get("categoryId");
    const { page, perPage, skip, take } = pageParams(url, 12, 50);

    if (q.length < 2) {
      return ok({ businesses: [], services: [], locations: [], totals: { businesses: 0, services: 0, locations: 0 }, query: q });
    }

    const wantBusinesses = type === "all" || type === "businesses";
    const wantServices = type === "all" || type === "services";
    const wantLocations = type === "all" || type === "locations";

    const [businesses, services, locations, totalBusinesses, totalServices, totalLocations] = await Promise.all([
      wantBusinesses
        ? prisma.business.findMany({
            where: { status: "published", deletedAt: null, searchText: { contains: q }, ...(cityId ? { locations: { some: { cityId } } } : {}) },
            skip,
            take,
            orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }],
            select: { id: true, slug: true, name: true, nameCkb: true, logoUrl: true, ratingAvg: true, featured: true, verified: true },
          })
        : Promise.resolve([]),
      wantServices
        ? prisma.service.findMany({
            where: {
              status: "published",
              deletedAt: null,
              searchText: { contains: q },
              ...(categoryId ? { categoryId } : {}),
              business: { status: "published", deletedAt: null },
            },
            skip,
            take,
            orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
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
            where: {
              status: "active",
              deletedAt: null,
              searchText: { contains: q },
              ...(cityId ? { cityId } : {}),
              business: { status: "published", deletedAt: null },
            },
            skip,
            take,
            orderBy: [{ isPrimary: "desc" }],
            select: {
              id: true,
              addressLine1: true,
              postalCode: true,
              city: { select: { nameEn: true, nameCkb: true } },
              business: { select: { slug: true, name: true } },
            },
          })
        : Promise.resolve([]),
      wantBusinesses ? prisma.business.count({ where: { status: "published", deletedAt: null, searchText: { contains: q } } }) : 0,
      wantServices ? prisma.service.count({ where: { status: "published", deletedAt: null, searchText: { contains: q } } }) : 0,
      wantLocations ? prisma.location.count({ where: { status: "active", deletedAt: null, searchText: { contains: q } } }) : 0,
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
