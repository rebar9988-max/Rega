/**
 * PM-01 zero-cost guarantee: the AI must fail closed rather than incur an unauthorized cost.
 * Pure modules are exercised directly; server-only wiring is checked at source level (as tests/ai-gateway.test.ts does).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createGateway } from "../src/lib/ai/gateway";
import { GatewayError, ProviderError } from "../src/lib/ai/errors";
import { DEFAULT_ROUTING, PROVIDER_BILLING, WORKERS_AI, costDecision, parseIdList, permittedProviderIds, type CostPolicy } from "../src/lib/ai/routing";
import { BUDGET_KEYS, RERANK_DAILY_CAP, RERANK_WORST_NEURONS, WORKERS_AI_LIMITS, rerankLimit, reserve, type UsageCounter } from "../src/lib/ai/budget";
import type { AiProvider, Task } from "../src/lib/ai/types";

const ALL = Object.keys(PROVIDER_BILLING);
const PAID = ALL.filter((id) => PROVIDER_BILLING[id] === "paid");
const NONE: CostPolicy = { approvedFree: [], approvedPaid: [] };
const FREE: CostPolicy = { approvedFree: ["gemini", "groq"], approvedPaid: [] };

/** In-memory atomic counter (a single synchronous step per increment, like one SQL statement). */
function memoryCounter(): UsageCounter & { calls: number } {
  const values = new Map<string, number>();
  return {
    calls: 0,
    async increment(day, key) {
      this.calls++;
      await Promise.resolve();
      const k = `${day.toISOString().slice(0, 10)}:${key}`;
      const next = (values.get(k) ?? 0) + 1;
      values.set(k, next);
      return next;
    },
  };
}

type Fake = AiProvider & { calls: number };
function fake(id: string, behaviour: "ok" | "rate_limit" | "server" = "ok"): Fake {
  const tasks: readonly Task[] = ["chat", "summarize", "translate", "classify"];
  return {
    id, label: id, model: `${id}-model`, tasks, calls: 0,
    async generate() {
      this.calls++;
      if (behaviour === "rate_limit") throw new ProviderError("rate_limit", 429);
      if (behaviour === "server") throw new ProviderError("server", 500);
      return { content: "ok", model: `${id}-model`, usage: { tokensIn: 1, tokensOut: 1 } };
    },
  };
}

/** Builds the gateway exactly as runtime.ts does: only permitted providers exist. */
function gatewayFor(keyed: Fake[], policy: CostPolicy, opts: { aiProvider?: string; counter?: UsageCounter; limit?: number } = {}) {
  const { active } = permittedProviderIds(opts.aiProvider ?? "auto", keyed.map((p) => p.id), policy);
  const counter = opts.counter ?? memoryCounter();
  return createGateway({
    providers: keyed.filter((p) => active.includes(p.id)),
    routing: DEFAULT_ROUTING,
    breakerThreshold: 1,
    reserve: () => reserve(counter, BUDGET_KEYS.modelAttempts, opts.limit ?? 100),
  });
}
const ask = { task: "chat" as const, system: "s", messages: [{ role: "user" as const, content: "q" }] };

test("paid providers are blocked unless the owner approves them explicitly", () => {
  assert.deepEqual(permittedProviderIds("auto", ALL, NONE).active, [], "keys alone activate nothing");
  assert.deepEqual(permittedProviderIds("auto", ALL, FREE).active.sort(), ["gemini", "groq"]);
  for (const id of PAID) {
    assert.equal(costDecision(id, FREE).allowed, false, `${id} blocked`);
    assert.equal(costDecision(id, { approvedFree: [id], approvedPaid: [] }).reason, "paid_not_approved", `${id} cannot be smuggled in as free tier`);
    assert.equal(costDecision(id, { approvedFree: [], approvedPaid: [id] }).allowed, true, `${id} only with explicit paid approval`);
  }
  assert.equal(costDecision("unknown-vendor", { approvedFree: ["unknown-vendor"], approvedPaid: [] }).allowed, false, "unknown billing = paid");
  assert.deepEqual(permittedProviderIds("openai", ALL, FREE).active, [], "pinning a paid provider does not bypass the policy");
});

test("free-tier providers also need approval (nothing is assumed free)", () => {
  assert.equal(costDecision("gemini", NONE).reason, "free_tier_not_approved");
  assert.equal(costDecision(WORKERS_AI, NONE).allowed, false);
  assert.equal(costDecision(WORKERS_AI, { approvedFree: [WORKERS_AI], approvedPaid: [] }).allowed, true);
});

test("missing or invalid configuration fails closed", () => {
  assert.deepEqual(parseIdList(undefined), []);
  assert.deepEqual(parseIdList(" Gemini , , groq;drop, gemini, ${x} "), ["gemini"], "malformed ids are ignored, duplicates removed");
  assert.deepEqual(permittedProviderIds("disabled", ALL, FREE).active, []);
  assert.throws(() => { throw new GatewayError("no_provider"); });
});

test("no fallback to a paid provider when the free tier is exhausted", async () => {
  const gemini = fake("gemini", "rate_limit");
  const groq = fake("groq", "rate_limit");
  const paid = PAID.map((id) => fake(id));
  const gw = gatewayFor([gemini, groq, ...paid], FREE);
  await assert.rejects(gw.generate(ask), (e: unknown) => e instanceof GatewayError && e.code === "all_failed");
  assert.equal(gemini.calls + groq.calls, 2);
  for (const p of paid) assert.equal(p.calls, 0, `${p.id} never called`);
  // Quota exhausted: the breaker is open, the next request finds no provider and still calls nothing paid.
  await assert.rejects(gw.generate(ask), (e: unknown) => e instanceof GatewayError && e.code === "no_provider");
  for (const p of paid) assert.equal(p.calls, 0);
});

test("every attempt, fallbacks included, is reserved before the call; the cap stops calls", async () => {
  const counter = memoryCounter();
  const gemini = fake("gemini", "server");
  const groq = fake("groq");
  const gw = gatewayFor([gemini, groq], FREE, { counter, limit: 3 });
  assert.equal((await gw.generate(ask)).provider, "groq");
  assert.equal(counter.calls, 2, "failed gemini attempt + groq answer");
  // gemini's breaker is open (threshold 1): the next request uses one unit; the one after finds the cap reached.
  assert.equal((await gw.generate(ask)).provider, "groq");
  const before = groq.calls;
  await assert.rejects(gw.generate(ask), (e: unknown) => e instanceof GatewayError && e.code === "budget_exceeded");
  assert.equal(groq.calls, before, "no provider call after the cap");
});

test("concurrent requests never exceed the daily limit", async () => {
  const counter = memoryCounter();
  const granted = await Promise.all(Array.from({ length: 200 }, () => reserve(counter, BUDGET_KEYS.modelAttempts, 25)));
  assert.equal(granted.filter(Boolean).length, 25);
  const groq = fake("groq");
  const gw = gatewayFor([groq], FREE, { counter: memoryCounter(), limit: 10 });
  const results = await Promise.allSettled(Array.from({ length: 40 }, () => gw.generate(ask)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 10);
  assert.equal(groq.calls, 10);
});

test("the budget resets per UTC day and fails closed without accounting", async () => {
  const counter = memoryCounter();
  const d1 = new Date("2026-11-04T23:59:00Z");
  const d2 = new Date("2026-11-05T00:00:30Z");
  assert.equal(await reserve(counter, "k", 1, d1), true);
  assert.equal(await reserve(counter, "k", 1, d1), false);
  assert.equal(await reserve(counter, "k", 1, d2), true, "new UTC day");
  const broken: UsageCounter = { increment: async () => { throw new Error("D1 unavailable"); } };
  assert.equal(await reserve(broken, "k", 100), false, "store down = no call");
  assert.equal(await reserve({ increment: async () => Number.NaN }, "k", 100), false);
  assert.equal(await reserve(counter, "zero", 0), false, "limit 0 = disabled");
  const groq = fake("groq");
  const gw = createGateway({ providers: [groq], routing: DEFAULT_ROUTING, reserve: () => reserve(broken, "k", 100) });
  await assert.rejects(gw.generate(ask), (e: unknown) => e instanceof GatewayError && e.code === "budget_exceeded");
  assert.equal(groq.calls, 0);
});

test("admin probes count against the budget and cannot reach blocked providers", async () => {
  const counter = memoryCounter();
  const gemini = fake("gemini");
  const openai = fake("openai");
  const gw = gatewayFor([gemini, openai], FREE, { counter, limit: 1 });
  assert.equal((await gw.probe("openai")).kind, "not_configured", "blocked provider is not even built");
  assert.equal(openai.calls, 0);
  assert.equal((await gw.probe("gemini")).ok, true);
  assert.deepEqual(await gw.probe("gemini"), { ok: false, kind: "budget_exceeded", latencyMs: 0 });
  assert.equal(gemini.calls, 1);
});

test("Workers AI cap is derived from the verified free allowance and can only be lowered", () => {
  assert.equal(WORKERS_AI_LIMITS.freeNeuronsPerDay, 10_000);
  assert.equal(RERANK_WORST_NEURONS, 34);
  assert.equal(RERANK_DAILY_CAP, 250);
  assert.ok(RERANK_DAILY_CAP * RERANK_WORST_NEURONS <= WORKERS_AI_LIMITS.freeNeuronsPerDay * WORKERS_AI_LIMITS.shareOfFreeAllowance);
  assert.equal(rerankLimit(undefined), 250);
  assert.equal(rerankLimit(10_000), 250, "cannot be raised above the verified cap");
  assert.equal(rerankLimit(40), 40);
  assert.equal(rerankLimit(0), 0);
});

test("Workers AI quota: the rerank cap holds under concurrency", async () => {
  const counter = memoryCounter();
  const granted = await Promise.all(Array.from({ length: 400 }, () => reserve(counter, BUDGET_KEYS.workersAiRerank, rerankLimit(undefined))));
  assert.equal(granted.filter(Boolean).length, RERANK_DAILY_CAP);
});

test("the reservation SQL is atomic on the real D1 schema", async () => {
  const runtime = readFileSync("src/lib/ai/runtime.ts", "utf8");
  const raw = runtime.match(/\$queryRaw<[^`]*>`([^`]+)`/)?.[1];
  assert.ok(raw && /ON CONFLICT \("day", "provider", "model"\) DO UPDATE SET "requests" = "AiUsageDaily"\."requests" \+ 1/.test(raw) && /RETURNING "requests"/.test(raw));
  const sql = raw.replace(/\$\{[^}]+\}/g, "?");
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  const ddl = readFileSync("prisma/d1/migrations/0001_initial.sql", "utf8");
  db.exec(ddl.match(/CREATE TABLE "AiUsageDaily" \([^;]+;/)![0]);
  db.exec(ddl.match(/CREATE UNIQUE INDEX "AiUsageDaily_day_provider_model_key"[^;]+;/)![0]);
  const day = Date.UTC(2026, 10, 4);
  const stmt = db.prepare(sql);
  const values = Array.from({ length: 30 }, (_, i) => Number((stmt.get(`id-${i}`, day, "_budget", "model-attempts") as { requests: number }).requests));
  assert.deepEqual(values, Array.from({ length: 30 }, (_, i) => i + 1), "each statement returns its own unique count");
  assert.equal(Number((db.prepare('SELECT COUNT(*) AS n FROM "AiUsageDaily"').get() as { n: number }).n), 1);
});

test("wiring: runtime reserves every attempt, rerank is gated, budget rows stay out of statistics", () => {
  const runtime = readFileSync("src/lib/ai/runtime.ts", "utf8");
  assert.match(runtime, /reserve: \(\) => reserveModelAttempt\(\)/);
  assert.match(runtime, /permittedProviderIds\(serverEnv\(\)\.AI_PROVIDER/);
  const python = readFileSync("src/lib/ai/python-runtime.ts", "utf8");
  const gate = python.indexOf("workersAiAllowed()");
  const reserved = python.indexOf("reserveRerank()");
  assert.ok(gate > 0 && reserved > gate && python.indexOf("rerankWithService(") > reserved, "approval, then reservation, then the Workers AI call");
  for (const f of ["src/app/dr/ai/page.tsx", "src/lib/ops/agents.ts"]) {
    const lines = readFileSync(f, "utf8").split("\n").filter((l) => l.includes("aiUsageDaily.aggregate("));
    assert.ok(lines.length > 0, f);
    for (const l of lines) assert.match(l, /provider: \{ not: BUDGET_PROVIDER \}/, f);
  }
  assert.match(readFileSync("src/lib/ai/chat.ts", "utf8"), /hits\.length === 0[\s\S]*no-match[\s\S]*isAiConfigured\(\)[\s\S]*getGateway\(\)\.generate/, "no-match answers before any model");
  assert.match(readFileSync("src/app/api/v1/ai/chat/route.ts", "utf8"), /budget_exceeded" \? 429/, "budget exhaustion is a clean 429");
});

test("background agents never call a model or Workers AI", () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p); } };
  walk("src/lib/ops");
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), /getGateway|\.generate\(|rerankWithPython|rerankWithService|reserveModelAttempt|reserveRerank/, f);
  assert.doesNotMatch(readFileSync(".github/workflows/production-health.yml", "utf8"), /api\/v1\/ai\/chat/, "scheduled health check does not call the assistant");
});
