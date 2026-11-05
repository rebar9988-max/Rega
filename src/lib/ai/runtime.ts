/**
 * Server-side wiring: reads env, builds the configured providers and the singleton gateway.
 * Secrets are read here and passed into provider factories; they never appear in logs or responses.
 */
import "server-only";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { createGateway, type Gateway } from "./gateway";
import { createAnthropic } from "./providers/anthropic";
import { createGemini } from "./providers/gemini";
import { createDeepSeek, createGrok, createGroq, createOpenAi, createOpenRouter } from "./providers/openai-compatible";
import { prisma } from "@/lib/db";
import { BUDGET_KEYS, BUDGET_PROVIDER, rerankLimit, reserve, type UsageCounter } from "./budget";
import { WORKERS_AI, configWarnings, costDecision, parseIdList, permittedProviderIds, resolveRouting, type CostPolicy } from "./routing";
import type { AiProvider } from "./types";

/**
 * Provider registry: the single source of truth for which providers exist, their env names and defaults
 * (defaults live in lib/env.ts, routing order in routing.ts). To add another OpenAI-compatible vendor later:
 *   1. add its env vars to lib/env.ts (and AI_PROVIDER) and .env.example,
 *   2. add a factory next to the others in providers/openai-compatible.ts and one entry to catalog() below,
 *   3. add its id to DEFAULT_ROUTING and its key to the "Sync Worker runtime secrets" workflow.
 * tests/ai-gateway.test.ts fails if any of these places is missed.
 */
function catalog() {
  const env = serverEnv();
  return [
    { id: "gemini", label: "Google Gemini", model: env.GEMINI_MODEL, hasKey: Boolean(env.GEMINI_API_KEY), build: () => createGemini({ apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL, baseUrl: env.GEMINI_BASE_URL }), keyEnv: "GEMINI_API_KEY" },
    { id: "grok", label: "xAI Grok", model: env.GROK_MODEL, hasKey: Boolean(env.XAI_API_KEY), build: () => createGrok({ apiKey: env.XAI_API_KEY!, model: env.GROK_MODEL, baseUrl: env.GROK_BASE_URL }), keyEnv: "XAI_API_KEY" },
    { id: "openai", label: "OpenAI", model: env.OPENAI_MODEL, hasKey: Boolean(env.OPENAI_API_KEY), build: () => createOpenAi({ apiKey: env.OPENAI_API_KEY!, model: env.OPENAI_MODEL, baseUrl: env.OPENAI_BASE_URL }), keyEnv: "OPENAI_API_KEY" },
    { id: "groq", label: "Groq", model: env.GROQ_MODEL, hasKey: Boolean(env.GROQ_API_KEY), build: () => createGroq({ apiKey: env.GROQ_API_KEY!, model: env.GROQ_MODEL, baseUrl: env.GROQ_BASE_URL }), keyEnv: "GROQ_API_KEY" },
    { id: "deepseek", label: "DeepSeek", model: env.DEEPSEEK_MODEL, hasKey: Boolean(env.DEEPSEEK_API_KEY), build: () => createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY!, model: env.DEEPSEEK_MODEL, baseUrl: env.DEEPSEEK_BASE_URL }), keyEnv: "DEEPSEEK_API_KEY" },
    { id: "openrouter", label: "OpenRouter", model: env.OPENROUTER_MODEL, hasKey: Boolean(env.OPENROUTER_API_KEY), build: () => createOpenRouter({ apiKey: env.OPENROUTER_API_KEY!, model: env.OPENROUTER_MODEL, baseUrl: env.OPENROUTER_BASE_URL, siteUrl: `https://${env.CANONICAL_HOST}` }), keyEnv: "OPENROUTER_API_KEY" },
    { id: "anthropic", label: "Anthropic Claude", model: env.ANTHROPIC_MODEL, hasKey: Boolean(env.ANTHROPIC_API_KEY), build: () => createAnthropic({ apiKey: env.ANTHROPIC_API_KEY!, model: env.ANTHROPIC_MODEL, baseUrl: env.ANTHROPIC_BASE_URL }), keyEnv: "ANTHROPIC_API_KEY" },
  ];
}

/** For the dashboard: which providers exist and whether a key is present. Never returns key values. */
export function providerCatalog() {
  return catalog().map(({ id, label, model, hasKey }) => ({ id, label, model, hasKey }));
}

/** Provider id → configured model (model names only; used by the free-model check). */
export function configuredModels(): Record<string, string> {
  return Object.fromEntries(catalog().map((c) => [c.id, c.model]));
}

/** The owner's zero-cost policy (provider ids only; never secrets). */
export function costPolicy(): CostPolicy {
  const env = serverEnv();
  return { approvedFree: parseIdList(env.AI_FREE_TIER_APPROVED), approvedPaid: parseIdList(env.AI_PAID_APPROVED) };
}

/**
 * AI_PROVIDER (disabled | auto | <id>) selects among providers with a key; the zero-cost policy then drops every
 * provider the owner has not approved. Only the remaining ones are built, so routing, fallback and probes cannot reach
 * a blocked provider.
 */
function activeProviders(): AiProvider[] {
  const keyed = catalog().filter((c) => c.hasKey);
  const { active } = permittedProviderIds(serverEnv().AI_PROVIDER, keyed.map((c) => c.id), costPolicy(), configuredModels());
  return keyed.filter((c) => active.includes(c.id)).map((c) => c.build());
}

/** Atomic daily counter in AiUsageDaily (provider "_budget"): one statement, no read-modify-write (D1 and Postgres). */
export const usageCounter: UsageCounter = {
  async increment(day, key) {
    const rows = await prisma.$queryRaw<{ requests: number | bigint }[]>`INSERT INTO "AiUsageDaily" ("id", "day", "provider", "model", "requests", "tokensIn", "tokensOut")
      VALUES (${crypto.randomUUID()}, ${day}, ${BUDGET_PROVIDER}, ${key}, 1, 0, 0)
      ON CONFLICT ("day", "provider", "model") DO UPDATE SET "requests" = "AiUsageDaily"."requests" + 1
      RETURNING "requests"`;
    const used = Number(rows[0]?.requests);
    if (!Number.isFinite(used)) throw new Error("ai_budget_counter_invalid");
    return used;
  },
};

/** One model attempt (any provider, fallback or probe) against AI_DAILY_LIMIT. */
export function reserveModelAttempt(): Promise<boolean> {
  return reserve(usageCounter, BUDGET_KEYS.modelAttempts, serverEnv().AI_DAILY_LIMIT);
}

/** Workers AI is used only when the owner approved `workers-ai`; calls are capped below the verified free allowance. */
export function workersAiAllowed(): boolean {
  return costDecision(WORKERS_AI, costPolicy()).allowed;
}
export function rerankDailyLimit(): number {
  return rerankLimit(serverEnv().AI_RERANK_DAILY_LIMIT);
}
export function reserveRerank(): Promise<boolean> {
  return reserve(usageCounter, BUDGET_KEYS.workersAiRerank, rerankDailyLimit());
}

let gateway: Gateway | null = null;

export function getGateway(): Gateway {
  if (gateway) return gateway;
  const env = serverEnv();
  const routing = resolveRouting({ order: env.AI_PROVIDER_ORDER, json: env.AI_ROUTING });
  // Once per instance: say which setting is wrong (names only) instead of failing silently later.
  for (const w of configWarnings({ routing, catalog: catalog(), aiProvider: env.AI_PROVIDER })) log.warn(w.event, w.meta);
  const { blocked } = permittedProviderIds(env.AI_PROVIDER, catalog().filter((c) => c.hasKey).map((c) => c.id), costPolicy(), configuredModels());
  if (blocked.length) log.warn("ai.cost.providers_blocked", { blocked: blocked.map((b) => `${b.id}:${b.reason}`) });
  gateway = createGateway({
    providers: activeProviders(),
    routing,
    timeoutMs: env.AI_TIMEOUT_MS,
    logger: log,
    reserve: () => reserveModelAttempt(),
  });
  return gateway;
}

export function isAiConfigured(): boolean {
  return activeProviders().length > 0;
}

// --- Daily request budget (cost guard). In memory: resets on restart, which only ever errs towards allowing.
let budgetDay = "";
let budgetCount = 0;

/** Counts one request against today's budget; false once AI_DAILY_LIMIT is reached. */
export function dailyBudgetAllows(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) { budgetDay = today; budgetCount = 0; }
  budgetCount += 1;
  return budgetCount <= serverEnv().AI_DAILY_LIMIT;
}
