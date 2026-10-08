import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import nextConfig from "../next.config";

test("fingerprinted Next.js assets are cached for a year as immutable (public/_headers, Workers static assets)", () => {
  const headers = readFileSync("public/_headers", "utf8");
  assert.match(headers, /^\/_next\/static\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
});

test("security.txt (RFC 9116): contact and an expiry within the next year", () => {
  const txt = readFileSync("public/.well-known/security.txt", "utf8");
  assert.match(txt, /^Contact: mailto:info@regaplatform\.com$/m);
  const expires = /^Expires: (.+)$/m.exec(txt)?.[1];
  assert.ok(expires, "Expires is required");
  const ms = Date.parse(expires) - Date.now();
  assert.ok(ms > 0, "security.txt has expired: move Expires forward");
  assert.ok(ms <= 366 * 86_400_000, "Expires should be less than a year ahead (RFC 9116)");
});

test("/favicon.ico is a real ICO file, not a redirect through the Worker", async () => {
  assert.ok(existsSync("public/favicon.ico"));
  const head = readFileSync("public/favicon.ico").subarray(0, 4);
  assert.deepEqual([...head], [0, 0, 1, 0], "ICO magic bytes");
  const rules = (await nextConfig.redirects!()) as { source: string }[];
  assert.ok(!rules.some((r) => r.source === "/favicon.ico"));
});
