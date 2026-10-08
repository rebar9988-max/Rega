import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("fingerprinted Next.js assets are cached for a year as immutable (public/_headers, Workers static assets)", () => {
  const headers = readFileSync("public/_headers", "utf8");
  assert.match(headers, /^\/_next\/static\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
});
