import { TASKS, type Routing, type Task } from "./types";

/**
 * Default task routing. Order = preference; later entries are fallbacks. Every task lists ALL providers, so no
 * single vendor is a point of failure, and a provider without a configured key is simply skipped.
 *  - chat / translate: Gemini first (strongest Kurdish/Arabic script handling), then OpenAI, Grok and Groq.
 *  - summarize: Groq first (fastest, cheapest), Gemini and OpenAI behind it.
 *  - classify: Groq, then Grok (short, latency-sensitive), then Gemini and OpenAI.
 *  - every task then falls back to DeepSeek (low cost), then OpenRouter (one key reaching many vendors' models,
 *    independent of the direct vendor accounts above).
 *  - Anthropic Claude is the last fallback for every task, so adding its key never changes who serves first.
 * Override without code changes: AI_ROUTING='{"chat":["openai","gemini"]}' (JSON, per task) or
 * AI_PROVIDER_ORDER="gemini,grok" (same order for every task).
 */
export const DEFAULT_ROUTING: Routing = {
  chat: ["gemini", "openai", "grok", "groq", "deepseek", "openrouter", "anthropic"],
  translate: ["gemini", "openai", "grok", "groq", "deepseek", "openrouter", "anthropic"],
  summarize: ["groq", "gemini", "openai", "grok", "deepseek", "openrouter", "anthropic"],
  classify: ["groq", "grok", "gemini", "openai", "deepseek", "openrouter", "anthropic"],
};

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
