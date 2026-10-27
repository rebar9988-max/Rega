import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Repository operational JavaScript module.
import { d1ReleaseReady, D1_ID } from "../scripts/d1-release-readiness.mjs";
const sha = "a".repeat(40);
const env = { CLOUDFLARE_ACCOUNT_ID: "ee07860dbb8e61ff6915758785baf89a", CLOUDFLARE_API_TOKEN: "local-test-only" };
const fake = (bindings: unknown[], row: unknown) => async (url: string) => Response.json({ success: true, result: url.endsWith("/settings") ? { bindings } : [{ success: true, results: row ? [row] : [] }] });
test("first D1 release is blocked until the verified final snapshot matches this exact SHA", async () => {
  const row = { releaseSha: sha, ready: 1, allTablesMatch: 1, foreignKeyViolations: 0 };
  assert.equal(await d1ReleaseReady(sha, env, fake([], row)), true);
  for (const bad of [null, { ...row, ready: 0 }, { ...row, releaseSha: "b".repeat(40) }, { ...row, allTablesMatch: 0 }, { ...row, foreignKeyViolations: 1 }]) assert.equal(await d1ReleaseReady(sha, env, fake([], bad)), false);
  await assert.rejects(d1ReleaseReady(sha, { ...env, CLOUDFLARE_ACCOUNT_ID: "wrong-account" }, fake([], row)));
});
test("later D1 releases require both the exact active provider and exact existing database binding", async () => {
  const bindings = [{ name: "REGA_DATABASE_PROVIDER", type: "plain_text", text: "d1" }, { name: "DB", type: "d1", id: D1_ID }];
  assert.equal(await d1ReleaseReady(sha, env, fake(bindings, null)), true);
  assert.equal(await d1ReleaseReady(sha, env, fake(bindings.slice(0, 1), null)), false);
  assert.equal(await d1ReleaseReady(sha, env, fake([{ ...bindings[0] }, { ...bindings[1], id: "wrong-database" }], null)), false);
});
