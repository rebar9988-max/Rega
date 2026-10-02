import type { Attempt, FailureKind } from "./types";

/** A provider call failed. `providerMessage` is already scrubbed and safe to log. */
export class ProviderError extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly status?: number,
    readonly providerMessage = "",
    /** Provider-suggested wait (ms) before it should be called again (from Retry-After). */
    readonly retryAfterMs?: number,
  ) {
    super(`provider_${kind}`);
  }
}

/** Every eligible provider failed, or none was eligible. */
export class GatewayError extends Error {
  constructor(
    readonly code: "no_provider" | "all_failed" | "budget_exceeded",
    readonly attempts: Attempt[] = [],
  ) {
    super(`gateway_${code}`);
  }
}

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API keys
  /xai-[0-9A-Za-z_-]{16,}/gi, // xAI keys
  /gsk_[0-9A-Za-z]{16,}/g, // Groq keys
  /sk-[0-9A-Za-z_-]{16,}/g, // OpenAI-style / OpenRouter keys
  /Bearer\s+[0-9A-Za-z._~+/=-]{8,}/gi,
  /([?&](?:key|api_key|apikey|token)=)[^&\s"']+/gi,
];

/** Removes anything that looks like a credential and truncates. Apply to every string that may be logged. */
export function scrub(text: string, max = 300): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, (_m, p1) => (typeof p1 === "string" ? `${p1}[redacted]` : "[redacted]"));
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

/** Maps an HTTP status to a failure kind. */
export function kindForStatus(status: number): FailureKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "quota"; // balance/credits exhausted: unhealthy until topped up
  if (status === 429) return "rate_limit";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  return "bad_request";
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 0), 120) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.min(Math.max(at - Date.now(), 0), 120_000);
}

/** Normalises anything thrown by fetch/abort into a ProviderError. */
export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const name = (error as { name?: string })?.name;
  if (name === "TimeoutError" || name === "AbortError") return new ProviderError("timeout");
  return new ProviderError("network", undefined, scrub(error instanceof Error ? error.message : String(error), 120));
}
