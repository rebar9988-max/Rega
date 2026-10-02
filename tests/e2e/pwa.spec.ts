/** PWA: installable manifest, service worker registered in the production build, offline page in the visitor's language. */
import { expect, test } from "@playwright/test";

// Going offline cannot be emulated for a service worker's own requests in Playwright (they bypass setOffline), so the
// worker's fallback and the offline page's language choice are verified in tests/pwa.test.ts by running the real files.

test("manifest, service worker and offline page are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect((await request.get("/offline.html")).status()).toBe(200);
});

test("the service worker registers, takes control and has stored the offline page and nothing else of the site", async ({ page }) => {
  await page.goto("/de");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // Visit a personal page and an API route, then look at what the worker stored: only the precache and /_next/static assets.
  await page.goto("/de/login");
  await page.request.get("/api/v1/health");
  const stored = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(stored).toContain("/offline.html");
  for (const path of stored) expect(path === "/offline.html" || path === "/brand/rega-mark-256.webp" || path.startsWith("/_next/static/"), path).toBe(true);
});

test("the offline page is served as a plain static page", async ({ page }) => {
  await page.goto("/offline.html", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You are offline");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
