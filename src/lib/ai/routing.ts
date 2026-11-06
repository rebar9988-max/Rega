import { TASKS, type Routing, type Task } from "./types";

/**
 * Default task routing. Order = preference; later entries are fallbacks. Every task lists every provider, so no single
 * vendor is a point of failure, and a provider without a configured key is simply skipped.
 * REGA has ONLY zero-cost providers (owner instruction 2026-11-06): paid vendors (OpenAI, xAI Grok, DeepSeek,
 * Anthropic) were removed from the code, so no setting can route to them.
 *  - chat / translate: Gemini first (strongest Kurdish/Arabic script handling), then Groq.
 *  - summarize / classify: Groq first (fastest), then Gemini.
 *  - Cloudflare Workers AI (no key) and OpenRouter (`:free` models only) follow as further free fallbacks.
 * Override without code changes: AI_ROUTING='{"chat":["groq","gemini"]}' (JSON, per task) or
 * AI_PROVIDER_ORDER="gemini,groq" (same order for every task). Unknown ids are skipped.
 */
export const DEFAULT_ROUTING: Routing = {
  chat: ["gemini", "groq", "workers-ai", "openrouter"],
  translate: ["gemini", "groq", "workers-ai", "openrouter"],
  summarize: ["groq", "gemini", "workers-ai", "openrouter"],
  classify: ["groq", "gemini", "workers-ai", "openrouter"],
};

/**
 * Billing model of each provider (vendor pricing pages; account state is not readable from code, so the owner still
 * approves each account in AI_FREE_TIER_APPROVED). Every provider in REGA is free-tier: it has a no-cost quota and
 * fails (429) instead of charging while billing stays off. tests/ai-agent-system-doc.test.ts fails if a routed
 * provider has no entry here.
 */
export const PROVIDER_BILLING: Readonly<Record<string, "free-tier">> = Object.freeze({
  gemini: "free-tier",
  groq: "free-tier",
  "workers-ai": "free-tier",
  // Only `:free` model ids (OpenRouter bills them at $0 and never upgrades them to a paid endpoint); FREE_TIER_MODELS
  // lists the verified ones, so any other OPENROUTER_MODEL fails closed.
  openrouter: "free-tier",
});

/** Id of Cloudflare Workers AI (the rega-ai-python rerank) in the zero-cost approval list. Not a gateway provider. */
export const WORKERS_AI = "workers-ai";

/**
 * Zero-cost policy (PM-01). Nothing is assumed free: a provider may serve only when the owner has approved it in
 * AI_FREE_TIER_APPROVED (an account the owner confirmed has no billing enabled, so exceeding the free quota fails with
 * 429 instead of charging) AND its configured model is on the verified free list. There is no paid path at all.
 * A provider that is not approved is never built, so neither routing nor fallback nor a /dr/ai probe can reach it.
 */
export type CostPolicy = { approvedFree: readonly string[] };
export type CostReason = "approved_free_tier" | "free_tier_not_approved" | "model_not_verified_free" | "not_a_free_provider";

/**
 * Models verified to run on the vendor's free tier (no billing account), read 2026-11-05:
 *  - gemini: ai.google.dev/gemini-api/docs/pricing ("Free of charge" input and output on the Free Tier).
 *  - groq: console.groq.com/docs/rate-limits (free-plan limits listed for the model).
 * A free-tier approval serves only these models, so a GEMINI_MODEL / GROQ_MODEL override to a paid or unverified
 * model fails closed. Add a model only with the vendor's page as evidence.
 */
export const FREE_TIER_MODELS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  gemini: Object.freeze(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]),
  groq: Object.freeze(["openai/gpt-oss-120b"]),
  // developers.cloudflare.com: stays on the Workers Free plan (Jul 28 2026 changelog); Neurons from the 10,000/day free allocation.
  "workers-ai": Object.freeze(["@cf/google/gemma-4-26b-a4b-it"]),
  // openrouter.ai/api/v1/models?max_price=0 (read 2026-11-06): prompt and completion price "0" for these `:free` ids.
  openrouter: Object.freeze(["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free"]),
});

/**
 * Owner-typed id lists (Cloudflare dashboard). Separators: comma, Arabic/Kurdish comma (،), semicolon, whitespace or
 * newline; surrounding quotes are ignored. Anything that is not a plain id is dropped, and an id only matters if it is
 * a free provider (costDecision), so a lenient separator can never approve something new.
 */
export function parseIdList(value: string | undefined): string[] {
  return [...new Set((value ?? "").replace(/["'`]/g, "").split(/[,،;\s]+/u).map((s) => s.trim().toLowerCase()).filter((s) => ID.test(s)))];
}

/** Unknown providers are never allowed (fail closed), even if listed in AI_FREE_TIER_APPROVED. */
/**
 * `models` (provider id → configured model) enables the free-model check; production callers (runtime, agent 10)
 * always pass it. A free-tier provider whose model is not in FREE_TIER_MODELS is blocked (fail closed).
 */
export function costDecision(id: string, policy: CostPolicy, models?: Readonly<Record<string, string>>): { allowed: boolean; reason: CostReason } {
  if (id !== WORKERS_AI && PROVIDER_BILLING[id] !== "free-tier") return { allowed: false, reason: "not_a_free_provider" };
  if (!policy.approvedFree.includes(id)) return { allowed: false, reason: "free_tier_not_approved" };
  // Rerank asks without `models` (its model and Neuron cap are fixed in budget.ts); every chat provider is model-checked.
  if (models && !(FREE_TIER_MODELS[id] ?? []).includes(models[id] ?? "")) return { allowed: false, reason: "model_not_verified_free" };
  return { allowed: true, reason: "approved_free_tier" };
}

/** What the gateway may use: AI_PROVIDER selection, then the zero-cost policy. */
export function permittedProviderIds(aiProvider: string, configured: readonly string[], policy: CostPolicy, models?: Readonly<Record<string, string>>): { active: string[]; blocked: { id: string; reason: CostReason }[] } {
  const active: string[] = [];
  const blocked: { id: string; reason: CostReason }[] = [];
  for (const id of activeProviderIds(aiProvider, configured)) {
    const d = costDecision(id, policy, models);
    if (d.allowed) active.push(id);
    else blocked.push({ id, reason: d.reason });
  }
  return { active, blocked };
}

/** AI_PROVIDER: disabled = none · auto = every provider with a key (fallback order from routing) · <id> = that one only. */
export function activeProviderIds(aiProvider: string, configured: readonly string[]): string[] {
  if (aiProvider === "disabled") return [];
  return aiProvider === "auto" ? [...configured] : configured.filter((id) => id === aiProvider);
}

const ID = /^[a-z0-9_-]{1,32}$/;

/** Builds routing from env values. Unknown/invalid input falls back to the defaults, never throws. */
export function resolveRouting(env: { order?: string; json?: string }): Routing {
  const routing: Routing = structuredClone(DEFAULT_ROUTING);
  if (env.order) {
    const ids = env.order.split(",").map((s) => s.trim().toLowerCase()).filter((s) => ID.test(s));
    if (ids.length) for (const t of TASKS) routing[t] = [...ids];
  }
  if (env.json) {
    try {
      const parsed = JSON.parse(env.json) as Record<string, unknown>;
      for (const t of TASKS) {
        const v = parsed[t];
        if (Array.isArray(v)) {
          const ids = v.filter((x): x is string => typeof x === "string" && ID.test(x));
          if (ids.length) routing[t as Task] = ids;
        }
      }
    } catch {
      /* ignore malformed override */
    }
  }
  return routing;
}

/**
 * Configuration problems worth a log line at start-up (names only, never values). Pure; exported for tests.
 *  - an AI_PROVIDER_ORDER / AI_ROUTING entry that is not a registered provider (typo or a removed provider),
 *  - AI_PROVIDER pinned to one provider whose API key is not set (the assistant then has no provider at all),
 *  - AI_PROVIDER=auto with no key set at all.
 */
export function configWarnings(input: {
  routing: Routing;
  catalog: { id: string; keyEnv: string; hasKey: boolean }[];
  aiProvider: string;
}): { event: string; meta: Record<string, unknown> }[] {
  const known = new Set(input.catalog.map((c) => c.id));
  const unknown = [...new Set(Object.values(input.routing).flat())].filter((id) => !known.has(id));
  const out: { event: string; meta: Record<string, unknown> }[] = [];
  if (unknown.length) out.push({ event: "ai.config.unknown_provider_in_routing", meta: { ids: unknown, known: [...known] } });
  const pinned = input.catalog.find((c) => c.id === input.aiProvider);
  if (pinned && !pinned.hasKey) out.push({ event: "ai.config.provider_key_missing", meta: { provider: pinned.id, missing: pinned.keyEnv } });
  if (input.aiProvider === "auto" && !input.catalog.some((c) => c.hasKey)) out.push({ event: "ai.config.no_provider_keys", meta: { expected: input.catalog.map((c) => c.keyEnv) } });
  return out;
}
