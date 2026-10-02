/**
 * Retention of REGA Assistant conversations (promised in the privacy policy: AI_RETENTION_DAYS, config/site.ts).
 * There is no scheduler on the Worker, so the purge runs opportunistically after a small share of chat requests;
 * one indexed bulk delete (messages cascade). Server-only; never throws.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { AI_RETENTION_DAYS } from "@/config/site";

/** Chance that a chat request also purges (about 1 in 25). */
const PURGE_SHARE = 0.04;

export const retentionCutoff = (now = Date.now()) => new Date(now - AI_RETENTION_DAYS * 24 * 60 * 60 * 1000);

export async function purgeOldConversations(random: () => number = Math.random): Promise<number> {
  if (random() >= PURGE_SHARE) return 0;
  try {
    const { count } = await prisma.aiConversation.deleteMany({ where: { createdAt: { lt: retentionCutoff() } } });
    if (count > 0) log.info("ai.retention.purged", { conversations: count });
    return count;
  } catch (error) {
    log.warn("ai.retention.failed", { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}
