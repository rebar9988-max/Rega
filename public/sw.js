/*
 * REGA service worker. Two jobs only:
 *  1. When a page cannot be loaded because the device is offline, show /offline.html (in the visitor's language).
 *  2. Keep the build's immutable assets (/_next/static, content-hashed) for faster repeat visits.
 * Pages, API responses, the dashboard and anything with personal data are NEVER stored: navigations always go to the
 * network. Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const CACHE = `rega-static-${VERSION}`;
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/brand/rega-mark-256.webp"];
const MAX_ASSETS = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rega-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function immutableAsset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    const assets = keys.filter((k) => new URL(k.url).pathname.startsWith("/_next/static/"));
    for (const k of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(k);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(immutableAsset(request));
  }
});
