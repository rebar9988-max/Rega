/** PWA: installable manifest, service worker registered in the production build, offline page in the visitor's language. */
import { expect, test } from "@playwright/test";

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

test("offline: a page that cannot be loaded shows the offline page in the language of the address; online works again", async ({ page, context }) => {
  await page.goto("/de");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The worker controls the page after it claimed the clients; reload once so the next navigation is certainly handled by it.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/de/jobs").catch(() => {});
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sie sind offline");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.goto("/ckb/jobs").catch(() => {});
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await context.setOffline(false);
  await page.goto("/de/jobs");
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Jobs");
});
