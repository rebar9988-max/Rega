/**
 * Zero-cost budget (PM-01): pure, so concurrency, exhaustion and outages are unit-tested without a database.
 *
 * Every model attempt (each provider tried, fallbacks and /dr/ai probes included) and every Workers AI rerank reserves
 * one unit BEFORE the call. The counter increments atomically and returns the new value, so concurrent requests can
 * never approve more than `limit` calls a day. If the counter is unavailable the call is refused (fail closed).
 */

/** Atomically adds `amount` (default 1) to today's counter `key` and returns the new value (one INSERT … ON CONFLICT … RETURNING). */
export type UsageCounter = { increment(day: Date, key: string, amount?: number): Promise<number> };

/** AiUsageDaily.provider of the reservation rows; excluded from per-provider statistics. */
export const BUDGET_PROVIDER = "_budget";
export const BUDGET_KEYS = Object.freeze({ modelAttempts: "model-attempts", workersAiRerank: "workers-ai-rerank", workersAiNeurons: "workers-ai-neurons" });

/**
 * Workers AI free allowance, verified 2026-11-04 on developers.cloudflare.com/workers-ai/platform/pricing/ (updated
 * 2026-10-20): 10,000 Neurons per account per UTC day free; beyond that Workers Free fails, Workers Paid bills.
 * @cf/baai/bge-reranker-base: 283 Neurons per million input tokens.
 * Worst case of one REGA rerank call: 12 candidates × (4,000-char passage + 1,000-char query) × 2 tokens per char
 * = 120,000 tokens = 34 Neurons. The cap keeps REGA at ≤ 85 % of the free allowance: floor(8,500 / 34) = 250 calls.
 */
export const WORKERS_AI_LIMITS = Object.freeze({
  freeNeuronsPerDay: 10_000,
  rerankNeuronsPerMillionTokens: 283,
  maxItems: 12,
  maxPassageChars: 4_000,
  maxQueryChars: 1_000,
  tokensPerCharBound: 2,
  shareOfFreeAllowance: 0.85,
});
export const RERANK_WORST_NEURONS = Math.ceil(
  (WORKERS_AI_LIMITS.maxItems * (WORKERS_AI_LIMITS.maxPassageChars + WORKERS_AI_LIMITS.maxQueryChars) * WORKERS_AI_LIMITS.tokensPerCharBound * WORKERS_AI_LIMITS.rerankNeuronsPerMillionTokens) / 1_000_000,
);
export const RERANK_DAILY_CAP = Math.floor((WORKERS_AI_LIMITS.freeNeuronsPerDay * WORKERS_AI_LIMITS.shareOfFreeAllowance) / RERANK_WORST_NEURONS);

/**
 * ONE Workers AI budget for every REGA use (rerank and chat): Neurons per UTC day, ≤ 85 % of the verified free 10,000.
 * Each call reserves its worst-case cost before running; the counter is atomic, so the sum can never pass this cap.
 */
export const WORKERS_AI_NEURON_BUDGET = Math.floor(WORKERS_AI_LIMITS.freeNeuronsPerDay * WORKERS_AI_LIMITS.shareOfFreeAllowance);

/**
 * Workers AI chat model, verified 2026-11-05 on developers.cloudflare.com (pricing page; Jul 28 2026 changelog lists
 * it among models that stay on the Workers Free plan): @cf/google/gemma-4-26b-a4b-it = 9,091 Neurons per million input
 * tokens and 27,273 per million output tokens.
 */
export const WORKERS_AI_CHAT = Object.freeze({
  model: "@cf/google/gemma-4-26b-a4b-it",
  neuronsPerMillionInput: 9_091,
  neuronsPerMillionOutput: 27_273,
});

/** Worst-case Neurons of one chat call: every prompt character counted as 2 tokens, the full output budget used. */
export function chatWorstNeurons(promptChars: number, maxOutputTokens: number): number {
  const input = Math.max(0, promptChars) * WORKERS_AI_LIMITS.tokensPerCharBound;
  return Math.ceil((input * WORKERS_AI_CHAT.neuronsPerMillionInput + Math.max(0, maxOutputTokens) * WORKERS_AI_CHAT.neuronsPerMillionOutput) / 1_000_000);
}

/** The owner's AI_RERANK_DAILY_LIMIT can only lower the verified cap, never raise it. */
export function rerankLimit(configured: number | undefined): number {
  return Math.max(0, Math.min(configured ?? RERANK_DAILY_CAP, RERANK_DAILY_CAP));
}

export const utcDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** True only if this call got one of today's `limit` units. Never throws. */
export async function reserve(counter: UsageCounter, key: string, limit: number, now = new Date(), amount = 1): Promise<boolean> {
  if (!(limit > 0) || !Number.isInteger(amount) || amount < 1 || amount > limit) return false;
  try {
    const used = await counter.increment(utcDay(now), key, amount);
    return Number.isFinite(used) && used <= limit;
  } catch {
    return false;
  }
}
