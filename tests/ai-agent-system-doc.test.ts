import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_IDS } from "../src/lib/ops/types";
import { DEFAULT_ROUTING, PROVIDER_BILLING, activeProviderIds } from "../src/lib/ai/routing";
import { TASKS } from "../src/lib/ai/types";

// docs/AI_AGENT_SYSTEM.md is the single inventory of the AI agent system; the code stays the source of truth.
const doc = readFileSync(new URL("../docs/AI_AGENT_SYSTEM.md", import.meta.url), "utf8");

test("AI agent system doc lists every registered ops agent", () => {
  for (const id of AGENT_IDS) assert.ok(doc.includes(`\`${id}\``), `agent ${id} missing from docs/AI_AGENT_SYSTEM.md`);
});

test("AI agent system doc lists every routed AI provider and task", () => {
  for (const id of new Set(Object.values(DEFAULT_ROUTING).flat())) assert.ok(doc.includes(`\`${id}\``), `provider ${id} missing from docs/AI_AGENT_SYSTEM.md`);
  for (const task of TASKS) assert.ok(doc.includes(`\`${task}\``), `task ${task} missing from docs/AI_AGENT_SYSTEM.md`);
});

test("AI agent system doc is linked from the system map", () => {
  assert.ok(readFileSync(new URL("../REGA24_SYSTEM_MAP.md", import.meta.url), "utf8").includes("docs/AI_AGENT_SYSTEM.md"));
});

test("every routed AI provider has a billing class (PM-01 €0 audit)", () => {
  const routed = [...new Set(Object.values(DEFAULT_ROUTING).flat())].sort();
  assert.deepEqual(Object.keys(PROVIDER_BILLING).sort(), routed);
});

test("AI_PROVIDER selects the active providers exactly as the gateway does", () => {
  assert.deepEqual(activeProviderIds("disabled", ["gemini", "openai"]), []);
  assert.deepEqual(activeProviderIds("auto", ["gemini", "openai"]), ["gemini", "openai"]);
  assert.deepEqual(activeProviderIds("gemini", ["gemini", "openai"]), ["gemini"]);
  assert.deepEqual(activeProviderIds("groq", ["gemini"]), []);
});
