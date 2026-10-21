/** Exercise the built Worker locally. CI uses only its throw-away database and dummy auth secret. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 8798;
const child = spawn(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--port", String(port),
  "--var", `DATABASE_URL:${process.env.DATABASE_URL ?? ""}`,
  "--var", "AUTH_SECRET:worker-smoke-local-only", "--var", "REGA_PRIVATE_BETA:0",
], { stdio: ["ignore", "ignore", "ignore"] });
let exited = false;
child.on("exit", () => { exited = true; });
try {
  let health;
  for (let attempt = 0; attempt < 45; attempt++) {
    assert.ok(!exited, "Local Worker exited before readiness");
    try {
      const response = await fetch(`http://localhost:${port}/api/v1/health`, { signal: AbortSignal.timeout(8000) });
      health = await response.json();
      assert.equal(health.service, "rega-platform");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  assert.equal(health?.service, "rega-platform", "Built Worker must execute a Next.js route and return its health report");
  assert.equal(health.ok, true, "Worker database and migrations must be ready");
  const directory = await fetch(`http://localhost:${port}/api/v1/businesses`);
  assert.equal(directory.status, 200);
  const result = await directory.json();
  assert.ok(Array.isArray(result.data));
  assert.ok(result.data.every((business) => business.verified && business.status === "published"));
  const response = await fetch(`http://localhost:${port}/api/v1/businesses?country=invalid`);
  assert.equal(response.status, 422, "Business directory validation must run inside the Worker");
  console.log("Worker runtime: database, public business query and validation passed");
} finally {
  child.kill("SIGTERM");
}
