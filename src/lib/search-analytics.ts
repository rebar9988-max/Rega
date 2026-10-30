import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { analyticsQuery, summarize, type SearchStats } from "@/lib/search-analytics-core";

export { analyticsQuery, type SearchStats } from "@/lib/search-analytics-core";

/**
 * Privacy-conscious search analytics: one counter per (UTC day, language, normalized search text) in SearchQueryDaily,
 * plus how many of those searches found nothing. Nothing about the searcher is stored (no user, session, IP, device or
 * cookie), texts that look personal are dropped (analyticsQuery), and bots are not counted by the caller.
 * One atomic statement per search (no read before the write); failures are logged and never reach the visitor.
 */
export async function recordSearch(input: { q: string; locale: string; total: number }, now = new Date()): Promise<void> {
  const query = analyticsQuery(input.q);
  if (!query) return;
  const day = now.toISOString().slice(0, 10);
  const zero = input.total === 0 ? 1 : 0;
  try {
    await prisma.$executeRaw`INSERT INTO "SearchQueryDaily" ("id", "day", "locale", "query", "searches", "zeroResults")
      VALUES (${crypto.randomUUID()}, ${day}, ${input.locale}, ${query}, 1, ${zero})
      ON CONFLICT ("day", "locale", "query") DO UPDATE SET "searches" = "SearchQueryDaily"."searches" + 1,
        "zeroResults" = "SearchQueryDaily"."zeroResults" + excluded."zeroResults"`;
  } catch (error) {
    log.error("search.analytics.failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

/** Totals, most searched texts and texts that found nothing, over the last `days` UTC days (today included). */
export async function searchStats(days: number, locale?: string, now = new Date()): Promise<SearchStats> {
  const since = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  try {
    const rows = await prisma.searchQueryDaily.findMany({
      where: { day: { gte: since }, ...(locale ? { locale } : {}) },
      select: { day: true, query: true, searches: true, zeroResults: true },
      take: 20_000,
    });
    return summarize(rows, days);
  } catch (error) {
    // Table not created yet (migration pending) or a database hiccup: the dashboard shows "no searches" instead of failing.
    log.error("search.analytics.read_failed", { error: error instanceof Error ? error.message : String(error) });
    return summarize([], days);
  }
}
