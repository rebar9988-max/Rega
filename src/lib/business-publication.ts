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
      city: { select: { isActive: true, country: { select: { code: true } } } },
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
  const primary = b.locations[0];
  const validPlace = primary?.city?.isActive && primary.city.country.code === primary.countryCode;
  return publishReadiness({
    name: b.name,
    categoryId: validCategory ? b.categoryId : null,
    primary: validPlace ? primary : null,
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

/**
 * Hide = the existing non-destructive archive (status "archived" + archivedAt); every public query requires
 * `archivedAt: null` (PUBLIC_BUSINESS, sitemap). Nothing else of the record changes, so it can be shown again.
 * Showing it again never bypasses moderation:
 * - back to "published" only if it was published before it was hidden, is still staff-verified, the actor may publish
 *   and the profile still passes the publication rules (approvalData);
 * - a listing that was waiting for review goes back to "pending";
 * - everything else (including a published listing the actor may not publish) goes back to "draft", unverified.
 * Returns null when there is nothing to restore (not hidden, or deleted).
 */
export function restoreData(b: PublicationRecord, previousStatus: string | null | undefined, canPublish: boolean, now = new Date()) {
  if (b.deletedAt || b.status !== "archived") return null;
  if (previousStatus === "published" && canPublish && b.verified) {
    const approved = approvalData({ ...b, status: "published", archivedAt: null }, now);
    if (approved) return approved;
  }
  if (previousStatus === "pending") return { status: "pending", verified: false, archivedAt: null } as const;
  return { status: "draft", verified: false, archivedAt: null } as const;
}

/**
 * What the public sees, for the dashboard: "hidden" (hidden by a person, can be shown again), "public" (passes the same
 * conditions as PUBLIC_BUSINESS in search-where.ts), otherwise "notPublic" (draft, waiting for review, or not complete).
 */
export function publicVisibility(b: {
  status: string;
  verified: boolean;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
  category?: { sectionKey: string | null; isActive: boolean; deletedAt: Date | null } | null;
}): "public" | "notPublic" | "hidden" {
  if (b.status === "archived" || b.archivedAt) return "hidden";
  const validCategory = b.category?.sectionKey === "businesses" && b.category.isActive && !b.category.deletedAt;
  return b.status === "published" && b.verified && !b.deletedAt && validCategory ? "public" : "notPublic";
}

/**
 * The audit entry that actually hid the business (newest first; a repeated hide of an already hidden record is skipped):
 * its status before hiding and who hid it.
 */
export function lastHiding(rows: { before: unknown; actorId: string | null }[]): { status: string; actorId: string | null } | null {
  for (const row of rows) {
    const status = row.before && typeof row.before === "object" && "status" in row.before ? (row.before as { status?: unknown }).status : null;
    if (typeof status === "string" && status !== "archived") return { status, actorId: row.actorId };
  }
  return null;
}

/** Same lock for every business write: parallel approve/edit/archive cannot overwrite each other's decision. */
export async function lockBusiness(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`business:${id}`}::text))`;
}
