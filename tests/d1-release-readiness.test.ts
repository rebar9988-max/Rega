import test from "node:test";
import assert from "node:assert/strict";
import { d1ReleaseReady, D1_ID } from "../scripts/d1-release-readiness.mjs";
const sha = "a".repeat(40);
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: "ee07860dbb8e61ff6915758785baf89a", CLOUDFLARE_API_TOKEN: "local-test-only" };
const fake = (bindings: unknown[]): typeof fetch => async url => {
  assert.ok(String(url).endsWith("/workers/scripts/rega24/settings"), "CI reads only the authenticated Workers settings endpoint");
  return Response.json({ success: true, result: { bindings } });
};
const nonce = "12345678-1234-4234-8234-123456789012";
const proof = () => ({ version: 1, project: "REGA", releaseSha: sha, databaseId: D1_ID, freezeNonce: nonce, ready: true, allTablesMatch: true,
  foreignKeyViolations: 0, tableCount: 36, totalRows: 2332, sourceFingerprintSha256: "b".repeat(64), typedManifestSha256: "c".repeat(64), backupSha256: "d".repeat(64),
  sourceFrozenAt: new Date(Date.now() - 180_000).toISOString(), verifiedAt: new Date().toISOString() });
const attestation = (p: unknown, frozen = "1", id = nonce) => [
  { name: "REGA_ISOLATED_PREVIEW", type: "plain_text", text: frozen },
  { name: "REGA_D1_FREEZE_NONCE", type: "plain_text", text: id },
  { name: "REGA_D1_CUTOVER_PROOF", type: "plain_text", text: JSON.stringify(p) },
];
test("first D1 release is blocked until the verified final snapshot matches this exact SHA", async () => {
  const row = proof();
  assert.equal(await d1ReleaseReady(sha, env, fake(attestation(row))), true);
  for (const bad of [null, { ...row, ready: false }, { ...row, releaseSha: "b".repeat(40) }, { ...row, allTablesMatch: false }, { ...row, foreignKeyViolations: 1 },
    { ...row, databaseId: "wrong-database" }, { ...row, tableCount: 35 }, { ...row, totalRows: 0 }, { ...row, typedManifestSha256: "invalid" }, { ...row, backupSha256: "invalid" }]) assert.equal(await d1ReleaseReady(sha, env, fake(attestation(bad))), false);
  await assert.rejects(d1ReleaseReady(sha, { ...env, CLOUDFLARE_ACCOUNT_ID: "wrong-account" }, fake(attestation(row))));
});
test("snapshot attestations require this freeze, a drain period and a fresh verification", async () => {
  const row = proof();
  assert.equal(await d1ReleaseReady(sha, env, fake(attestation(row, "0"))), false);
  assert.equal(await d1ReleaseReady(sha, env, fake(attestation(row, "1", "22345678-1234-4234-8234-123456789012"))), false);
  assert.equal(await d1ReleaseReady(sha, env, fake(attestation({ ...row, sourceFrozenAt: row.verifiedAt }))), false);
  assert.equal(await d1ReleaseReady(sha, env, fake(attestation({ ...row, sourceFrozenAt: new Date(Date.now() - 1_800_000).toISOString(), verifiedAt: new Date(Date.now() - 1_000_000).toISOString() }))), false);
  assert.equal(await d1ReleaseReady(sha, env, fake(attestation({ ...row, verifiedAt: new Date(Date.now() + 120_000).toISOString() }))), false);
  assert.equal(await d1ReleaseReady(sha, env, fake([{ name: "REGA_D1_CUTOVER_PROOF", type: "plain_text", text: "{invalid" } ])), false);
});
test("later D1 releases require both the exact active provider and exact existing database binding", async () => {
  const bindings = [{ name: "REGA_DATABASE_PROVIDER", type: "plain_text", text: "d1" }, { name: "DB", type: "d1", id: D1_ID }];
  assert.equal(await d1ReleaseReady(sha, env, fake(bindings)), true);
  assert.equal(await d1ReleaseReady(sha, env, fake(bindings.slice(0, 1))), false);
  assert.equal(await d1ReleaseReady(sha, env, fake([{ ...bindings[0] }, { ...bindings[1], id: "wrong-database" }])), false);
});
