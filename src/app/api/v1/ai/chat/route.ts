/**
 * POST /api/v1/ai/chat — REGA AI endpoint.
 * Provider credentials stay server-side (src/lib/ai). The browser never sees a key.
 * Layered protection: feature flag → input validation → per-session and per-IP rate limits
 * → daily budget → gateway (timeout, fallback, circuit breaker).
 */
import type { NextRequest } from "next/server";
import { fail, handleError, ok } from "@/lib/api";
import { currentUser } from "@/lib/auth-helpers";
import { AiNotConfiguredError, GatewayError, chat } from "@/lib/ai";
import { aiChatSchema } from "@/lib/validation";
import { isEnabled } from "@/lib/flags";
import { allow, allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const PER_SESSION = 12;
const PER_IP = 30;
const MAX_BODY_BYTES = 64_000;

export async function POST(request: NextRequest) {
  try {
    if (!(await isEnabled("public.aiSearch"))) {
      return fail(503, "feature_disabled", "The REGA assistant is not enabled.");
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, "payload_too_large", "The request is too large.");
    const payload = aiChatSchema.parse(JSON.parse(raw));
    const user = await currentUser();
    const ip = clientIp(request.headers);

    if (!allow(`ai:s:${user?.id ?? payload.sessionId}`, PER_SESSION, WINDOW_MS) || !(await allowShared("AI_LIMITER", `ai:ip:${ip}`, PER_IP, WINDOW_MS))) {
      return fail(429, "rate_limited", "Too many requests. Please wait a moment.");
    }

    const result = await chat({
      messages: payload.messages.map((m) => ({ role: m.role, content: m.content })),
      locale: payload.locale,
      sessionId: payload.sessionId,
      userId: user?.id ?? null,
    });

    return ok({ content: result.content, provider: result.provider, model: result.model, latencyMs: result.latencyMs });
  } catch (error) {
    if (error instanceof AiNotConfiguredError || (error instanceof GatewayError && error.code === "no_provider")) {
      return fail(503, "ai_not_configured", "REGA AI is not configured on this server.");
    }
    if (error instanceof GatewayError) {
      // Providers are down/exhausted: a clear, retryable answer instead of a generic 500.
      log.error("ai.chat.unavailable", { code: error.code, attempts: error.attempts.map((a) => `${a.provider}:${a.kind}`) });
      return fail(error.code === "budget_exceeded" ? 429 : 502, error.code === "budget_exceeded" ? "budget_exceeded" : "ai_unavailable", "REGA AI is temporarily unavailable. Please try again shortly.");
    }
    if (error instanceof SyntaxError) return fail(400, "invalid_json", "The request body must be valid JSON.");
    return handleError(error, "ai.chat");
  }
}
