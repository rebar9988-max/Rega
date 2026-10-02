/**
 * Small fixed-window limiter, in memory (per server instance).
 * Enough to blunt password guessing on a single node; put a shared store (Redis/Upstash)
 * behind the same signature when running several instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 50_000;

export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

type RateLimitBinding = { limit(options: { key: string }): Promise<{ success: boolean }> };

/**
 * Shared limiter: on Cloudflare Workers the in-memory map is per isolate, so an attacker spread across isolates
 * is barely slowed. When the Workers Rate Limiting binding exists (wrangler.jsonc "ratelimits"), it is enforced
 * across isolates; the in-memory window is always applied as well (and is the only limiter on Node/Docker).
 */
export async function allowShared(binding: "LOGIN_LIMITER" | "AI_LIMITER" | "SEARCH_LIMITER" | "FORM_LIMITER", key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!allow(key, limit, windowMs)) return false;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const limiter = (getCloudflareContext().env as Record<string, unknown>)[binding] as RateLimitBinding | undefined;
    if (limiter) return (await limiter.limit({ key })).success;
  } catch {
    // Not running on Workers (Node, tests): the in-memory window above already applied.
  }
  return true;
}
