import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROBE_MAX_OUTPUT_TOKENS, createGateway } from "../src/lib/ai/gateway";
import { GatewayError, ProviderError, kindForStatus, scrub } from "../src/lib/ai/errors";
import { createGemini } from "../src/lib/ai/providers/gemini";
import { createGroq, createOpenRouter, groqReasoningEffort } from "../src/lib/ai/providers/openai-compatible";
import { configWarnings, resolveRouting, DEFAULT_ROUTING } from "../src/lib/ai/routing";
import type { AiProvider, FailureKind, GenerateRequest } from "../src/lib/ai/types";

const req: GenerateRequest = { task: "chat", system: "sys", messages: [{ role: "user", content: "hi" }] };
const ROUTING = { ...DEFAULT_ROUTING, chat: ["a", "b"] };

function fake(id: string, behaviour: () => Promise<string>): AiProvider & { calls: number } {
  const p = {
    id, label: id, model: `${id}-m`, tasks: ["chat", "summarize", "translate", "classify"] as const, calls: 0,
    async generate() { p.calls += 1; return { content: await behaviour(), model: `${id}-m` }; },
  };
  return p;
}
const ok = (text: string) => () => Promise.resolve(text);
const fail = (kind: FailureKind, status?: number) => () => Promise.reject(new ProviderError(kind, status, "x"));

test("first healthy provider in routing order serves the request", async () => {
  const a = fake("a", ok("from a")); const b = fake("b", ok("from b"));
  const r = await createGateway({ providers: [b, a], routing: ROUTING }).generate(req);
  assert.equal(r.provider, "a"); assert.equal(r.content, "from a"); assert.equal(b.calls, 0);
});

test("falls back to the next provider when the first fails", async () => {
  const a = fake("a", fail("server", 500)); const b = fake("b", ok("from b"));
  const r = await createGateway({ providers: [a, b], routing: ROUTING }).generate(req);
  assert.equal(r.provider, "b");
  assert.deepEqual(r.attempts.map((x) => [x.provider, x.ok, x.kind]), [["a", false, "server"], ["b", true, undefined]]);
});

test("all providers failing raises GatewayError with the attempts", async () => {
  const gw = createGateway({ providers: [fake("a", fail("rate_limit", 429)), fake("b", fail("timeout"))], routing: ROUTING });
  await assert.rejects(gw.generate(req), (e: unknown) => e instanceof GatewayError && e.code === "all_failed" && e.attempts.length === 2);
});

test("no configured provider for the task raises no_provider", async () => {
  await assert.rejects(createGateway({ providers: [], routing: ROUTING }).generate(req), (e: unknown) => e instanceof GatewayError && e.code === "no_provider");
  const onlyOther = createGateway({ providers: [fake("zzz", ok("x"))], routing: ROUTING });
  await assert.rejects(onlyOther.generate(req), (e: unknown) => e instanceof GatewayError && e.code === "no_provider");
});

test("circuit breaker skips an unhealthy provider, then recovers after the cooldown", async () => {
  let t = 1_000; let healthy = false;
  const a = fake("a", () => (healthy ? Promise.resolve("a back") : Promise.reject(new ProviderError("server", 500))));
  const b = fake("b", ok("from b"));
  const gw = createGateway({ providers: [a, b], routing: ROUTING, breakerThreshold: 3, cooldownMs: 10_000, now: () => t });
  for (let i = 0; i < 3; i++) await gw.generate(req);
  assert.equal(a.calls, 3);
  await gw.generate(req); assert.equal(a.calls, 3, "open circuit: provider a is skipped");
  assert.equal(gw.status().find((s) => s.id === "a")?.circuit, "open");
  t += 11_000; healthy = true;
  assert.equal((await gw.generate(req)).provider, "a");
  assert.equal(gw.status().find((s) => s.id === "a")?.circuit, "closed");
});

test("blocked/empty answers fall back but do not trip the breaker", async () => {
  const a = fake("a", fail("blocked")); const b = fake("b", ok("ok"));
  const gw = createGateway({ providers: [a, b], routing: ROUTING, breakerThreshold: 1 });
  await gw.generate(req); await gw.generate(req);
  assert.equal(a.calls, 2);
});

test("a hung provider is cut off by the timeout and the fallback answers", async () => {
  const hung: AiProvider = {
    id: "a", label: "a", model: "m", tasks: ["chat"],
    generate: (_r, { signal }) => new Promise((_res, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "TimeoutError" })))),
  };
  const gw = createGateway({ providers: [hung, fake("b", ok("fast"))], routing: ROUTING, timeoutMs: 50, totalTimeoutMs: 1_000 });
  const r = await gw.generate(req);
  assert.equal(r.provider, "b"); assert.equal(r.attempts[0].kind, "timeout");
});

test("scrub removes API keys, bearer tokens and key= query params", () => {
  const dirty = "bad key AIzaSyA1234567890abcdefghijklmnop and Bearer abcdefghijkl and xai-ABCDEFGHIJKLMNOPQRST and ?key=SECRET123&x=1";
  const clean = scrub(dirty);
  for (const secret of ["AIzaSyA1234567890abcdefghijklmnop", "abcdefghijkl", "xai-ABCDEFGHIJKLMNOPQRST", "SECRET123"]) assert.ok(!clean.includes(secret), secret);
});

test("Gemini: key goes in a header (never the URL); response is parsed", async () => {
  let url = ""; let init: RequestInit = {};
  const fetchImpl = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "salav" }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } }), { status: 200 }); }) as unknown as typeof fetch;
  const out = await createGemini({ apiKey: "TEST-KEY-123", model: "gemini-x", fetchImpl }).generate(req, { signal: AbortSignal.timeout(1000) });
  assert.equal(out.content, "salav"); assert.deepEqual(out.usage, { tokensIn: 3, tokensOut: 2 });
  assert.ok(!url.includes("TEST-KEY-123")); assert.equal((init.headers as Record<string, string>)["x-goog-api-key"], "TEST-KEY-123");
  assert.match(url, /models\/gemini-x:generateContent$/);
});

test("Gemini: HTTP errors and safety blocks map to failure kinds", async () => {
  const mk = (status: number, body: unknown) => createGemini({ apiKey: "k", model: "m", fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch });
  const kind = async (p: AiProvider) => p.generate(req, { signal: AbortSignal.timeout(1000) }).catch((e: ProviderError) => e.kind);
  assert.equal(await kind(mk(429, {})), "rate_limit");
  assert.equal(await kind(mk(403, {})), "auth");
  assert.equal(await kind(mk(503, {})), "server");
  assert.equal(await kind(mk(400, {})), "bad_request");
  assert.equal(await kind(mk(200, { promptFeedback: { blockReason: "SAFETY" } })), "blocked");
  assert.equal(await kind(mk(200, { candidates: [] })), "empty");
});

test("keys echoed back by a provider never reach the logs", async () => {
  const key = "AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMY1234";
  const lines: string[] = [];
  const logger = { info: (m: string, x?: object) => lines.push(m + JSON.stringify(x)), warn: (m: string, x?: object) => lines.push(m + JSON.stringify(x)), error: (m: string, x?: object) => lines.push(m + JSON.stringify(x)) };
  const leaky = createGemini({ apiKey: key, model: "m", fetchImpl: (async () => new Response(`invalid key ${key}`, { status: 400 })) as unknown as typeof fetch });
  const gw = createGateway({ providers: [{ ...leaky, id: "a" }], routing: ROUTING, logger });
  await assert.rejects(gw.generate(req));
  assert.ok(lines.length > 0); assert.ok(!lines.join("\n").includes(key));
});

test("routing: defaults, AI_PROVIDER_ORDER and AI_ROUTING overrides, garbage ignored", () => {
  assert.deepEqual(resolveRouting({}), DEFAULT_ROUTING);
  assert.deepEqual(resolveRouting({ order: "groq, gemini" }).chat, ["groq", "gemini"]);
  const r = resolveRouting({ json: '{"chat":["groq"],"classify":["evil id!"]}' });
  assert.deepEqual(r.chat, ["groq"]); assert.deepEqual(r.classify, DEFAULT_ROUTING.classify);
  assert.deepEqual(resolveRouting({ json: "{not json" }), DEFAULT_ROUTING);
});

test("default routing lists all four free providers (no single point of failure), and any subset of keys still works", async () => {
  for (const task of ["chat", "translate", "summarize", "classify"] as const) assert.deepEqual([...DEFAULT_ROUTING[task]].sort(), ["gemini", "groq", "openrouter", "workers-ai"]);
  const gw = createGateway({ providers: [fake("openrouter", ok("only openrouter"))], routing: DEFAULT_ROUTING });
  assert.equal((await gw.generate(req)).provider, "openrouter");
});

test("chain gemini -> groq -> workers-ai serves from the last healthy provider", async () => {
  const a = fake("gemini", fail("server", 500)); const b = fake("groq", fail("rate_limit", 429)); const c = fake("workers-ai", ok("third"));
  const r = await createGateway({ providers: [a, b, c], routing: DEFAULT_ROUTING }).generate(req);
  assert.equal(r.provider, "workers-ai"); assert.deepEqual(r.attempts.map((x) => x.provider), ["gemini", "groq", "workers-ai"]);
});

test("Groq: OpenAI-compatible protocol against the Groq endpoint, classic max_tokens", async () => {
  let url = ""; let init: RequestInit = {};
  const fetchImpl = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ choices: [{ message: { content: "fast" } }] }), { status: 200 }); }) as unknown as typeof fetch;
  const out = await createGroq({ apiKey: "GROQ-TEST", model: "llama-x", fetchImpl }).generate(req, { signal: AbortSignal.timeout(1000) });
  assert.equal(out.content, "fast"); assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal((init.headers as Record<string, string>).authorization, "Bearer GROQ-TEST");
  assert.equal(JSON.parse(init.body as string).max_tokens, 1024);
});

test("routing by task: summarize/classify start on Groq, chat/translate on Gemini", () => {
  assert.equal(DEFAULT_ROUTING.summarize[0], "groq"); assert.equal(DEFAULT_ROUTING.classify[0], "groq");
  assert.equal(DEFAULT_ROUTING.chat[0], "gemini"); assert.equal(DEFAULT_ROUTING.translate[0], "gemini");
});

test("losing any single provider never fails a task (each task survives every one-provider outage)", async () => {
  const ids = ["gemini", "groq", "workers-ai", "openrouter"];
  for (const down of ids) for (const task of ["chat", "translate", "summarize", "classify"] as const) {
    const providers = ids.map((id) => fake(id, id === down ? fail("server", 500) : ok(`from ${id}`)));
    const r = await createGateway({ providers, routing: DEFAULT_ROUTING }).generate({ ...req, task });
    assert.notEqual(r.provider, down);
  }
});

test("OpenRouter: endpoint, bearer auth, public attribution headers sent alongside bearer auth", async () => {
  let url = ""; let init: RequestInit = {};
  const fetchImpl = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ choices: [{ message: { content: "routed" } }], usage: { prompt_tokens: 2, completion_tokens: 1 } }), { status: 200 }); }) as unknown as typeof fetch;
  const p = createOpenRouter({ apiKey: "OPENROUTER-TEST", model: "vendor/model-x", siteUrl: "https://www.rega24.com", fetchImpl });
  assert.equal(p.id, "openrouter");
  const out = await p.generate(req, { signal: AbortSignal.timeout(1000) });
  assert.equal(out.content, "routed"); assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
  const h = init.headers as Record<string, string>;
  assert.equal(h.authorization, "Bearer OPENROUTER-TEST"); assert.equal(h["HTTP-Referer"], "https://www.rega24.com"); assert.equal(h["X-Title"], "REGA Platform");
  assert.equal(JSON.parse(init.body as string).model, "vendor/model-x");
});

test("Groq / OpenRouter: HTTP errors map to failure kinds (402 = quota) and Retry-After is honoured", async () => {
  const mk = (factory: typeof createGroq, status: number, headers: Record<string, string> = {}) =>
    factory({ apiKey: "k", model: "m", fetchImpl: (async () => new Response("{}", { status, headers })) as unknown as typeof fetch });
  for (const factory of [createGroq, createOpenRouter]) {
    // Resolves to the ProviderError; a call that unexpectedly succeeds fails the test.
    const err = (p: AiProvider): Promise<ProviderError> =>
      p.generate(req, { signal: AbortSignal.timeout(1000) }).then(() => assert.fail("expected the provider call to fail"), (e: ProviderError) => e);
    assert.equal((await err(mk(factory, 402))).kind, "quota");
    assert.equal((await err(mk(factory, 401))).kind, "auth");
    assert.equal((await err(mk(factory, 503))).kind, "server");
    assert.equal((await err(mk(factory, 422))).kind, "bad_request");
    const limited = await err(mk(factory, 429, { "retry-after": "7" }));
    assert.equal(limited.kind, "rate_limit"); assert.equal(limited.retryAfterMs, 7_000);
  }
  assert.equal(kindForStatus(402), "quota");
});

test("a provider out of credit (402) trips the breaker instead of being called on every request", async () => {
  const a = fake("a", fail("quota", 402)); const b = fake("b", ok("from b"));
  const gw = createGateway({ providers: [a, b], routing: ROUTING, breakerThreshold: 2, cooldownMs: 60_000 });
  for (let i = 0; i < 4; i++) assert.equal((await gw.generate(req)).provider, "b");
  assert.equal(a.calls, 2, "after the threshold the exhausted provider is skipped");
  assert.equal(gw.status().find((s) => s.id === "a")?.circuit, "open");
});

test("full chain: gemini and groq down -> Workers AI, then Workers AI down too -> OpenRouter (:free) answers", async () => {
  const order = DEFAULT_ROUTING.chat;
  const build = (down: string[]) => order.map((id) => fake(id, down.includes(id) ? fail("server", 500) : ok(`from ${id}`)));
  const r1 = await createGateway({ providers: build(["gemini", "groq"]), routing: DEFAULT_ROUTING }).generate(req);
  assert.equal(r1.provider, "workers-ai"); assert.deepEqual(r1.attempts.map((a) => a.provider), ["gemini", "groq", "workers-ai"]);
  const r2 = await createGateway({ providers: build(["gemini", "groq", "workers-ai"]), routing: DEFAULT_ROUTING }).generate(req);
  assert.equal(r2.provider, "openrouter"); assert.equal(r2.attempts.length, 4);
});

test("scrub removes DeepSeek-style (sk-) and OpenRouter (sk-or-v1-) keys", () => {
  const keys = ["sk-0123456789abcdef0123456789abcdef", "sk-or-v1-0123456789abcdef0123456789abcdef0123456789abcdef"];
  const clean = scrub(`invalid ${keys[0]} / ${keys[1]}`);
  for (const k of keys) assert.ok(!clean.includes(k), k);
  assert.ok(!clean.includes("0123456789abcdef0123"), "no key fragment survives");
});

test("keys echoed back by Groq or OpenRouter never reach the logs", async () => {
  for (const [factory, key] of [[createGroq, "gsk_ECHOECHOECHOECHOECHO1234"], [createOpenRouter, "sk-or-v1-ECHOECHOECHOECHOECHO1234"]] as const) {
    const lines: string[] = [];
    const push = (m: string, x?: object) => { lines.push(m + JSON.stringify(x)); };
    const leaky = factory({ apiKey: key, model: "m", fetchImpl: (async () => new Response(`{"error":"Incorrect API key ${key}"}`, { status: 401 })) as unknown as typeof fetch });
    const gw = createGateway({ providers: [{ ...leaky, id: "a" }], routing: ROUTING, logger: { info: push, warn: push, error: push } });
    await assert.rejects(gw.generate(req));
    assert.ok(lines.length > 0); assert.ok(!lines.join("\n").includes(key), key);
  }
});

/** Env names per provider id (key, model, base URL). Source-level check: runtime.ts/env.ts are server-only modules. */
const PROVIDER_ENV: Record<string, [key: string, model: string, base: string]> = {
  gemini: ["GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_BASE_URL"],
  groq: ["GROQ_API_KEY", "GROQ_MODEL", "GROQ_BASE_URL"],
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_BASE_URL"],
};

test("every routed provider is registered in the runtime catalog, env schema, AI_PROVIDER and .env.example", () => {
  const runtime = readFileSync("src/lib/ai/runtime.ts", "utf8");
  const env = readFileSync("src/lib/env.ts", "utf8");
  const example = readFileSync(".env.example", "utf8");
  const routed = new Set(Object.values(DEFAULT_ROUTING).flat());
  assert.deepEqual([...routed].sort(), [...Object.keys(PROVIDER_ENV), "workers-ai"].sort(), "routing covers the three key providers and Workers AI");
  // Workers AI has no key: it exists only through the Worker binding, with its model in the env schema and a free default.
  assert.match(runtime, /id: "workers-ai",.*model: env\.WORKERS_AI_MODEL, hasKey: Boolean\(service\),.*generateWithService\(service!, model, input\).*reserveNeurons: reserveWorkersAiNeurons/);
  assert.match(env, /^\s+WORKERS_AI_MODEL: z\.string\(\)\.min\(1\)\.default\("@cf\/google\/gemma-4-26b-a4b-it"\),/m);
  assert.match(env, /AI_PROVIDER: z\.enum\(\[[^\]]*"workers-ai"/, "AI_PROVIDER accepts workers-ai");
  assert.doesNotMatch(readFileSync("wrangler.jsonc", "utf8"), /"ai":/, "no AI binding on rega24: Workers AI stays in rega-ai-python");
  const aiProvider = env.match(/AI_PROVIDER: z\.enum\(\[([^\]]+)\]\)/)?.[1] ?? "";
  for (const [id, [key, model, base]] of Object.entries(PROVIDER_ENV)) {
    assert.match(runtime, new RegExp(`id: "${id}",.*hasKey: Boolean\\(env\\.${key}\\).*model: env\\.${model}, baseUrl: env\\.${base}`), `${id} in catalog`);
    for (const name of [key, model, base]) assert.match(env, new RegExp(`^\\s+${name}: z\\.`, "m"), `${name} in env schema`);
    assert.match(env, new RegExp(`^\\s+${key}: z\\.string\\(\\)\\.optional\\(\\),`, "m"), `${key} is optional (provider skipped without it)`);
    assert.match(env, new RegExp(`^\\s+${base}: z\\.string\\(\\)\\.url\\(\\)\\.optional\\(\\),`, "m"), `${base} must be a URL`);
    assert.ok(aiProvider.includes(`"${id}"`), `AI_PROVIDER accepts ${id}`);
    assert.match(example, new RegExp(`^${key}=$`, "m"), `${key} listed empty in .env.example`);
  }
});

test("provider keys stay server-side: key-reading modules are server-only and no client component imports them", () => {
  for (const f of ["src/lib/env.ts", "src/lib/ai/runtime.ts"]) assert.match(readFileSync(f, "utf8"), /^import "server-only";$/m, f);
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []; });
  const offenders = files("src").filter((f) => {
    const src = readFileSync(f, "utf8");
    return /^["']use client["']/m.test(src) && (/from "@\/lib\/(ai|env)(\/[^"]*)?"/.test(src) || /_API_KEY/.test(src));
  });
  assert.deepEqual(offenders, []);
});

// ------------------------------------------------------------------ provider clean-up (2026-10-01)

/** Captures the JSON body an OpenAI-compatible adapter sends. */
async function sentBody(make: (fetchImpl: typeof fetch) => AiProvider): Promise<Record<string, unknown>> {
  let body = "";
  const fetchImpl = (async (_u: string, i: RequestInit) => { body = i.body as string; return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }); }) as unknown as typeof fetch;
  await make(fetchImpl).generate(req, { signal: AbortSignal.timeout(1000) });
  return JSON.parse(body) as Record<string, unknown>;
}

test("reasoning_effort: 'low' only for model ids whose vendor documents it, never for the other providers", async () => {
  assert.equal((await sentBody((f) => createGroq({ apiKey: "k", model: "openai/gpt-oss-120b", fetchImpl: f }))).reasoning_effort, "low");
  for (const make of [
    (f: typeof fetch) => createGroq({ apiKey: "k", model: "llama-3.3-70b-versatile", fetchImpl: f }),
    (f: typeof fetch) => createOpenRouter({ apiKey: "k", model: "google/gemma-4-31b-it:free", fetchImpl: f }),
  ]) assert.ok(!("reasoning_effort" in (await sentBody(make))));
  assert.equal(groqReasoningEffort("openai/gpt-oss-20b"), "low"); assert.equal(groqReasoningEffort("qwen/qwen3.8-27b"), undefined);
});

/** Defaults are read from the source: env.ts is a server-only module. */
function envDefault(name: string): string {
  const m = readFileSync("src/lib/env.ts", "utf8").match(new RegExp(`^\\s+${name}: z\\.string\\(\\)\\.min\\(1\\)\\.default\\("([^"]+)"\\),`, "m"));
  assert.ok(m, `${name} default`); return m![1];
}

test("model defaults: one value per provider, identical in env.ts and .env.example, no retired or restricted id", () => {
  const example = readFileSync(".env.example", "utf8");
  const expected: Record<string, string> = {
    GEMINI_MODEL: "gemini-3.5-flash-lite", GROQ_MODEL: "openai/gpt-oss-120b", OPENROUTER_MODEL: "google/gemma-4-31b-it:free",
  };
  assert.deepEqual(Object.keys(expected).sort(), Object.values(PROVIDER_ENV).map(([, model]) => model).sort());
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(envDefault(name), value, `${name} default in env.ts`);
    assert.match(example, new RegExp(`^${name}=${value.replace(/[./]/g, "\\$&")}$`, "m"), `${name} in .env.example`);
  }
  // Retired / restricted on 2026-10-01: grok-4 (retired 2026-05-15), llama-3.3-70b-versatile (left Groq's self-serve tiers
  // 2026-08-16), google/gemini-2.5-flash on OpenRouter (removed 2026-10-20), gemini-2.5-flash (existing users only), deepseek-chat.
  const retired = ["grok-4", "llama-3.3-70b-versatile", "google/gemini-2.5-flash", "gemini-2.5-flash", "deepseek-chat"];
  for (const id of retired) assert.ok(!Object.values(expected).includes(id), id);
  for (const id of retired) assert.ok(!new RegExp(`^[A-Z_]+_MODEL=${id.replace(/[./]/g, "\\$&")}$`, "m").test(example), `${id} not in .env.example`);
});

test("every provider key is synced to the Worker and nothing else AI-related is (no dangling secret names)", () => {
  const wf = readFileSync(".github/workflows/worker-secrets-sync.yml", "utf8");
  const keys = Object.values(PROVIDER_ENV).map(([key]) => key);
  for (const key of keys) {
    assert.match(wf, new RegExp(`S_${key}: \\$\\{\\{ secrets\\.${key} \\}\\}`), `${key} mapped from GitHub secrets`);
    assert.match(wf, new RegExp(`for name in [^\\n]*\\b${key}\\b`), `${key} in the upload loop`);
  }
  const loop = wf.match(/for name in ([^;]+);/)?.[1].trim().split(/\s+/) ?? [];
  assert.deepEqual(loop.filter((n) => n.endsWith("_API_KEY")).sort(), [...keys].sort());
});

test("configWarnings names a routed id that is not a provider, a pinned provider without key, and auto without any key", () => {
  const catalog = [...Object.entries(PROVIDER_ENV).map(([id, [keyEnv]]) => ({ id, keyEnv, hasKey: id === "groq" })), { id: "workers-ai", keyEnv: "AI_SERVICE_URL + AI_SERVICE_TOKEN", hasKey: false }];
  assert.deepEqual(configWarnings({ routing: DEFAULT_ROUTING, catalog, aiProvider: "auto" }), []);
  const typo = configWarnings({ routing: resolveRouting({ order: "gemini,mistral" }), catalog, aiProvider: "auto" });
  assert.equal(typo.length, 1); assert.equal(typo[0].event, "ai.config.unknown_provider_in_routing"); assert.deepEqual(typo[0].meta.ids, ["mistral"]);
  const pinned = configWarnings({ routing: DEFAULT_ROUTING, catalog, aiProvider: "gemini" });
  assert.deepEqual(pinned, [{ event: "ai.config.provider_key_missing", meta: { provider: "gemini", missing: "GEMINI_API_KEY" } }]);
  const none = configWarnings({ routing: DEFAULT_ROUTING, catalog: catalog.map((c) => ({ ...c, hasKey: false })), aiProvider: "auto" });
  assert.deepEqual(none.map((w) => w.event), ["ai.config.no_provider_keys"]);
  assert.deepEqual(configWarnings({ routing: DEFAULT_ROUTING, catalog: catalog.map((c) => ({ ...c, hasKey: false })), aiProvider: "disabled" }), []);
  assert.ok(!JSON.stringify([typo, pinned, none]).match(/sk-|AIza|gsk_|xai-/), "warnings carry names only");
});

test("dashboard probe: tiny, discarded call with room for low-effort reasoning", async () => {
  let seen: GenerateRequest | undefined;
  const p: AiProvider = { id: "groq", label: "g", model: "m", tasks: ["classify"], async generate(r) { seen = r; return { content: "ok", model: "m" }; } };
  const result = await createGateway({ providers: [p], routing: DEFAULT_ROUTING }).probe("groq");
  assert.equal(result.ok, true); assert.ok(!("content" in result));
  assert.equal(seen?.maxOutputTokens, PROBE_MAX_OUTPUT_TOKENS); assert.ok(PROBE_MAX_OUTPUT_TOKENS <= 256);
});
