import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, maskEmail } from "../src/lib/client-ip";
import { mediaUploadRequestSchema } from "../src/lib/validation";
import { buildObjectKey } from "../src/lib/object-key";
import { pageParams } from "../src/lib/paging";

test("client IP: Cloudflare's header wins over a spoofable X-Forwarded-For", () => {
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" })), "198.51.100.2");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("emails are masked in logs", () => {
  assert.equal(maskEmail("alice@example.org"), "a***@example.org");
  assert.equal(maskEmail("nonsense"), "***");
});

test("uploads: only allow-listed media types; HTML, SVG, scripts and executables are rejected", () => {
  const base = { filename: "x", sizeBytes: 100 };
  for (const mimeType of ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"]) {
    assert.ok(mediaUploadRequestSchema.safeParse({ ...base, mimeType }).success, mimeType);
  }
  for (const mimeType of ["text/html", "image/svg+xml", "application/javascript", "application/x-msdownload", "application/zip", "application/octet-stream"]) {
    assert.ok(!mediaUploadRequestSchema.safeParse({ ...base, mimeType }).success, mimeType);
  }
  assert.ok(!mediaUploadRequestSchema.safeParse({ ...base, mimeType: "image/png", sizeBytes: 26 * 1024 * 1024 }).success, "size cap");
});

test("uploads: the object key extension comes from the MIME type, never from the filename", () => {
  const key = buildObjectKey({ filename: "evil.html", mimeType: "image/png" });
  assert.match(key, /^library\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
  assert.ok(!buildObjectKey({ filename: "../../x.php", mimeType: "application/pdf" }).includes(".."));
});

test("pagination is bounded (no unbounded offsets or page sizes)", () => {
  const p = pageParams(new URL("https://x/?page=999999999&perPage=100000"));
  assert.equal(p.page, 500);
  assert.equal(p.perPage, 100);
  assert.equal(pageParams(new URL("https://x/?page=-5&perPage=abc")).page, 1);
});
