import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("production ownership preflight blocks drift, missing services, permissions and wrong account", async () => {
  const { verifyProductionTarget } = await import("../scripts/production-target.mjs");
  const project = JSON.parse(readFileSync(new URL("../src/config/project.json", import.meta.url), "utf8"));
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: project.cloudflareAccountId, CLOUDFLARE_API_TOKEN: "synthetic-test-only" };
  for (const mode of ["success", "missing-worker", "wrong-tag", "missing-ai", "wrong-domain", "missing-domain", "duplicate-domain", "preview-env", "forbidden", "invalid-response", "wrong-account", "missing-token"]) {
    const methods: string[] = [];
    const request: typeof fetch = async (input, options) => {
      const url = String(input);
      methods.push(options?.method ?? "GET");
      assert.equal(options?.redirect, "error", "protected authorization never follows a redirect");
      const workers = [{ id: mode === "missing-worker" ? "missing" : project.webWorker, tag: mode === "wrong-tag" ? "wrong" : project.webWorkerTag },
        { id: mode === "missing-ai" ? "missing" : project.aiWorker }];
      const domains = [project.canonicalHost, project.apexHost].map(hostname => ({ hostname,
        service: mode === "wrong-domain" ? "wrong" : project.webWorker, environment: mode === "preview-env" ? "preview" : "production" }));
      if (mode === "missing-domain") domains.pop();
      if (mode === "duplicate-domain") domains.push(domains[0]);
      return Response.json({ success: mode !== "invalid-response", result: url.endsWith("/scripts") ? workers : domains }, { status: mode === "forbidden" ? 403 : 200 });
    };
    const run = () => verifyProductionTarget(project, { ...env,
      CLOUDFLARE_ACCOUNT_ID: mode === "wrong-account" ? "unknown" : env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: mode === "missing-token" ? "" : env.CLOUDFLARE_API_TOKEN }, request);
    if (mode === "success") await run();
    else await assert.rejects(run, Error, mode);
    assert.ok(methods.every(method => method === "GET"), "preflight is read-only");
  }
});
