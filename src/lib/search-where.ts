/**
 * Query building blocks shared by the public pages, the REST API and REGA AI, so filters behave identically
 * everywhere (results, totals and pagination use the same `where`). Pure: no I/O.
 */
import type { Prisma } from "@prisma/client";
import { searchTokens } from "./text";

/** Every token must occur in the record's search text (order-free, substring per token). */
export function textWhere(q: string | null | undefined): { AND: { searchText: { contains: string } }[] } | Record<string, never> {
  const tokens = searchTokens(q);
  return tokens.length ? { AND: tokens.map((t) => ({ searchText: { contains: t } })) } : {};
}

/** A business is in a category through its own (primary) category or any of its published services. */
export function businessInCategories(ids: string[]): Prisma.BusinessWhereInput {
  return { OR: [{ categoryId: { in: ids } }, { services: { some: { categoryId: { in: ids }, status: "published", deletedAt: null } } }] };
}

/** A business is in a city when it has an active location there. */
export function businessInCity(cityId: string): Prisma.BusinessWhereInput {
  return { locations: { some: { cityId, status: "active", deletedAt: null } } };
}

export const PUBLIC_BUSINESS = { status: "published", deletedAt: null } satisfies Prisma.BusinessWhereInput;
