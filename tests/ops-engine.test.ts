import test from "node:test";
import assert from "node:assert/strict";
import { OPS_LIMITS, newExecutionId, runGuarded, summarize, type OpsStore } from "../src/lib/ops/core";
import type { AgentId, Inspection, OpsReport } from "../src/lib/ops/types";
import { ProbeBudget, htmlLangDir, probe, scriptSources } from "../src/lib/ops/probe";

/** In-memory store with the same contract as the Prisma store (atomic lock, idempotent reports). */
function memoryStore(opts: { failOn?: keyof OpsStore } = {}) {
  const reports: { report: OpsReport; at: Date }[] = [];
  const locks = new Map<string, { executionId: string; at: number }>();
  const guard = (name: keyof OpsStore) => { if (opts.failOn === name) throw new Error("D1_ERROR: database unavailable"); };
  const store: OpsStore & { reports: typeof reports; locks: typeof locks } = {
    reports, locks,
    async findReport(id) { guard("findReport"); return reports.find((r) => r.report.execution_id === id)?.report ?? null; },
    async countRunsSince(since) { guard("countRunsSince"); return reports.filter((r) => r.at >= since).length; },
    async lastRunAt(agent) { guard("lastRunAt"); return reports.filter((r) => r.report.agent === agent).at(-1)?.at ?? null; },
    async acquireLock(agent, executionId, ttl, now) {
      guard("acquireLock");
      const held = locks.get(agent);
      if (held && now.getTime() - held.at < ttl) return false;
      locks.set(agent, { executionId, at: now.getTime() });
      return true;
    },
    async releaseLock(agent, executionId) { if (locks.get(agent)?.executionId === executionId) locks.delete(agent); },
    async saveReport(report) { guard("saveReport"); reports.push({ report, at: new Date(report.checked_at) }); },
  };
  return store;
}

const actor = { id: "owner", email: "rebar9988@gmail.com" };
const agent: AgentId = "business-inspector";
const okInspection: Inspection = { inspected: 3, checks: [{ code: "a", result: "pass", message: "ok" }, { code: "b", result: "warn", message: "w", action: "do x" }, { code: "c", result: "info", message: "i" }], evidence: ["D1 test"] };

test("summarize: status follows the worst check; info counts as passed; actions are de-duplicated", () => {
  const s = summarize({ inspected: 2, checks: [...okInspection.checks, { code: "d", result: "warn", message: "w2", action: "do x" }], evidence: [] });
  assert.equal(s.status, "WARN");
  assert.equal(s.passed, 2);
  assert.equal(s.warnings, 2);
  assert.deepEqual(s.recommended_actions, ["do x"]);
  assert.equal(s.findings[0].severity, "warn");
  assert.equal(summarize({ inspected: 0, checks: [{ code: "x", result: "fail", message: "f" }], evidence: [] }).status, "FAIL");
  assert.equal(summarize({ inspected: 0, checks: [{ code: "x", result: "skip", message: "s" }], evidence: [] }).status, "SKIPPED");
  assert.equal(summarize({ inspected: 1, checks: [{ code: "x", result: "pass", message: "p" }], evidence: [] }).status, "PASS");
});

test("a normal run produces the owner's report shape, with a Sorani summary, and is stored", async () => {
  const store = memoryStore();
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => okInspection });
  assert.equal(out.stored, true);
  const r = out.report;
  for (const key of ["agent", "execution_id", "status", "checked_at", "inspected_items", "passed", "warnings", "failed", "findings", "recommended_actions", "evidence", "cost_status"]) assert.ok(key in r, key);
  assert.equal(r.status, "WARN");
  assert.equal(r.cost_status, "WITHIN_BOUNDED_FREE_CAPS");
  assert.match(r.summary, /[؀-ۿ]/);
  assert.ok(!Number.isNaN(Date.parse(r.checked_at)));
  assert.equal(store.locks.size, 0, "lock released after the run");
});

test("duplicate execution: the same execution id never runs twice (idempotent)", async () => {
  const store = memoryStore();
  let runs = 0;
  const id = newExecutionId(agent);
  const inspect = async () => { runs++; return okInspection; };
  const first = await runGuarded({ agent, executionId: id, actor, store, inspect });
  const second = await runGuarded({ agent, executionId: id, actor, store, inspect, limits: { cooldownMs: 0 } });
  assert.equal(runs, 1);
  assert.equal(second.reused, true);
  assert.deepEqual(second.report, first.report);
  assert.equal(store.reports.length, 1);
});

test("concurrent runs of one agent: the second is BLOCKED by the execution lock", async () => {
  const store = memoryStore();
  let release!: () => void;
  const slow = () => new Promise<Inspection>((resolve) => { release = () => resolve(okInspection); });
  const a = runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: slow, limits: { cooldownMs: 0 } });
  await new Promise((r) => setTimeout(r, 5));
  const b = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => okInspection, limits: { cooldownMs: 0 } });
  assert.equal(b.report.status, "BLOCKED");
  assert.equal(b.blocked, "locked");
  assert.equal(b.stored, false);
  release();
  assert.equal((await a).report.status, "WARN");
  // A different agent is not blocked by that lock.
  const c = await runGuarded({ agent: "category-inspector", executionId: newExecutionId("category-inspector"), actor, store, inspect: async () => okInspection });
  assert.equal(c.report.status, "WARN");
});

test("an expired lock (crashed run) is taken over; a live one is not", async () => {
  const store = memoryStore();
  const now = new Date("2026-10-29T10:00:00Z");
  store.locks.set(agent, { executionId: "crashed-run-0001", at: now.getTime() - OPS_LIMITS.lockTtlMs - 1 });
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => okInspection, now: () => now });
  assert.notEqual(out.report.status, "BLOCKED");
});

test("quota exhausted: BLOCKED with QUOTA_PROTECTED, the inspection never runs, nothing is stored", async () => {
  const store = memoryStore();
  let ran = false;
  const day = new Date("2026-10-29T12:00:00Z");
  for (let i = 0; i < OPS_LIMITS.maxRunsPerDay; i++) store.reports.push({ report: { agent: "qa-automation", execution_id: `seed-run-${i}x` } as OpsReport, at: day });
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => { ran = true; return okInspection; }, now: () => day });
  assert.equal(out.report.status, "BLOCKED");
  assert.equal(out.blocked, "quota_exhausted");
  assert.equal(out.report.cost_status, "QUOTA_PROTECTED");
  assert.equal(ran, false);
  assert.equal(store.reports.length, OPS_LIMITS.maxRunsPerDay);
});

test("protective throttling: near the daily cap the cool-down is stretched", async () => {
  const store = memoryStore();
  const day = new Date("2026-10-29T12:00:00Z");
  for (let i = 0; i < OPS_LIMITS.throttleFromRunsPerDay; i++) store.reports.push({ report: { agent: "qa-automation", execution_id: `seed-run-${i}x` } as OpsReport, at: day });
  store.reports.push({ report: { agent, execution_id: "last-run-0001" } as OpsReport, at: new Date(day.getTime() - 5 * 60_000) });
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => okInspection, now: () => day });
  assert.equal(out.blocked, "cooldown", "5 minutes is inside the throttled 15-minute cool-down");
  const fresh = memoryStore();
  fresh.reports.push({ report: { agent, execution_id: "last-run-0001" } as OpsReport, at: new Date(day.getTime() - 5 * 60_000) });
  assert.notEqual((await runGuarded({ agent, executionId: newExecutionId(agent), actor, store: fresh, inspect: async () => okInspection, now: () => day })).report.status, "BLOCKED");
});

test("database unavailable: fail closed (BLOCKED, no inspection) when quota/lock cannot be checked", async () => {
  for (const failOn of ["findReport", "countRunsSince", "lastRunAt", "acquireLock"] as const) {
    let ran = false;
    const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store: memoryStore({ failOn }), inspect: async () => { ran = true; return okInspection; } });
    assert.equal(out.report.status, "BLOCKED", failOn);
    assert.equal(out.blocked, "store_unavailable", failOn);
    assert.equal(ran, false, failOn);
  }
});

test("report cannot be saved: the run still answers, marked as not stored, and the lock is released", async () => {
  const store = memoryStore({ failOn: "saveReport" });
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => okInspection });
  assert.equal(out.stored, false);
  assert.equal(store.locks.size, 0);
});

test("agent crash: one bounded retry, then a stored FAIL report without the error message", async () => {
  const store = memoryStore();
  let attempts = 0;
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store, inspect: async () => { attempts++; throw new Error("SELECT secret FROM x"); } });
  assert.equal(attempts, OPS_LIMITS.maxAttempts);
  assert.equal(out.report.status, "FAIL");
  assert.equal(out.report.findings[0].code, "engine.error");
  assert.doesNotMatch(JSON.stringify(out.report), /SELECT secret/);
  assert.equal(out.stored, true);
  assert.equal(store.locks.size, 0);
});

test("a transient failure succeeds on the retry", async () => {
  let attempts = 0;
  const out = await runGuarded({ agent, executionId: newExecutionId(agent), actor, store: memoryStore(), inspect: async () => { if (++attempts === 1) throw new Error("transient"); return okInspection; } });
  assert.equal(attempts, 2);
  assert.equal(out.report.status, "WARN");
});

test("timeout: the inspection is aborted, not retried, and reported as FAIL", async () => {
  let attempts = 0;
  let aborted = false;
  const out = await runGuarded({
    agent, executionId: newExecutionId(agent), actor, store: memoryStore(), limits: { timeoutMs: 30 },
    inspect: (signal) => { attempts++; signal.addEventListener("abort", () => { aborted = true; }); return new Promise<Inspection>(() => undefined); },
  });
  assert.equal(out.report.findings[0].code, "engine.timeout");
  assert.equal(attempts, 1);
  assert.equal(aborted, true);
});

test("invalid execution ids are refused before anything is read", async () => {
  for (const id of ["", "x", "DROP TABLE", "a".repeat(80), "../../etc"]) {
    const out = await runGuarded({ agent, executionId: id, actor, store: memoryStore({ failOn: "findReport" }), inspect: async () => okInspection });
    assert.equal(out.blocked, "invalid_execution_id", id);
  }
  assert.match(newExecutionId("ai-discovery-inspector"), /^[a-z0-9][a-z0-9-]{7,63}$/);
});

test("probe: request budget, no credentials, manual redirects, body cap, timeout", async () => {
  const seen: RequestInit[] = [];
  const fetcher = async (_url: string, init?: RequestInit) => { seen.push(init!); return new Response("<html lang=\"ckb-IQ\" dir=\"rtl\"><script src=\"/_next/a.js\"></script></html>", { status: 200, headers: { "x-test": "1" } }); };
  const budget = new ProbeBudget(2);
  const a = await probe("https://www.rega24.com/ckb", { budget, fetcher });
  const b = await probe("https://www.rega24.com/en", { budget, fetcher });
  const c = await probe("https://www.rega24.com/de", { budget, fetcher });
  assert.equal(a.status, 200);
  assert.equal(b.ok, true);
  assert.equal(c.error, "budget");
  assert.equal(seen.length, 2, "the third request was never sent");
  assert.deepEqual(Object.keys(seen[0].headers as Record<string, string>).sort(), ["accept", "user-agent"], "no cookie or authorization header");
  assert.equal(seen[0].redirect, "manual");
  assert.deepEqual(htmlLangDir(a.body), { lang: "ckb-IQ", dir: "rtl" });
  assert.deepEqual(scriptSources(a.body), ["/_next/a.js"]);
  const big = await probe("https://x.test/", { budget: new ProbeBudget(), fetcher: async () => new Response("a".repeat(OPS_LIMITS.maxHttpBytes + 10)) });
  assert.equal(big.truncated, true);
  const hang = await probe("https://x.test/", { budget: new ProbeBudget(), timeoutMs: 20, fetcher: (_u, init) => new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted")))) });
  assert.equal(hang.error, "timeout");
  const down = await probe("https://x.test/", { budget: new ProbeBudget(), fetcher: async () => { throw new TypeError("fetch failed"); } });
  assert.equal(down.error, "network");
});

test("zero-cost caps are fixed and conservative", () => {
  assert.ok(OPS_LIMITS.maxRunsPerDay <= 100);
  assert.ok(OPS_LIMITS.throttleFromRunsPerDay < OPS_LIMITS.maxRunsPerDay);
  assert.ok(OPS_LIMITS.maxHttpRequests <= 12);
  assert.ok(OPS_LIMITS.maxRowsPerQuery <= 2_500);
  assert.ok(OPS_LIMITS.maxAttempts <= 2);
  assert.ok(OPS_LIMITS.timeoutMs <= 30_000);
  assert.ok(Object.isFrozen(OPS_LIMITS));
});

test("probe origin: always the canonical site in production; loopback override only outside production", async () => {
  const src = (await import("node:fs")).readFileSync("src/lib/ops/agents.ts", "utf8");
  // agents.ts is server-only; the rule is exercised on its exact source to stay import-free.
  const fn = /export function probeOrigin[\s\S]*?\n}\n/.exec(src)![0].replace("export ", "").replace(/: \{ APP_ENV: string; CANONICAL_HOST: string \}/, "").replace(" = process.env.OPS_PROBE_ORIGIN", "").replace(/\): string \{/, ") {");
  const probeOrigin = new Function(`${fn}; return probeOrigin;`)() as (env: { APP_ENV: string; CANONICAL_HOST: string }, o?: string) => string;
  const prod = { APP_ENV: "production", CANONICAL_HOST: "www.rega24.com" };
  assert.equal(probeOrigin(prod, undefined), "https://www.rega24.com");
  assert.equal(probeOrigin(prod, "http://localhost:3111"), "https://www.rega24.com", "never redirected in production");
  const dev = { APP_ENV: "development", CANONICAL_HOST: "www.rega24.com" };
  assert.equal(probeOrigin(dev, "http://localhost:3111"), "http://localhost:3111");
  for (const bad of ["https://evil.example", "http://169.254.169.254", "http://localhost.evil.example", "file:///etc/passwd"]) assert.equal(probeOrigin(dev, bad), "https://www.rega24.com", bad);
});

test("probe deadline: URLs after the run's probe window are not sent and are reported as not checked", async () => {
  let sent = 0;
  let t = 0;
  const clock = () => t;
  const fetcher = async () => { sent++; t += 4_000; return new Response("ok"); };
  const budget = new ProbeBudget(12);
  const deadline = 10_000;
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await probe(`https://x.test/${i}`, { budget, fetcher, clock, deadline }));
  assert.equal(sent, 3, "0 s, 4 s, 8 s are sent; at 12 s the window is over");
  assert.deepEqual(results.map((r) => r.error ?? r.status), [200, 200, 200, "budget", "budget"]);
});
