import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import manifest from "../src/app/manifest";

test("manifest: installable (name, start URL, standalone, a 192 and a 512 icon that exist on disk)", () => {
  const m = manifest();
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/");
  assert.ok(m.name && m.short_name);
  const sizes = (m.icons ?? []).map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  for (const icon of m.icons ?? []) {
    const file = icon.src.startsWith("/brand/") ? `public${icon.src}` : `src/app${icon.src}`;
    assert.ok(existsSync(file), `${icon.src} -> ${file}`);
  }
});

test("service worker: precaches the offline page that exists, never stores navigations or API responses", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  assert.ok(existsSync("public/offline.html"));
  assert.ok(/PRECACHE = \[OFFLINE/.test(sw));
  // Navigations are network-only with the offline page as the fallback; only /_next/static assets are cached at runtime.
  assert.ok(/mode === "navigate"[\s\S]*caches\.match\(OFFLINE\)/.test(sw));
  assert.equal((sw.match(/cache\.put/g) ?? []).length, 1);
  assert.ok(/request\.method !== "GET"/.test(sw));
  assert.ok(!/\/api\/|\/dr\b/.test(sw.replace(/\/\*[\s\S]*?\*\//, "")), "no personal or dashboard routes are touched");
});

test("offline page: all seven languages with a direction, no external resources", () => {
  const html = readFileSync("public/offline.html", "utf8");
  for (const l of ["en", "de", "ckb", "kmr", "ar", "fa", "tr"]) assert.ok(new RegExp(`\\n\\s+${l}: \\[`).test(html), l);
  for (const l of ["ckb", "ar", "fa"]) assert.ok(new RegExp(`${l}: \\[[^\\n]*"rtl"`).test(html), `${l} is right-to-left`);
  assert.ok(!/(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(html.replace(/www\.w3\.org/g, "")), "no external URLs");
});
