import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { GatewayError } from "../src/lib/ai/errors";

const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/ai/chat.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function pipeline({ outage = false, used = 0, matches = true, localAllowed = true } = {}) {
  let calls = 0;
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/logger": { log: { info() {}, warn() {}, error() {} } },
    "./errors": { GatewayError },
    "./runtime": { isAiConfigured: () => true, dailyBudgetAllows: () => localAllowed,
      getGateway: () => ({ generate: async () => { calls++; return { content: "Answer", provider: "fake", model: "fake", latencyMs: 0, attempts: [] }; } }) },
    "@/lib/db": { prisma: {
      aiUsageDaily: { aggregate: async () => { if (outage) throw new Error("database outage"); return { _sum: { requests: used } }; }, upsert: async () => {} },
      aiConversation: { upsert: async () => ({ id: "session", userId: null }) },
      aiMessage: { createMany: async () => {} },
    } },
    "@/lib/env": { serverEnv: () => ({ AI_DAILY_LIMIT: 10 }) },
    "@/lib/search/postgres": { contextOf: () => "Approved data", searchService: { search: async () => matches ? [{ section: "businesses", title: "Listing", url: "/de/business/listing" }] : [] } },
    "next-intl/server": { getTranslations: async () => () => "No match" },
    "./suggestions": { categorySuggestions: async () => [] },
    "./retention": { purgeOldConversations: async () => {} },
  };
  const exports: { chat?: (input: unknown) => Promise<{ provider: string }> } = {};
  runInNewContext(compiled, { exports, Date, process: { env: {} }, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  } });
  return { chat: () => exports.chat!({ messages: [{ role: "user", content: "Find a listing" }], locale: "en", sessionId: "session" }), calls: () => calls };
}

test("shared budget outage prevents every provider call", async () => {
  const flow = pipeline({ outage: true });
  await assert.rejects(flow.chat(), { code: "budget_exceeded" });
  assert.equal(flow.calls(), 0);
});

test("shared and local budget limits stop provider calls", async () => {
  for (const input of [{ used: 10 }, { used: 11 }, { localAllowed: false }]) {
    const flow = pipeline(input);
    await assert.rejects(flow.chat(), { code: "budget_exceeded" });
    assert.equal(flow.calls(), 0);
  }
});

test("a healthy budget permits retrieval-grounded generation", async () => {
  const flow = pipeline({ used: 9 });
  assert.equal((await flow.chat()).provider, "fake");
  assert.equal(flow.calls(), 1);
});

test("empty directory results stay available without spending during an accounting outage", async () => {
  const flow = pipeline({ outage: true, matches: false });
  assert.equal((await flow.chat()).provider, "rega");
  assert.equal(flow.calls(), 0);
});
