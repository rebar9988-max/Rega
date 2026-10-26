import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyWorkerTarget } from "../scripts/verify-worker-target.mjs";

const options = { accountId: "a".repeat(32), apiToken: "unit-test-only-token", expectedWorker: "rega-platform" };
function matching(service = "rega-platform", environment = "production", enabled = true): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.cloudflare.com");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${options.apiToken}`);
    return Response.json({ success: true, result: [{ hostname: url.searchParams.get("hostname"), service, environment, enabled }] });
  };
}

test("deploy target must match both canonical production domains", async () => {
  assert.deepEqual(await verifyWorkerTarget({ ...options, fetcher: matching() }), { worker: "rega-platform", domains: ["www.rega24.com", "rega24.com"] });
});
test("retired source Worker cannot be recreated after a canonical target cutover", async () => {
  await assert.rejects(verifyWorkerTarget({ ...options, fetcher: matching("rega24") }), /does not match Wrangler/);
});
test("missing, disabled and preview domain bindings block deployment", async () => {
  for (const fetcher of [matching("rega-platform", "preview"), matching("rega-platform", "production", false), async () => Response.json({ success: true, result: [] })])
    await assert.rejects(verifyWorkerTarget({ ...options, fetcher }), /does not match Wrangler/);
});
test("provider access errors fail closed without forwarding response secrets", async () => {
  const fetcher: typeof fetch = async () => Response.json({ errors: [{ message: "synthetic-private-detail" }] }, { status: 403 });
  await assert.rejects(verifyWorkerTarget({ ...options, fetcher }), (error: Error) => error.message.includes("HTTP 403") && !error.message.includes("synthetic-private-detail"));
});
test("missing deployment credentials fail before any network request", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => { called = true; return Response.json({}); };
  await assert.rejects(verifyWorkerTarget({ ...options, apiToken: "", fetcher }), /requires valid/);
  assert.equal(called, false);
});
test("web deployment and secret sync verify the live target before their production mutation", () => {
  for (const [path, mutation] of [
    [".github/workflows/deploy.yml", "run: npx wrangler deploy"],
    [".github/workflows/worker-secrets-sync.yml", "npx wrangler secret bulk"],
  ]) {
    const source = readFileSync(path, "utf8");
    const gate = source.indexOf("run: node scripts/verify-worker-target.mjs");
    assert.ok(gate > 0 && gate < source.indexOf(mutation), path);
    if (path.includes("worker-secrets-sync")) {
      assert.match(source, /wrangler secret bulk --config wrangler\.jsonc/);
      assert.doesNotMatch(source, /wrangler secret bulk[^\n]*--name/);
    }
  }
});
