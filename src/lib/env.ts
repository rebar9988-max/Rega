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
  // disabled | auto (default: every provider whose API key is set, with fallback) | gemini | grok | openai | groq | deepseek |
  // openrouter | anthropic (that provider only). Public use is additionally gated by the admin-controlled feature flag
  // "public.aiSearch" (/dr/ai).
  AI_PROVIDER: z.enum(["disabled", "auto", "gemini", "grok", "openai", "groq", "deepseek", "openrouter", "anthropic"]).default("auto"),
  // Model defaults: vendor-listed, non-deprecated ids, checked against each vendor's models/deprecations page on
  // 2026-10-01 (see README "AI Gateway"). Any *_MODEL variable overrides its default without a code change.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  GEMINI_BASE_URL: z.string().url().optional(),
  XAI_API_KEY: z.string().optional(),
  GROK_MODEL: z.string().min(1).default("grok-4.7"),
  GROK_BASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_BASE_URL: z.string().url().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),
  GROQ_BASE_URL: z.string().url().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-flash"),
  DEEPSEEK_BASE_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().min(1).default("google/gemini-3.5-flash-lite"),
  OPENROUTER_BASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-4-5-20251001"),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  AI_PROVIDER_ORDER: z.string().max(200).optional(),
  AI_ROUTING: z.string().max(1000).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(2_000).max(60_000).default(20_000),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).default(5_000),
  // Optional internal Python AI engine. It is server-to-server only and failure-isolated from the normal AI gateway.
  AI_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_TOKEN: z.string().min(24).optional(),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(250).max(5_000).default(1_500),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  MEDIA_PUBLIC_URL: z.string().optional(),
  // E-mail (verification, password reset, contact + report notifications). "none" = nothing is sent.
  EMAIL_PROVIDER: z.enum(["none", "resend"]).default("none"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("REGA Platform <noreply@regaplatform.com>"),
  // Where contact messages and content reports are announced.
  CONTACT_INBOX: z.string().email().default("info@regaplatform.com"),
  // Section registry overrides: comma-separated section keys (config/sections.ts), no code change needed.
  SECTIONS_ENABLED: z.string().max(200).optional(),
  SECTIONS_DISABLED: z.string().max(200).optional(),
  // Error monitoring hook: when set, logged errors are POSTed there (JSON). Off when unset.
  ERROR_WEBHOOK_URL: z.string().url().optional(),
  // Optional OAuth sign-in (not enabled in this build; see docs/adr/0006-oauth-deferred.md).
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  // Operator details of the legal pages (public, not secret; src/config/owner.ts).
  LEGAL_OPERATOR_TYPE: z.string().max(120).optional(),
  LEGAL_NAME: z.string().max(200).optional(),
  LEGAL_RESPONSIBLE_PERSON: z.string().max(200).optional(),
  LEGAL_STREET_ADDRESS: z.string().max(200).optional(),
  LEGAL_POSTAL_CODE_CITY: z.string().max(200).optional(),
  LEGAL_COUNTRY: z.string().max(100).optional(),
  LEGAL_PUBLIC_EMAIL: z.string().email().optional(),
  LEGAL_PHONE: z.string().max(50).optional(),
  LEGAL_VAT_ID: z.string().max(60).optional(),
  LEGAL_TRADE_REGISTER: z.string().max(200).optional(),
  LEGAL_AI_PROVIDER: z.string().max(200).optional(),
  LEGAL_HOSTING_PROVIDER: z.string().max(200).optional(),
  LEGAL_ANALYTICS_TOOL: z.string().max(200).optional(),
  LEGAL_EMAIL_PROVIDER: z.string().max(200).optional(),
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
