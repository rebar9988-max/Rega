import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("repair CLI loads in the repository's CommonJS tsx runtime and refuses an unconfigured database", () => {
  const run = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/business-publication-repair.ts"], {
    env: { ...process.env, DATABASE_URL: "" }, encoding: "utf8", timeout: 10000,
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /DATABASE_URL must be configured/);
  assert.doesNotMatch(run.stderr, /Transform failed|Top-level await/);
});
