import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "rega-d1-binding-"));
const cli = ["node_modules/wrangler/bin/wrangler.js"];
const config = ["--config", "tests/runtime/d1-wrangler.jsonc", "--persist-to", directory];
execFileSync(process.execPath, [...cli, "d1", "migrations", "apply", "rega-d1-runtime-local-test", "--local", ...config], { stdio: "pipe" });
const child = spawn(process.execPath, [...cli, "dev", "--local", "--port", "8795", ...config], { stdio: "ignore" });
let exited = false;
child.on("exit", () => { exited = true; });
try {
  let ready = false;
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    assert.ok(!exited, "D1 binding test Worker exited before readiness");
    try { ready = (await fetch("http://127.0.0.1:8795", { signal: AbortSignal.timeout(2000) })).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "D1 binding Worker readiness");
  const response = await fetch("http://127.0.0.1:8795", { method: "POST", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, await response.text());
  console.log("D1 binding/workerd: nested writes, Unicode, timestamp filters, compound upserts, atomic rollback and FK cascade passed.");
} finally { child.kill("SIGTERM"); rmSync(directory, { recursive: true, force: true }); }
