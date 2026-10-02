import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
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

/** Runs public/sw.js in a sandbox with a fake Cache API and returns its event handlers. */
function loadWorker(fetchImpl: (req: unknown) => Promise<unknown>) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Map<string, unknown>>();
  const cacheFor = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name)!;
    return { addAll: async (urls: string[]) => urls.forEach((u) => m.set(u, { url: u, offline: true })), match: async (r: { url?: string } | string) => m.get(typeof r === "string" ? r : r.url ?? ""), put: async (r: { url: string }, res: unknown) => void m.set(r.url, res), keys: async () => [...m.keys()].map((url) => ({ url: `https://x.test${url.startsWith("http") ? new URL(url).pathname : url}` })), delete: async (r: { url: string }) => m.delete(r.url) };
  };
  const caches = { open: async (n: string) => cacheFor(n), match: async (r: string) => { for (const m of store.values()) if (m.has(r)) return m.get(r); }, keys: async () => [...store.keys()], delete: async (n: string) => store.delete(n) };
  const self = { location: { origin: "https://x.test" }, addEventListener: (t: string, h: (e: unknown) => void) => { handlers[t] = h; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches, fetch: fetchImpl, URL, Promise });
  return { handlers, store };
}

test("service worker behaviour: offline navigation gets the offline page; nothing else is stored; API and POST are untouched", async () => {
  let online = false;
  const { handlers, store } = loadWorker(async (req) => { if (!online) throw new Error("offline"); return { ok: true, clone() { return this; }, req }; });
  await new Promise<void>((resolve) => { handlers.install({ waitUntil: (p: Promise<unknown>) => p.then(() => resolve()) }); });
  const respond = (request: Record<string, unknown>) => { let out: Promise<unknown> | undefined; handlers.fetch({ request, respondWith: (p: Promise<unknown>) => { out = p; } }); return out; };

  // Offline: a page navigation is answered with the precached offline page.
  const res = (await respond({ method: "GET", mode: "navigate", url: "https://x.test/de/jobs" })) as { offline?: boolean };
  assert.equal(res.offline, true);
  // Online: navigations (even personal pages) are passed through and never stored.
  online = true;
  await respond({ method: "GET", mode: "navigate", url: "https://x.test/de/account" });
  await respond({ method: "GET", mode: "navigate", url: "https://x.test/dr/businesses" });
  // API calls, POSTs and other origins are not handled at all.
  assert.equal(respond({ method: "GET", mode: "cors", url: "https://x.test/api/v1/businesses" }), undefined);
  assert.equal(respond({ method: "POST", mode: "cors", url: "https://x.test/_next/static/a.js" }), undefined);
  assert.equal(respond({ method: "GET", mode: "cors", url: "https://other.test/_next/static/a.js" }), undefined);
  // Immutable build assets are cached.
  await respond({ method: "GET", mode: "no-cors", url: "https://x.test/_next/static/chunks/a.js" });
  const stored = [...store.values()].flatMap((m) => [...m.keys()]);
  assert.ok(stored.some((u) => u.includes("/_next/static/chunks/a.js")));
  assert.ok(!stored.some((u) => /\/(de|ckb)\/|\/dr\/|\/api\//.test(u)), `stored: ${stored.join(", ")}`);
});

test("offline page script: language and direction follow the first path segment, unknown falls back to English", () => {
  const html = readFileSync("public/offline.html", "utf8");
  const script = /<script>([\s\S]*)<\/script>/.exec(html)![1];
  const run = (pathname: string) => {
    const el: Record<string, { textContent: string; addEventListener: () => void }> = {};
    const root = { lang: "", dir: "", setAttribute() {} };
    const document = { documentElement: root, getElementById: (id: string) => (el[id] ??= { textContent: "", addEventListener() {} }) };
    vm.runInNewContext(script, { document, location: { pathname, reload() {} }, localStorage: { getItem: () => null } });
    return { lang: root.lang, dir: root.dir, title: el.t.textContent };
  };
  assert.deepEqual(run("/de/jobs"), { lang: "de", dir: "ltr", title: "Sie sind offline" });
  assert.equal(run("/ckb/jobs").dir, "rtl");
  assert.equal(run("/ar/events").dir, "rtl");
  assert.equal(run("/fa/x").dir, "rtl");
  assert.equal(run("/kmr/x").lang, "ku");
  assert.deepEqual(run("/zz/whatever"), { lang: "en", dir: "ltr", title: "You are offline" });
});
