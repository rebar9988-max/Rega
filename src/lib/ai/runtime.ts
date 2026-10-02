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
import { configWarnings, resolveRouting } from "./routing";
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

function buildProviders(): AiProvider[] {
  return catalog().filter((c) => c.hasKey).map((c) => c.build());
}

/** AI_PROVIDER: disabled | auto (all configured, with fallback) | <provider id> (only that one, no fallback). */
function activeProviders(): AiProvider[] {
  const env = serverEnv();
  if (env.AI_PROVIDER === "disabled") return [];
  const all = buildProviders();
  return env.AI_PROVIDER === "auto" ? all : all.filter((p) => p.id === env.AI_PROVIDER);
}

let gateway: Gateway | null = null;

export function getGateway(): Gateway {
  if (gateway) return gateway;
  const env = serverEnv();
  const routing = resolveRouting({ order: env.AI_PROVIDER_ORDER, json: env.AI_ROUTING });
  // Once per instance: say which setting is wrong (names only) instead of failing silently later.
  for (const w of configWarnings({ routing, catalog: catalog(), aiProvider: env.AI_PROVIDER })) log.warn(w.event, w.meta);
  gateway = createGateway({
    providers: activeProviders(),
    routing,
    timeoutMs: env.AI_TIMEOUT_MS,
    logger: log,
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
