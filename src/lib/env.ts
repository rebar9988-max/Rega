/**
 * Shared environment access. SERVER ONLY for secrets.
 * Anything read through `serverEnv` must never be imported into a client component.
 */
import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  CANONICAL_HOST: z.string().default("www.regaplatform.com"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars"),
  AUTH_URL: z.string().url().optional(),
  // disabled | auto (default: every provider whose API key is set, with fallback) | gemini | grok | openai | groq | anthropic
  // (that provider only). Public use is additionally gated by the admin-controlled feature flag "public.aiSearch" (/dr/ai).
  AI_PROVIDER: z.enum(["disabled", "auto", "gemini", "grok", "openai", "groq", "anthropic"]).default("auto"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_BASE_URL: z.string().url().optional(),
  XAI_API_KEY: z.string().optional(),
  GROK_MODEL: z.string().min(1).default("grok-4"),
  GROK_BASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_BASE_URL: z.string().url().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),
  GROQ_BASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-4-5-20251001"),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  AI_PROVIDER_ORDER: z.string().max(200).optional(),
  AI_ROUTING: z.string().max(1000).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(2_000).max(60_000).default(20_000),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).default(5_000),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  MEDIA_PUBLIC_URL: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Address -> coordinates for the admin business form. "nominatim" speaks the Nominatim search API (default:
  // the public OpenStreetMap instance, used only for occasional admin lookups; set GEOCODING_URL for a
  // self-hosted or commercial Nominatim-compatible endpoint). "none" disables lookups: admins place the marker.
  GEOCODING_PROVIDER: z.enum(["nominatim", "none"]).default("nominatim"),
  GEOCODING_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  GEOCODING_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(20_000).default(6_000),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  // `KEY=` (empty) in a .env file means "unset", not "invalid".
  const parsed = serverSchema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}


/** True when all storage credentials are present. */
export function isStorageConfigured(): boolean {
  const env = serverEnv();
  return Boolean(
    env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY && env.MEDIA_PUBLIC_URL,
  );
}
