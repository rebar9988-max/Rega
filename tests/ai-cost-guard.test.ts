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
import { DEFAULT_ROUTING, FREE_TIER_MODELS, PROVIDER_BILLING, WORKERS_AI, costDecision, parseIdList, permittedProviderIds, type CostPolicy } from "../src/lib/ai/routing";
import { BUDGET_KEYS, RERANK_DAILY_CAP, RERANK_WORST_NEURONS, WORKERS_AI_CHAT, WORKERS_AI_LIMITS, WORKERS_AI_NEURON_BUDGET, chatWorstNeurons, rerankLimit, reserve, type UsageCounter } from "../src/lib/ai/budget";
import { createWorkersAi, workersAiError } from "../src/lib/ai/providers/workers-ai";
import { generateWithService } from "../src/lib/ai/python-client";
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
    async increment(day, key, amount) {
      this.calls++;
      await Promise.resolve();
      const k = `${day.toISOString().slice(0, 10)}:${key}`;
      const next = (values.get(k) ?? 0) + (amount ?? 1);
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

test("free-tier approval serves only verified free models (no paid model via GEMINI_MODEL / GROQ_MODEL)", () => {
  const verified = { gemini: "gemini-3.5-flash-lite", groq: "openai/gpt-oss-120b" };
  assert.deepEqual(permittedProviderIds("auto", ["gemini", "groq"], FREE, verified).active, ["gemini", "groq"]);
  for (const model of ["gemini-3.8-pro", "gemini-3.6-flash", "", "GEMINI-3.5-FLASH-LITE"]) {
    const r = permittedProviderIds("auto", ["gemini"], FREE, { gemini: model });
    assert.deepEqual(r.active, [], `${model || "(empty)"} blocked`);
    assert.equal(r.blocked[0].reason, "model_not_verified_free");
  }
  assert.deepEqual(permittedProviderIds("auto", ["gemini"], FREE, {}).active, [], "unknown model = blocked");
  const wai = { approvedFree: [WORKERS_AI], approvedPaid: [] };
  assert.equal(costDecision(WORKERS_AI, wai).allowed, true, "rerank (no model map): its model and Neuron cost are fixed in budget.ts");
  assert.equal(costDecision(WORKERS_AI, wai, { "workers-ai": "@cf/google/gemma-4-26b-a4b-it" }).allowed, true, "chat with the verified free model");
  assert.equal(costDecision(WORKERS_AI, wai, { "workers-ai": "@cf/moonshotai/kimi-k2.6" }).reason, "model_not_verified_free", "a Workers-Paid-only model is blocked");
  for (const [id, models] of Object.entries(FREE_TIER_MODELS)) {
    assert.equal(PROVIDER_BILLING[id], "free-tier", `${id} allow-list belongs to a free-tier provider`);
    assert.ok(models.length > 0);
  }
  // The runtime and agent 10 always pass the configured models (the check cannot be skipped in production).
  assert.match(readFileSync("src/lib/ai/runtime.ts", "utf8"), /permittedProviderIds\(serverEnv\(\)\.AI_PROVIDER, keyed\.map\(\(c\) => c\.id\), costPolicy\(\), configuredModels\(\)\)/);
  assert.match(readFileSync("src/lib/ops/analyzers/ai.ts", "utf8"), /permittedProviderIds\(f\.provider, f\.configuredProviders, policy, f\.models\)/);
});

test("the daily model-attempt limit defaults to 500", () => {
  assert.match(readFileSync("src/lib/env.ts", "utf8"), /AI_DAILY_LIMIT: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.default\(500\)/);
  assert.match(readFileSync(".env.example", "utf8"), /^AI_DAILY_LIMIT=500$/m);
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
  assert.ok(raw && /ON CONFLICT \("day", "provider", "model"\) DO UPDATE SET "requests" = "AiUsageDaily"\."requests" \+ \$\{amount\}/.test(raw) && /RETURNING "requests"/.test(raw));
  const sql = raw.replace(/\$\{[^}]+\}/g, "?");
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  const ddl = readFileSync("prisma/d1/migrations/0001_initial.sql", "utf8");
  db.exec(ddl.match(/CREATE TABLE "AiUsageDaily" \([^;]+;/)![0]);
  db.exec(ddl.match(/CREATE UNIQUE INDEX "AiUsageDaily_day_provider_model_key"[^;]+;/)![0]);
  const day = Date.UTC(2026, 10, 4);
  const stmt = db.prepare(sql);
  const values = Array.from({ length: 30 }, (_, i) => Number((stmt.get(`id-${i}`, day, "_budget", "model-attempts", 1, 1) as { requests: number }).requests));
  assert.deepEqual(values, Array.from({ length: 30 }, (_, i) => i + 1), "each statement returns its own unique count");
  // Neuron reservations add their amount in the same single statement.
  const neurons = [34, 120, 34].map((n, i) => Number((stmt.get(`n-${i}`, day, "_budget", "workers-ai-neurons", n, n) as { requests: number }).requests));
  assert.deepEqual(neurons, [34, 154, 188]);
  assert.equal(Number((db.prepare('SELECT COUNT(*) AS n FROM "AiUsageDaily"').get() as { n: number }).n), 2, "one row per counter key");
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

test("Workers AI: one shared Neuron budget, worst case reserved before every call, fail closed", async () => {
  assert.equal(WORKERS_AI_NEURON_BUDGET, 8_500);
  assert.equal(chatWorstNeurons(0, 1024), Math.ceil((1024 * WORKERS_AI_CHAT.neuronsPerMillionOutput) / 1e6));
  assert.equal(chatWorstNeurons(10_000, 1024), Math.ceil((20_000 * 9_091 + 1024 * 27_273) / 1e6));
  const counter = memoryCounter();
  let runs = 0;
  const provider = createWorkersAi({
    model: WORKERS_AI_CHAT.model,
    run: async () => { runs++; return { response: " antwort ", usage: { prompt_tokens: 10, completion_tokens: 2 } }; },
    reserveNeurons: (n) => reserve(counter, BUDGET_KEYS.workersAiNeurons, WORKERS_AI_NEURON_BUDGET, new Date(), n),
    worstNeurons: chatWorstNeurons,
  });
  const signal = new AbortController().signal;
  const out = await provider.generate(ask, { signal });
  assert.deepEqual(out, { content: "antwort", model: WORKERS_AI_CHAT.model, usage: { tokensIn: 10, tokensOut: 2 } });
  // Rerank and chat draw from the same budget concurrently; the total never passes it.
  const per = chatWorstNeurons(ask.system.length + 1, 1024);
  const results = await Promise.allSettled(Array.from({ length: 400 }, (_, i) => i % 2 ? provider.generate(ask, { signal }) : reserve(counter, BUDGET_KEYS.workersAiNeurons, WORKERS_AI_NEURON_BUDGET, new Date(), RERANK_WORST_NEURONS)));
  const chats = results.filter((r, i) => i % 2 && r.status === "fulfilled").length;
  const reranks = results.filter((r, i) => !(i % 2) && r.status === "fulfilled" && r.value === true).length;
  assert.ok(per + chats * per + reranks * RERANK_WORST_NEURONS <= WORKERS_AI_NEURON_BUDGET, "spent ≤ budget");
  assert.equal(runs, 1 + chats, "no model call without a reservation");
  // Exhausted or unreadable budget: quota error, binding never called.
  const before = runs;
  const refused = createWorkersAi({ model: WORKERS_AI_CHAT.model, run: async () => { runs++; return { response: "x" }; }, reserveNeurons: async () => false, worstNeurons: chatWorstNeurons });
  await assert.rejects(refused.generate(ask, { signal }), (e: unknown) => e instanceof ProviderError && e.kind === "quota");
  assert.equal(runs, before);
});

test("Workers AI: errors map to safe kinds, empty answers and timeouts end the attempt", async () => {
  assert.equal(workersAiError(new Error("4006: you have used up your daily free allocation of 10,000 neurons")).kind, "quota");
  assert.equal(workersAiError(new Error("3040: Capacity temporarily exceeded")).kind, "rate_limit");
  assert.equal(workersAiError(new Error("5035: model requires the Workers Paid plan")).kind, "auth");
  assert.equal(workersAiError(new Error("boom")).kind, "server");
  const base = { model: WORKERS_AI_CHAT.model, reserveNeurons: async () => true, worstNeurons: chatWorstNeurons };
  await assert.rejects(createWorkersAi({ ...base, run: async () => ({ response: "  " }) }).generate(ask, { signal: new AbortController().signal }), (e: unknown) => e instanceof ProviderError && e.kind === "empty");
  const ctrl = new AbortController();
  const slow = createWorkersAi({ ...base, run: () => new Promise((r) => setTimeout(() => r({ response: "late" }), 1000)) }).generate(ask, { signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(slow, (e: unknown) => e instanceof Error && e.name === "TimeoutError");
  // OpenAI-style answers from newer models are read too.
  const chat = await createWorkersAi({ ...base, run: async () => ({ choices: [{ message: { content: "ok" } }] }) }).generate(ask, { signal: new AbortController().signal });
  assert.equal(chat.content, "ok");
});

test("Workers AI via rega-ai-python: token-authenticated call, only status and code surface on failure", async () => {
  let url = ""; let init: RequestInit = {};
  const ok = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ ok: true, model: WORKERS_AI_CHAT.model, content: "silav", usage: { tokensIn: 5, tokensOut: 1 } }), { status: 200 }); }) as unknown as typeof fetch;
  const cfg = { baseUrl: "https://ai.internal/", token: "t".repeat(32), timeoutMs: 1000 };
  const out = await generateWithService({ ...cfg, fetchImpl: ok }, WORKERS_AI_CHAT.model, { messages: [{ role: "user", content: "hi" }], max_tokens: 64 });
  assert.deepEqual(out, { response: "silav", usage: { prompt_tokens: 5, completion_tokens: 1 } });
  assert.equal(url, "https://ai.internal/v1/generate");
  assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${"t".repeat(32)}`);
  assert.equal(JSON.parse(init.body as string).model, WORKERS_AI_CHAT.model);
  const quota = (async () => new Response(JSON.stringify({ ok: false, error: { code: "quota" } }), { status: 429 })) as unknown as typeof fetch;
  const err = await generateWithService({ ...cfg, fetchImpl: quota }, WORKERS_AI_CHAT.model, {}).catch((e: unknown) => e);
  assert.equal(workersAiError(err).kind, "quota");
  const html = (async () => new Response("<html>bad gateway</html>", { status: 502 })) as unknown as typeof fetch;
  const bad = await generateWithService({ ...cfg, fetchImpl: html }, WORKERS_AI_CHAT.model, {}).catch((e: unknown) => e);
  assert.equal((bad as Error).message, "502 generate_failed", "no body text leaks");
});
