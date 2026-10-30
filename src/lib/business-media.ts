import type { Prisma, PrismaClient } from "@prisma/client";
import { parseVariants, variantKey } from "@/features/business-images/variants";

/**
 * Preserve existing approved URLs; new business images must be normalized files owned by this actor. A new URL that
 * announces smaller copies (features/business-images/variants.ts) is accepted only when every announced copy was
 * uploaded by the same actor and the announced original width matches the stored image.
 */
export async function ownsBusinessImages(db: Prisma.TransactionClient | PrismaClient, urls: string[], actorId: string, existing: string[] = []) {
  const fresh = [...new Set(urls.filter((url) => url && !existing.includes(url)))];
  if (!fresh.length) return true;
  const plain = fresh.map((url) => (url.includes("?") ? parseVariants(url)?.base ?? url : url));
  const rows = await db.media.findMany({ where: { url: { in: [...new Set(plain)] }, uploadedById: actorId,
    deletedAt: null, storageKey: { startsWith: "business-images/" }, kind: "image" }, select: { url: true, width: true } });
  const width = new Map(rows.map((row) => [row.url, row.width]));
  if (!plain.every((url) => width.has(url))) return false;
  const keys: string[] = [];
  for (const url of fresh) {
    const info = url.includes("?") ? parseVariants(url) : null;
    if (!info) continue;
    if (width.get(info.base) !== info.width) return false;
    keys.push(...info.widths.map((w) => variantKey(info.uuid, w, info.ext)));
  }
  if (!keys.length) return true;
  const copies = await db.media.count({ where: { storageKey: { in: keys }, uploadedById: actorId, deletedAt: null, kind: "image" } });
  return copies === new Set(keys).size;
}
