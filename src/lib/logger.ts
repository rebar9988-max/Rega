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
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (m: string, meta?: Record<string, unknown>) => emit("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => emit("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => emit("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => emit("error", m, meta),
};
