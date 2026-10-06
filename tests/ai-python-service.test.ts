import test from "node:test";
import assert from "node:assert/strict";
import { createPythonAiClient, PythonAiServiceError, rerankWithService } from "../src/lib/ai/python-client";

const config = (fetchImpl: typeof fetch) => ({
  baseUrl: "https://internal.example/",
  token: "test-token-never-log-this-value",
  timeoutMs: 50,
  fetchImpl,
});

test("Python client sends server token and parses a successful semantic rerank", async () => {
  let seenUrl = "";
  let seenInit: RequestInit = {};
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seenUrl = url; seenInit = init;
    return new Response(JSON.stringify({ ok: true, model: "reranker", items: [{ id: "b", score: 0.9 }, { id: "a", score: 0.1 }] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const out = await createPythonAiClient(config(fetchImpl)).rerank({
    query: "restaurant", items: [{ id: "a", text: "lawyer" }, { id: "b", text: "restaurant" }],
  });
  assert.equal(seenUrl, "https://internal.example/v1/rerank");
  assert.equal((seenInit.headers as Record<string, string>).authorization, "Bearer test-token-never-log-this-value");
  assert.deepEqual(out.items.map((x) => x.id), ["b", "a"]);
});

test("invalid, unauthorized and provider-error responses become safe typed failures", async () => {
  const cases: [Response, string, number | undefined][] = [
    [new Response("not json", { status: 200 }), "malformed", undefined],
    [new Response("{}", { status: 401 }), "unauthorized", 401],
    [new Response("{}", { status: 503 }), "service", 503],
  ];
  for (const [response, kind, status] of cases) {
    const fetchImpl = (async () => response) as unknown as typeof fetch;
    await assert.rejects(
      () => createPythonAiClient(config(fetchImpl)).rerank({ query: "q", items: [{ id: "a", text: "x" }] }),
      (error: unknown) => error instanceof PythonAiServiceError && error.kind === kind && error.status === status,
    );
  }
});

test("timeout is bounded and does not expose the service token", async () => {
  const fetchImpl = (async (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  })) as unknown as typeof fetch;
  await assert.rejects(
    () => createPythonAiClient(config(fetchImpl)).rerank({ query: "q", items: [{ id: "a", text: "x" }] }),
    (error: unknown) => error instanceof PythonAiServiceError && error.kind === "timeout" && !error.message.includes("test-token"),
  );
});

test("unavailable or malformed Python service gracefully preserves REGA candidate order", async () => {
  const original = [{ id: "a", text: "one" }, { id: "b", text: "two" }];
  for (const fetchImpl of [
    (async () => { throw new Error("offline"); }) as unknown as typeof fetch,
    (async () => new Response(JSON.stringify({ ok: true, items: "bad" }), { status: 200 })) as unknown as typeof fetch,
    (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch,
  ]) {
    const out = await rerankWithService(config(fetchImpl), "query", original, (x) => x);
    assert.equal(out.used, false);
    assert.deepEqual(out.items, original);
  }
});

test("unconfigured Python engine makes no network request and leaves simple REGA flow untouched", async () => {
  let calls = 0;
  const out = await rerankWithService(null, "query", [{ id: "a", text: "one" }, { id: "b", text: "two" }], (x) => {
    calls += 1;
    return x;
  });
  assert.equal(out.used, false);
  assert.equal(calls, 0);
  assert.deepEqual(out.items.map((x) => x.id), ["a", "b"]);
});
