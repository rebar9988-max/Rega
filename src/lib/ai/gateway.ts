import { GatewayError, ProviderError, scrub, toProviderError } from "./errors";
import type { AiProvider, Attempt, GatewayLogger, GenerateRequest, GenerateResult, Routing } from "./types";

export type GatewayOptions = {
  providers: AiProvider[];
  /** Ordered provider ids per task. First healthy provider wins; the rest are fallbacks. */
  routing: Routing;
  /** Per-provider call timeout. */
  timeoutMs?: number;
  /** Upper bound for the whole request including fallbacks. */
  totalTimeoutMs?: number;
  /** Consecutive failures before a provider is skipped for `cooldownMs`. */
  breakerThreshold?: number;
  cooldownMs?: number;
  logger?: GatewayLogger;
  now?: () => number;
};

type Health = { failures: number; openUntil: number; lastKind?: string; lastAt?: number };

const NOOP: GatewayLogger = { info() {}, warn() {}, error() {} };
/** Failure kinds that indicate the provider itself is unhealthy (and should trip the breaker). */
const UNHEALTHY = new Set(["timeout", "rate_limit", "auth", "server", "network"]);

export type ProviderStatus = { id: string; label: string; model: string; tasks: readonly string[]; circuit: "closed" | "open"; failures: number; lastFailure?: string };

export function createGateway(options: GatewayOptions) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const totalTimeoutMs = options.totalTimeoutMs ?? timeoutMs * 2;
  const threshold = options.breakerThreshold ?? 3;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const log = options.logger ?? NOOP;
  const now = options.now ?? Date.now;
  const byId = new Map(options.providers.map((p) => [p.id, p]));
  const health = new Map<string, Health>();
  const h = (id: string): Health => health.get(id) ?? (health.set(id, { failures: 0, openUntil: 0 }), health.get(id)!);

  function candidates(task: GenerateRequest["task"]): AiProvider[] {
    const t = now();
    return (options.routing[task] ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is AiProvider => Boolean(p) && p!.tasks.includes(task) && h(p!.id).openUntil <= t);
  }

  function recordFailure(id: string, err: ProviderError) {
    const state = h(id);
    state.lastKind = err.kind;
    state.lastAt = now();
    if (!UNHEALTHY.has(err.kind)) return; // a blocked/empty answer says nothing about provider health
    state.failures += 1;
    if (err.retryAfterMs || state.failures >= threshold) {
      state.openUntil = now() + Math.max(cooldownMs, err.retryAfterMs ?? 0);
      log.warn("ai.gateway.circuit_open", { provider: id, kind: err.kind, cooldownMs: state.openUntil - now() });
    }
  }

  async function generate(request: GenerateRequest): Promise<GenerateResult> {
    const list = candidates(request.task);
    if (list.length === 0) throw new GatewayError("no_provider");

    const deadline = now() + totalTimeoutMs;
    const attempts: Attempt[] = [];

    for (const provider of list) {
      const remaining = deadline - now();
      if (remaining <= 0) break;
      const started = now();
      // Own controller + timer (instead of AbortSignal.timeout) so the timer is cleared as soon as the call ends.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(Object.assign(new Error("timeout"), { name: "TimeoutError" })), Math.min(timeoutMs, remaining));
      try {
        const output = await provider.generate(request, { signal: controller.signal });
        const latencyMs = now() - started;
        const state = h(provider.id);
        state.failures = 0;
        state.openUntil = 0;
        attempts.push({ provider: provider.id, ok: true, latencyMs });
        if (attempts.length > 1) log.warn("ai.gateway.fallback_used", { task: request.task, served_by: provider.id, attempts: attempts.map((a) => `${a.provider}:${a.ok ? "ok" : a.kind}`) });
        return { ...output, provider: provider.id, latencyMs: attempts.reduce((sum, a) => sum + a.latencyMs, 0), attempts };
      } catch (raw) {
        const err = toProviderError(raw);
        const latencyMs = now() - started;
        attempts.push({ provider: provider.id, ok: false, kind: err.kind, status: err.status, latencyMs });
        recordFailure(provider.id, err);
        // Only kind/status/scrubbed text is logged: never prompts, keys or raw bodies.
        log.warn("ai.gateway.provider_failed", { provider: provider.id, task: request.task, kind: err.kind, status: err.status, detail: scrub(err.providerMessage, 160) });
      } finally {
        clearTimeout(timer);
      }
    }
    log.error("ai.gateway.all_failed", { task: request.task, attempts: attempts.map((a) => `${a.provider}:${a.kind}`) });
    throw new GatewayError("all_failed", attempts);
  }

  function status(): ProviderStatus[] {
    const t = now();
    return options.providers.map((p) => {
      const s = h(p.id);
      return { id: p.id, label: p.label, model: p.model, tasks: p.tasks, circuit: s.openUntil > t ? "open" : "closed", failures: s.failures, lastFailure: s.lastKind };
    });
  }

  /** Health probe for the dashboard: one tiny real call, bypassing routing and the breaker. Returns no content. */
  async function probe(id: string): Promise<{ ok: boolean; kind?: string; latencyMs: number }> {
    const provider = byId.get(id);
    if (!provider) return { ok: false, kind: "not_configured", latencyMs: 0 };
    const started = now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(Object.assign(new Error("timeout"), { name: "TimeoutError" })), timeoutMs);
    try {
      await provider.generate({ task: "classify", system: "Reply with the single word: ok", messages: [{ role: "user", content: "ping" }], maxOutputTokens: 16, temperature: 0 }, { signal: controller.signal });
      return { ok: true, latencyMs: now() - started };
    } catch (raw) {
      const err = toProviderError(raw);
      log.warn("ai.gateway.probe_failed", { provider: id, kind: err.kind, status: err.status, detail: scrub(err.providerMessage, 160) });
      return { ok: false, kind: err.kind, latencyMs: now() - started };
    } finally {
      clearTimeout(timer);
    }
  }

  return { generate, status, probe, providerIds: () => options.providers.map((p) => p.id) };
}

export type Gateway = ReturnType<typeof createGateway>;
