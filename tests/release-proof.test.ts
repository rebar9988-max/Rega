import test from "node:test";
import assert from "node:assert/strict";
import project from "../src/config/project.json";

test("post-deploy proof rejects wrong source, partial rollout, database mismatch, redirects and private admin exposure", async () => {
  const { verifyRelease } = await import("../scripts/health/release-proof.mjs");
  const sha = "a".repeat(40);
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: project.cloudflareAccountId, CLOUDFLARE_API_TOKEN: "synthetic-only" };
  for (const mode of ["success", "version-tag", "allocation", "source-sha", "database", "database-target", "canonical", "redirect-host", "redirect-query", "admin-leak", "admin-missing", "forbidden"]) {
    const request: typeof fetch = async (input, options) => {
      const url = new URL(String(input));
      if (url.hostname === "api.cloudflare.com") {
        assert.equal(options?.redirect, "error");
        if (mode === "forbidden") return Response.json({}, { status: 403 });
        const result = url.pathname.endsWith("/scripts") ? [{ id: project.webWorker, tag: project.webWorkerTag }, { id: project.aiWorker }]
          : url.pathname.endsWith("/domains") ? [project.canonicalHost, project.apexHost].map(hostname => ({ hostname, service: project.webWorker, environment: "production" }))
          : url.pathname.endsWith("/deployments") ? { deployments: [{ id: "synthetic-deploy", versions: [{ version_id: "synthetic-version", percentage: mode === "allocation" ? 50 : 100 }] }] }
          : { annotations: { "workers/tag": mode === "version-tag" ? "b".repeat(40) : sha } };
        return Response.json({ success: true, result });
      }
      assert.equal(options?.headers, undefined, "protected provider authorization never reaches the public website");
      if (url.pathname === "/api/v1/health") return Response.json({ ok: true, sourceSha: mode === "source-sha" ? null : sha,
        checks: { database: mode === "database" ? "error" : "ok", databaseTargetMatchesManifest: mode !== "database-target" } });
      if (url.hostname === project.apexHost || url.pathname === "/dr") {
        const target = new URL(url.hostname === project.apexHost ? "/en" : "/admin", `https://${mode === "redirect-host" ? "other.invalid" : project.canonicalHost}`);
        if (mode !== "redirect-query") target.search = url.search;
        return new Response(null, { status: url.hostname === project.apexHost ? 301 : 308, headers: { location: target.href } });
      }
      if (url.pathname === "/admin") return new Response(mode === "admin-missing" ? "" : `<form data-dr-sign-in></form>${mode === "admin-leak" ? "<aside>private</aside>" : ""}`);
      return new Response(null, { status: mode === "canonical" ? 503 : 200 });
    };
    const run = () => verifyRelease(project, sha, env, request);
    if (mode === "success") assert.equal((await run()).versionId, "synthetic-version");
    else await assert.rejects(run, Error, mode);
  }
});
