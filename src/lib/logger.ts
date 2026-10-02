/** Structured JSON logger. Server-side only. Never log secrets. */
import "server-only";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT = /(key|secret|token|password|authorization|credential)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const min = ORDER[(process.env.LOG_LEVEL as Level) || "info"] ?? ORDER.info;
  if (ORDER[level] < min) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    app: "rega",
    env: process.env.APP_ENV || process.env.NODE_ENV,
    message,
    ...(meta ? { meta: redact(meta) as Record<string, unknown> } : {}),
  });
  if (level === "error") reportError(message, meta);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Error monitoring hook: with ERROR_WEBHOOK_URL set, every logged error is also POSTed there as JSON (redacted meta,
 * never request bodies). Off when the variable is unset; a failing hook never affects the request.
 */
function reportError(message: string, meta?: Record<string, unknown>) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: "rega", env: process.env.APP_ENV || process.env.NODE_ENV, message, meta: meta ? redact(meta) : undefined, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(3_000),
    }).catch(() => undefined);
  } catch {
    /* monitoring must never break the app */
  }
}

export const log = {
  debug: (m: string, meta?: Record<string, unknown>) => emit("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => emit("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => emit("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => emit("error", m, meta),
};
