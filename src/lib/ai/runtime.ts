/**
 * Server-side wiring: reads env, builds the configured providers and the singleton gateway.
 * Secrets are read here and passed into provider factories; they never appear in logs or responses.
 */
import "server-only";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { createGateway, type Gateway } from "./gateway";
import { createGemini } from "./providers/gemini";
import { createGrok, createGroq, createOpenAi } from "./providers/openai-compatible";
import { resolveRouting } from "./routing";
import type { AiProvider } from "./types";

/**
 * Provider registry. To add Groq / Mistral / OpenRouter later:
 *   1. add its env vars to lib/env.ts,
 *   2. add one entry to catalog() below (createOpenAiCompatible({ id, label, baseUrl, apiKey, model })),
 *   3. mention its id in AI_PROVIDER_ORDER / AI_ROUTING. Nothing else changes.
 */
function catalog() {
  const env = serverEnv();
  return [
    { id: "gemini", label: "Google Gemini", model: env.GEMINI_MODEL, hasKey: Boolean(env.GEMINI_API_KEY), build: () => createGemini({ apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL, baseUrl: env.GEMINI_BASE_URL }) },
    { id: "grok", label: "xAI Grok", model: env.GROK_MODEL, hasKey: Boolean(env.XAI_API_KEY), build: () => createGrok({ apiKey: env.XAI_API_KEY!, model: env.GROK_MODEL, baseUrl: env.GROK_BASE_URL }) },
    { id: "openai", label: "OpenAI", model: env.OPENAI_MODEL, hasKey: Boolean(env.OPENAI_API_KEY), build: () => createOpenAi({ apiKey: env.OPENAI_API_KEY!, model: env.OPENAI_MODEL, baseUrl: env.OPENAI_BASE_URL }) },
    { id: "groq", label: "Groq", model: env.GROQ_MODEL, hasKey: Boolean(env.GROQ_API_KEY), build: () => createGroq({ apiKey: env.GROQ_API_KEY!, model: env.GROQ_MODEL, baseUrl: env.GROQ_BASE_URL }) },
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
  gateway = createGateway({
    providers: activeProviders(),
    routing: resolveRouting({ order: env.AI_PROVIDER_ORDER, json: env.AI_ROUTING }),
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
