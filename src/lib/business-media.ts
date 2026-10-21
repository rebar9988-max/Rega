import type { Prisma, PrismaClient } from "@prisma/client";

/** Preserve existing approved URLs; new business images must be normalized files owned by this actor. */
export async function ownsBusinessImages(db: Prisma.TransactionClient | PrismaClient, urls: string[], actorId: string, existing: string[] = []) {
  const fresh = [...new Set(urls.filter((url) => url && !existing.includes(url)))];
  if (!fresh.length) return true;
  const rows = await db.media.findMany({ where: { url: { in: fresh }, uploadedById: actorId,
    deletedAt: null, storageKey: { startsWith: `business-images/${actorId}/` }, kind: "image" }, select: { url: true } });
  return new Set(rows.map((row) => row.url)).size === fresh.length;
}
