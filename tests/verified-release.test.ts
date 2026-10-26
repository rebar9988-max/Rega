import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
function run(outcome: string) {
  const dir = mkdtempSync(join(tmpdir(), "rega24-release-test-"));
  const preload = join(dir, "mock.mjs");
  writeFileSync(preload, `globalThis.fetch = async (url) => ({ ok: process.env.TEST_OUTCOME !== 'api-failure', json: async () => String(url).includes("/workers/scripts") ? ({success:true,result:[{id:'rega24',tag:'7b845cda2ee749c89c4f9b83490609b4'},{id:'rega-ai-python'}]}) : String(url).includes("/workers/domains") ? ({success:true,result:['www.rega24.com','rega24.com'].map(hostname=>({hostname,service:process.env.TEST_OUTCOME === 'wrong-target' ? 'unknown' : 'rega24',environment:'production'}))}) : String(url).includes("/git/ref/") ? ({object:{sha:process.env.TEST_OUTCOME === "superseded" ? "b".repeat(40) : process.env.TEST_SHA}}) : ({workflow_runs:[{ head_sha: process.env.TEST_OUTCOME === 'wrong-sha' ? 'a'.repeat(40) : process.env.TEST_SHA, head_branch:'main', head_repository:{full_name:'rebar9988-max/Rega'}, conclusion:'success', event:process.env.TEST_OUTCOME === 'pr-only' ? 'pull_request' : 'push' }]}) });`);
  try {
    return spawnSync(process.execPath, ["--import", preload, "scripts/verified-release.mjs"], { encoding: "utf8",
      env: { ...process.env, GITHUB_REPOSITORY: "rebar9988-max/Rega", CLOUDFLARE_ACCOUNT_ID: outcome === "wrong-account" ? "unknown" : "ee07860dbb8e61ff6915758785baf89a", CLOUDFLARE_API_TOKEN: outcome === "missing-cloudflare-token" ? "" : "synthetic-qa-token", GITHUB_TOKEN: outcome === "missing-token" ? "" : "synthetic-not-a-real-token", TEST_SHA: sha, TEST_OUTCOME: outcome, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: outcome === "mock-font" ? "synthetic-qa-only" : "" } });
  } finally { rmSync(dir, { recursive: true }); }
}

test("both release paths require successful exact main CI and fail closed on missing evidence", () => {
  const pass = run("success");assert.equal(pass.status, 0, pass.stderr);
  for (const reason of ["wrong-sha", "pr-only", "api-failure", "missing-token", "superseded", "wrong-account", "mock-font", "wrong-target", "missing-cloudflare-token"]) assert.equal(run(reason).status, 1, reason);
});
