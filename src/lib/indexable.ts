/**
 * "Does this list page have anything to show?" for robots metadata and the sitemap.
 *
 * A list page without results (a category, a city, a city x category page, the service or guide index before anything
 * is published) is a thin page: it answers `noindex, follow` and stays out of the sitemap until its first entry is
 * published, then both flip automatically. Only the URL's own scope counts (category / city / section), never the
 * visitor's search, sort or page parameters, so the decision is the same for every visitor of the canonical URL.
 *
 * Every lookup is a `LIMIT 1` existence query. A failed lookup (database briefly unavailable) counts as "has content":
 * an outage must never push pages out of the index.
 */
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { descendantIds } from "@/lib/category-tree";
import { getCategories } from "@/lib/data";
import { PUBLIC_BUSINESS, businessInCategories, businessInCity } from "@/lib/search-where";
import { publicWhere } from "@/features/content/queries";
import type { ContentSection } from "@/features/content/config";

async function exists(find: () => Promise<unknown>): Promise<boolean> {
  try {
    return Boolean(await find());
  } catch {
    return true;
  }
}

/** Published businesses in a category (with its sub-categories) and/or a city: the same scope as the list page. */
export const hasPublicBusinesses = cache(async (categoryId?: string, cityId?: string): Promise<boolean> =>
  exists(async () => {
    const cats = categoryId ? descendantIds(await getCategories(), categoryId) : undefined;
    return prisma.business.findFirst({
      where: { ...PUBLIC_BUSINESS, ...(cats ? businessInCategories(cats) : {}), ...(cityId ? businessInCity(cityId) : {}) },
      select: { id: true },
    });
  }),
);

/** Published services of published businesses (the /services index). */
export const hasPublicServices = cache(async (): Promise<boolean> =>
  exists(() => prisma.service.findFirst({ where: { status: "published", deletedAt: null, business: PUBLIC_BUSINESS }, select: { id: true } })),
);

/** Visible entries of a content section (guides, jobs, events) as its index lists them by default. */
export const hasPublishedEntries = cache(async (section: ContentSection): Promise<boolean> =>
  exists(() => prisma.listing.findFirst({ where: publicWhere(section, {}), select: { id: true } })),
);
