/** Publication policy shared by moderation, form and REST writes. No new persisted workflow states. */
import type { Prisma } from "@prisma/client";
import { publishReadiness } from "./coordinates";

export const BUSINESS_CATEGORY = {
  sectionKey: "businesses",
  isActive: true,
  deletedAt: null,
} as const;
export const publicationSelect = {
  id: true,
  name: true,
  status: true,
  verified: true,
  categoryId: true,
  publishedAt: true,
  archivedAt: true,
  deletedAt: true,
  category: { select: { sectionKey: true, isActive: true, deletedAt: true } },
  locations: {
    where: { isPrimary: true, status: "active", deletedAt: null },
    take: 1,
    select: {
      addressLine1: true,
      cityId: true,
      countryCode: true,
      latitude: true,
      longitude: true,
      coordsVerifiedAt: true,
    },
  },
} satisfies Prisma.BusinessSelect;
export type PublicationRecord = Prisma.BusinessGetPayload<{
  select: typeof publicationSelect;
}>;

export function businessReadiness(b: PublicationRecord) {
  const validCategory =
    b.category?.sectionKey === "businesses" &&
    b.category.isActive &&
    !b.category.deletedAt;
  return publishReadiness({
    name: b.name,
    categoryId: validCategory ? b.categoryId : null,
    primary: b.locations[0],
  });
}

export function approvalData(b: PublicationRecord, now = new Date()) {
  if (
    b.deletedAt ||
    b.archivedAt ||
    !["draft", "pending", "published"].includes(b.status) ||
    !businessReadiness(b).ok
  )
    return null;
  return {
    verified: true,
    status: "published",
    publishedAt: b.publishedAt ?? now,
    archivedAt: null,
  } as const;
}

/** Same lock for every business write: parallel approve/edit/archive cannot overwrite each other's decision. */
export async function lockBusiness(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`business:${id}`}::text))`;
}
