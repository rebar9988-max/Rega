import test from "node:test";
import assert from "node:assert/strict";
import { withPreviewIsolation } from "../src/lib/preview-isolation";

test("preview requests cannot reach database, providers, authentication or edge cache", async () => {
  let calls = 0;
  const handler = withPreviewIsolation(async () => { calls++; return new Response("production"); });
  for (const path of ["/", "/api/v1/health", "/api/v1/ai/chat", "/dr", "/__preview-health"]) {
    const response = await handler(new Request(`https://preview.example.test${path}`), { REGA_ISOLATED_PREVIEW: "1" }, {});
    assert.equal(response.status, path === "/__preview-health" ? 200 : 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).applicationReady, false);
  }
  assert.equal(calls, 0);
  assert.equal((await handler(new Request("https://www.rega24.com"), {}, {})).status, 200);
  assert.equal(calls, 1);
});
