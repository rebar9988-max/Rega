/**
 * Operations engine core: the guards every inspection runs through. Pure (the store is injected), so duplicate runs,
 * quota exhaustion, timeouts, a database outage and agent crashes are unit-tested without a database.
 *
 * Order of guards for one execution:
 *   valid execution id -> idempotency (same id = the stored report, no second run) -> daily cap -> cool-down ->
 *   execution lock (one run per agent at a time) -> inspection with a time limit and one bounded retry -> report.
 * Anything failing BEFORE the inspection yields a BLOCKED report that is not stored (nothing was inspected);
 * an inspection that crashes or times out yields a stored FAIL report, so it shows up in the history.
 */
import type { AgentId, Check, Finding, Inspection, OpsReport, RunStatus } from "./types";

/**
 * Fixed caps (zero additional cost): the engine never exceeds these, whatever the owner clicks. They sit far inside the
 * included quotas of the Cloudflare Worker and D1 database the site already uses; no new service, binding, schedule or
 * paid provider exists. Account-wide usage/billing is not readable from the Worker, so it is reported, not claimed.
 */
export const OPS_LIMITS = Object.freeze({
  /** All agents together, per UTC day. */
  maxRunsPerDay: 100,
  /** From this many runs per day the cool-down below is stretched (protective throttling before the hard cap). */
  throttleFromRunsPerDay: 80,
  /** Minimum time between two runs of the same agent. */
  cooldownMs: 60_000,
  /** Cool-down once the throttle threshold is reached. */
  throttledCooldownMs: 15 * 60_000,
  /** A run holds the agent's lock at most this long (a crashed run frees it after this). */
  lockTtlMs: 2 * 60_000,
  /** Wall-clock limit of one inspection. */
  timeoutMs: 25_000,
  /** One retry, only for a transient failure, never for a timeout. */
  maxAttempts: 2,
  /** Live HTTP requests one agent may make per run (to www.rega24.com or a content link). */
  maxHttpRequests: 12,
  httpTimeoutMs: 6_000,
  /** All HTTP probes of one run end within this window (inside timeoutMs); later URLs are reported as not checked. */
  probeWindowMs: 18_000,
  /** Bytes read from one HTTP response body. */
  maxHttpBytes: 512 * 1024,
  /** Database rows any single query of an agent may return. */
  maxRowsPerQuery: 2_500,
  /** Findings and sample items kept in a stored report. */
  maxFindings: 40,
  maxItemsPerFinding: 12,
  /** Owner's "run all" stops starting new agents after this (worst case stays below Cloudflare's 100 s response limit). */
  runAllBudgetMs: 45_000,
});

export const EXECUTION_ID = /^[a-z0-9][a-z0-9-]{7,63}$/;

export function newExecutionId(agent: string, now = Date.now(), random = crypto.randomUUID()): string {
  return `${agent.slice(0, 24)}-${now.toString(36)}-${random.slice(0, 8)}`.toLowerCase();
}

/** Turns an inspection into counts, findings and recommended actions; status follows from the worst check. */
export function summarize(inspection: Inspection): Pick<OpsReport, "status" | "inspected_items" | "passed" | "warnings" | "failed" | "findings" | "recommended_actions" | "evidence"> {
  const checks = inspection.checks;
  const passed = checks.filter((c) => c.result === "pass" || c.result === "info").length;
  const warnings = checks.filter((c) => c.result === "warn").length;
  const failed = checks.filter((c) => c.result === "fail").length;
  const ran = checks.filter((c) => c.result !== "skip").length;
  const status: RunStatus = failed ? "FAIL" : warnings ? "WARN" : ran ? "PASS" : "SKIPPED";
  const rank: Record<string, number> = { fail: 0, warn: 1, info: 2, skip: 3 };
  const findings: Finding[] = checks
    .filter((c) => c.result !== "pass")
    .sort((a, b) => rank[a.result] - rank[b.result])
    .slice(0, OPS_LIMITS.maxFindings)
    .map(({ result, items, ...rest }: Check) => ({ ...rest, severity: result as Finding["severity"], ...(items?.length ? { items: items.slice(0, OPS_LIMITS.maxItemsPerFinding) } : {}) }));
  const recommended_actions = [...new Set(checks.filter((c) => (c.result === "warn" || c.result === "fail") && c.action).map((c) => c.action!))];
  return { status, inspected_items: inspection.inspected, passed, warnings, failed, findings, recommended_actions, evidence: inspection.evidence.slice(0, 40) };
}

const SUMMARY: Record<RunStatus, string> = {
  PASS: "هەموو پشکنینەکان سەرکەوتوو بوون.",
  WARN: "هەندێک خاڵ پێویستیان بە سەرنجی خاوەن هەیە.",
  FAIL: "کێشەی ڕاستەقینە دۆزرایەوە؛ پێداچوونەوە پێویستە.",
  SKIPPED: "لەم ژینگەیەدا هیچ پشکنینێک نەکرا.",
  BLOCKED: "جێبەجێکردن ڕاگیرا؛ هیچ شتێک نەپشکنرا.",
};

/** Sorani one-liner: the verdict plus the counts. */
export function sorani(report: Pick<OpsReport, "status" | "passed" | "warnings" | "failed">): string {
  if (report.status === "BLOCKED" || report.status === "SKIPPED") return SUMMARY[report.status];
  return `${SUMMARY[report.status]} سەرکەوتوو: ${report.passed} · ئاگاداری: ${report.warnings} · شکست: ${report.failed}`;
}

/** Persistence used by the engine (Prisma-backed in production, in-memory in tests). */
export interface OpsStore {
  findReport(executionId: string): Promise<OpsReport | null>;
  /** Stored runs (all agents) since the given time. */
  countRunsSince(since: Date): Promise<number>;
  lastRunAt(agent: AgentId): Promise<Date | null>;
  /** Atomic: true only if this execution now holds the agent's lock. Expired locks may be taken over. */
  acquireLock(agent: AgentId, executionId: string, ttlMs: number, now: Date): Promise<boolean>;
  releaseLock(agent: AgentId, executionId: string): Promise<void>;
  saveReport(report: OpsReport, actor: { id: string; email: string }): Promise<void>;
}

export type Inspect = (signal: AbortSignal) => Promise<Inspection>;

export type BlockReason = "invalid_execution_id" | "quota_exhausted" | "cooldown" | "locked" | "store_unavailable";

const BLOCK_TEXT: Record<BlockReason, string> = {
  invalid_execution_id: "ناسنامەی جێبەجێکردن نادروستە.",
  quota_exhausted: "سنووری ڕۆژانەی جێبەجێکردن گەیشت؛ بۆ پاراستنی تێچووی سفر ڕاگیرا.",
  cooldown: "ئەم بریکارە تازە کاری کردووە؛ کەمێک چاوەڕێ بکە.",
  locked: "ئەم بریکارە ئێستا لە کاردایە؛ جێبەجێکردنی دووبارە ڕێگری لێکرا.",
  store_unavailable: "بنکەدراوە بەردەست نییە؛ هیچ پشکنینێک نەکرا.",
};

export const BLOCK_REASONS = Object.keys(BLOCK_TEXT) as BlockReason[];
/** Owner-facing (Sorani) explanation of a refused run. */
export function blockMessage(reason: BlockReason): string {
  return BLOCK_TEXT[reason];
}

export type RunOutcome = { report: OpsReport; stored: boolean; reused: boolean; blocked?: BlockReason };

function blockedReport(agent: AgentId, executionId: string, now: Date, reason: BlockReason, quota = false): OpsReport {
  return {
    agent, execution_id: executionId, status: "BLOCKED", checked_at: now.toISOString(), duration_ms: 0, trigger: "owner_manual",
    inspected_items: 0, passed: 0, warnings: 0, failed: 0,
    findings: [{ code: `engine.${reason}`, severity: "warn", message: BLOCK_TEXT[reason] }],
    recommended_actions: [], evidence: [`engine: ${reason}`],
    cost_status: quota ? "QUOTA_PROTECTED" : "WITHIN_BOUNDED_FREE_CAPS",
    summary: `${SUMMARY.BLOCKED} ${BLOCK_TEXT[reason]}`,
  };
}

class TimeoutError extends Error {}

/** Runs `inspect` with a hard wall-clock limit; the signal tells the agent to stop issuing requests. */
export async function withTimeout(inspect: Inspect, ms: number): Promise<Inspection> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new TimeoutError(`inspection exceeded ${ms} ms`)); }, ms);
  });
  try {
    return await Promise.race([inspect(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export const startOfUtcDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** Executes one agent through every guard. Never throws: every path ends in a report. */
export async function runGuarded(params: {
  agent: AgentId;
  executionId: string;
  actor: { id: string; email: string };
  store: OpsStore;
  inspect: Inspect;
  now?: () => Date;
  limits?: Partial<Record<keyof typeof OPS_LIMITS, number>>;
}): Promise<RunOutcome> {
  const limits = { ...OPS_LIMITS, ...params.limits };
  const clock = params.now ?? (() => new Date());
  const { agent, executionId, store } = params;
  const started = clock();
  if (!EXECUTION_ID.test(executionId)) return { report: blockedReport(agent, "invalid", started, "invalid_execution_id"), stored: false, reused: false, blocked: "invalid_execution_id" };

  let locked = false;
  try {
    // Idempotency: a resubmitted form (double click, browser retry) returns the first result instead of running again.
    const existing = await store.findReport(executionId);
    if (existing) return { report: existing, stored: true, reused: true };

    const today = await store.countRunsSince(startOfUtcDay(started));
    if (today >= limits.maxRunsPerDay) return { report: blockedReport(agent, executionId, started, "quota_exhausted", true), stored: false, reused: false, blocked: "quota_exhausted" };
    const cooldown = today >= limits.throttleFromRunsPerDay ? limits.throttledCooldownMs : limits.cooldownMs;
    const last = await store.lastRunAt(agent);
    if (last && started.getTime() - last.getTime() < cooldown) return { report: blockedReport(agent, executionId, started, "cooldown", true), stored: false, reused: false, blocked: "cooldown" };

    locked = await store.acquireLock(agent, executionId, limits.lockTtlMs, started);
    if (!locked) return { report: blockedReport(agent, executionId, started, "locked"), stored: false, reused: false, blocked: "locked" };
  } catch {
    // Fail closed: without the store neither the quota nor the lock can be enforced.
    if (locked) await store.releaseLock(agent, executionId).catch(() => undefined);
    return { report: blockedReport(agent, executionId, started, "store_unavailable"), stored: false, reused: false, blocked: "store_unavailable" };
  }

  let report: OpsReport;
  try {
    let inspection: Inspection | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= limits.maxAttempts && !inspection; attempt++) {
      try {
        inspection = await withTimeout(params.inspect, limits.timeoutMs);
      } catch (error) {
        lastError = error;
        if (error instanceof TimeoutError) break; // a slow run is not retried (it would double the load)
      }
    }
    const finished = clock();
    if (inspection) {
      const s = summarize(inspection);
      report = { agent, execution_id: executionId, checked_at: finished.toISOString(), duration_ms: finished.getTime() - started.getTime(), trigger: "owner_manual", ...s, cost_status: "WITHIN_BOUNDED_FREE_CAPS", summary: sorani(s) };
    } else {
      const timedOut = lastError instanceof TimeoutError;
      report = {
        agent, execution_id: executionId, status: "FAIL", checked_at: finished.toISOString(), duration_ms: finished.getTime() - started.getTime(), trigger: "owner_manual",
        inspected_items: 0, passed: 0, warnings: 0, failed: 1,
        findings: [{ code: timedOut ? "engine.timeout" : "engine.error", severity: "fail", message: timedOut ? "پشکنین لە کاتی دیاریکراو تێپەڕی و ڕاگیرا." : "بریکارەکە بە هەڵە وەستا؛ هیچ داتایەک نەگۆڕدرا." }],
        recommended_actions: ["دواتر دووبارە هەوڵ بدەرەوە؛ ئەگەر بەردەوام بوو، لۆگی Worker بپشکنە."],
        // Only the error class: messages can contain query text.
        evidence: [`engine: ${timedOut ? "timeout" : lastError instanceof Error ? lastError.name : "error"}`],
        cost_status: "WITHIN_BOUNDED_FREE_CAPS",
        summary: SUMMARY.FAIL,
      };
    }
    try {
      await store.saveReport(report, params.actor);
      return { report, stored: true, reused: false };
    } catch {
      return { report, stored: false, reused: false };
    }
  } finally {
    await store.releaseLock(agent, executionId).catch(() => undefined);
  }
}

/** Helpers agents use to build checks consistently. */
export const check = {
  pass: (code: string, message: string, extra: Partial<Check> = {}): Check => ({ code, result: "pass", message, ...extra }),
  info: (code: string, message: string, extra: Partial<Check> = {}): Check => ({ code, result: "info", message, ...extra }),
  skip: (code: string, message: string, extra: Partial<Check> = {}): Check => ({ code, result: "skip", message, ...extra }),
  /** warn/fail when `items` is non-empty, else pass with `okMessage`. */
  items(code: string, items: { label: string; href?: string }[], bad: "warn" | "fail", message: string, okMessage: string, action?: string): Check {
    return items.length
      ? { code, result: bad, message, count: items.length, items, ...(action ? { action } : {}) }
      : { code, result: "pass", message: okMessage };
  },
};

