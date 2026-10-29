/**
 * Bounded HTTP probes for the QA, performance, security and content agents. Pure (fetch is injectable for tests).
 * Hard limits: a request budget per run, a per-request timeout, a body-size cap, no retries, no redirects followed
 * silently, no cookies or credentials sent (only the headers set below). Probes only GET/HEAD public URLs.
 */
import { OPS_LIMITS } from "./core";

export type ProbeResult = {
  url: string;
  ok: boolean;
  status: number;
  /** Time until response headers arrived. */
  ttfbMs: number;
  totalMs: number;
  bytes: number;
  truncated: boolean;
  headers: Record<string, string>;
  body: string;
  /** Network error / timeout / budget, never a message that could contain data. */
  error?: "timeout" | "network" | "budget" | "aborted";
};

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Identifies the inspector in logs and WAF analytics. */
export const PROBE_USER_AGENT = "REGA24-Operations-Inspector/1.0 (+https://www.rega24.com; owner-triggered, read-only)";

export class ProbeBudget {
  used = 0;
  constructor(readonly max: number = OPS_LIMITS.maxHttpRequests) {}
  take(): boolean {
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }
}

export async function probe(url: string, opts: { budget: ProbeBudget; signal?: AbortSignal; method?: "GET" | "HEAD"; fetcher?: Fetcher; timeoutMs?: number; readBody?: boolean; clock?: () => number; deadline?: number }): Promise<ProbeResult> {
  const clock = opts.clock ?? (() => Date.now());
  const empty = (error: ProbeResult["error"], start = clock()): ProbeResult => ({ url, ok: false, status: 0, ttfbMs: 0, totalMs: clock() - start, bytes: 0, truncated: false, headers: {}, body: "", error });
  if (opts.signal?.aborted) return empty("aborted");
  // Past the run's probe window: not sent, reported as not checked (partial results are kept).
  const remaining = opts.deadline === undefined ? Infinity : opts.deadline - clock();
  if (remaining < 500 || !opts.budget.take()) return empty("budget");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), Math.min(opts.timeoutMs ?? OPS_LIMITS.httpTimeoutMs, remaining));
  const start = clock();
  try {
    const response = await (opts.fetcher ?? fetch)(url, {
      method: opts.method ?? "GET",
      // No cookies or authorization are ever attached: a Worker subrequest carries only these headers.
      redirect: "manual",
      headers: { "user-agent": PROBE_USER_AGENT, accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.5" },
      signal: controller.signal,
    });
    const ttfbMs = clock() - start;
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    let body = "";
    let bytes = 0;
    let truncated = false;
    if (opts.readBody !== false && opts.method !== "HEAD" && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > OPS_LIMITS.maxHttpBytes) { truncated = true; await reader.cancel().catch(() => undefined); break; }
        body += decoder.decode(value, { stream: true });
      }
    } else {
      await response.body?.cancel().catch(() => undefined);
    }
    return { url, ok: response.status >= 200 && response.status < 400, status: response.status, ttfbMs, totalMs: clock() - start, bytes, truncated, headers, body };
  } catch {
    return empty(controller.signal.aborted ? (opts.signal?.aborted ? "aborted" : "timeout") : "network", start);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/** `<html lang="…" dir="…">` of a page. */
export function htmlLangDir(html: string): { lang: string | null; dir: string | null } {
  const tag = /<html\b[^>]*>/i.exec(html)?.[0] ?? "";
  return { lang: /\blang="([^"]+)"/i.exec(tag)?.[1] ?? null, dir: /\bdir="([^"]+)"/i.exec(tag)?.[1] ?? null };
}

/** External script files a page loads. */
export function scriptSources(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]);
}
