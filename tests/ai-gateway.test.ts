import test from "node:test";
import assert from "node:assert/strict";
import { createGateway } from "../src/lib/ai/gateway";
import { GatewayError, ProviderError, scrub } from "../src/lib/ai/errors";
import { createGemini } from "../src/lib/ai/providers/gemini";
import { createGrok, createGroq, createOpenAi } from "../src/lib/ai/providers/openai-compatible";
import { resolveRouting, DEFAULT_ROUTING } from "../src/lib/ai/routing";
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

test("Grok (OpenAI-compatible): bearer auth, system message first, usage mapped", async () => {
  let init: RequestInit = {}; let url = "";
  const fetchImpl = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ choices: [{ message: { content: " hello " } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }), { status: 200 }); }) as unknown as typeof fetch;
  const out = await createGrok({ apiKey: "XAI-TEST", model: "grok-x", fetchImpl }).generate(req, { signal: AbortSignal.timeout(1000) });
  assert.equal(out.content, "hello"); assert.deepEqual(out.usage, { tokensIn: 5, tokensOut: 1 });
  assert.equal(url, "https://api.x.ai/v1/chat/completions");
  assert.equal((init.headers as Record<string, string>).authorization, "Bearer XAI-TEST");
  const body = JSON.parse(init.body as string);
  assert.deepEqual(body.messages[0], { role: "system", content: "sys" }); assert.equal(body.model, "grok-x"); assert.equal(body.stream, false);
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
  assert.deepEqual(resolveRouting({ order: "grok, gemini" }).chat, ["grok", "gemini"]);
  const r = resolveRouting({ json: '{"chat":["grok"],"classify":["evil id!"]}' });
  assert.deepEqual(r.chat, ["grok"]); assert.deepEqual(r.classify, DEFAULT_ROUTING.classify);
  assert.deepEqual(resolveRouting({ json: "{not json" }), DEFAULT_ROUTING);
});

test("OpenAI: bearer auth, max_completion_tokens, no custom temperature", async () => {
  let url = ""; let init: RequestInit = {};
  const fetchImpl = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 }); }) as unknown as typeof fetch;
  const out = await createOpenAi({ apiKey: "OPENAI-TEST", model: "gpt-x", fetchImpl }).generate({ ...req, temperature: 0.9, maxOutputTokens: 77 }, { signal: AbortSignal.timeout(1000) });
  assert.equal(out.content, "hi"); assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal((init.headers as Record<string, string>).authorization, "Bearer OPENAI-TEST");
  const b = JSON.parse(init.body as string);
  assert.equal(b.max_completion_tokens, 77); assert.ok(!("temperature" in b)); assert.ok(!("max_tokens" in b));
});

test("default routing lists all four providers (no single point of failure), and any subset of keys still works", async () => {
  for (const task of ["chat", "translate", "summarize", "classify"] as const) assert.deepEqual([...DEFAULT_ROUTING[task]].sort(), ["gemini", "grok", "groq", "openai"]);
  const gw = createGateway({ providers: [fake("openai", ok("only openai"))], routing: DEFAULT_ROUTING });
  assert.equal((await gw.generate(req)).provider, "openai");
});

test("chain gemini -> grok -> openai serves from the last healthy provider", async () => {
  const a = fake("gemini", fail("server", 500)); const b = fake("grok", fail("rate_limit", 429)); const c = fake("openai", ok("third"));
  const r = await createGateway({ providers: [a, b, c], routing: { ...DEFAULT_ROUTING, chat: ["gemini", "grok", "openai"] } }).generate(req);
  assert.equal(r.provider, "openai"); assert.deepEqual(r.attempts.map((x) => x.provider), ["gemini", "grok", "openai"]);
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
  const ids = ["gemini", "grok", "openai", "groq"];
  for (const down of ids) for (const task of ["chat", "translate", "summarize", "classify"] as const) {
    const providers = ids.map((id) => fake(id, id === down ? fail("server", 500) : ok(`from ${id}`)));
    const r = await createGateway({ providers, routing: DEFAULT_ROUTING }).generate({ ...req, task });
    assert.notEqual(r.provider, down);
  }
});
