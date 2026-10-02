import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_HEADER, NO_STORE_MARKER, cacheableCopy, edgeCacheKey, fromCache, inFlightCount, renderedWithoutData, withEdgeCache } from "../src/lib/edge-cache";

const req = (path: string, init: RequestInit = {}) => new Request(`https://www.regaplatform.com${path}`, init);
const html = (headers: Record<string, string> = {}, status = 200) =>
  new Response("<html>ok</html>", { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate", ...headers } });

test("public anonymous GET pages get a key; query strings and router headers are part of it", () => {
  const a = edgeCacheKey(req("/ckb"));
  assert.ok(a);
  assert.notEqual(edgeCacheKey(req("/ckb?q=1")), a);
  assert.notEqual(edgeCacheKey(req("/ckb", { headers: { rsc: "1" } })), a);
  assert.notEqual(edgeCacheKey(req("/ckb", { headers: { rsc: "1", "next-router-state-tree": "x" } })), edgeCacheKey(req("/ckb", { headers: { rsc: "1" } })));
  assert.equal(edgeCacheKey(req("/ckb", { headers: { cookie: "theme=dark; REGA_LOCALE=ckb" } })), a); // non-personal cookies
});

test("bots that get a different HTML variant never share an entry with browsers", () => {
  const ua = (v: string) => req("/ckb", { headers: { "user-agent": v } });
  const chrome = edgeCacheKey(ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"));
  const safari = edgeCacheKey(ua("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"));
  const facebook = edgeCacheKey(ua("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"));
  const whatsapp = edgeCacheKey(ua("WhatsApp/2.23.20.0"));
  const googlebot = edgeCacheKey(ua("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
  assert.equal(chrome, safari); // all browsers share one entry
  assert.equal(chrome, edgeCacheKey(req("/ckb"))); // no user agent = browser variant
  assert.equal(facebook, whatsapp); // all HTML-limited bots share one entry
  assert.notEqual(facebook, chrome);
  assert.notEqual(googlebot, chrome);
  assert.notEqual(googlebot, facebook);
});

test("personal, private and non-GET requests are never cached", () => {
  for (const cookie of ["authjs.session-token=x", "__Secure-authjs.session-token=x", "a=1; __Secure-authjs.session-token.0=x", "next-auth.session-token=x", "__prerender_bypass=x"]) {
    assert.equal(edgeCacheKey(req("/ckb", { headers: { cookie } })), null, cookie);
  }
  assert.equal(edgeCacheKey(req("/ckb", { headers: { authorization: "Bearer x" } })), null);
  assert.equal(edgeCacheKey(req("/ckb", { method: "POST" })), null);
  assert.equal(edgeCacheKey(req("/ckb", { method: "HEAD" })), null);
  for (const p of ["/api/v1/health", "/dr", "/dr/businesses", "/_next/static/x.js", "/ckb/login", "/de/login?next=%2Fdr", "/ckb/account"]) assert.equal(edgeCacheKey(req(p)), null, p);
  assert.ok(edgeCacheKey(req("/ckb/businesses")));
  assert.ok(edgeCacheKey(req("/drinks"))); // only the /dr segment itself is private
});

test("only 200 HTML/RSC responses without personal cookies or foreign Vary are stored", () => {
  assert.ok(cacheableCopy(html()));
  assert.ok(cacheableCopy(new Response("x", { headers: { "content-type": "text/x-component" } })));
  assert.equal(cacheableCopy(html({}, 404)), null);
  assert.equal(cacheableCopy(new Response("{}", { headers: { "content-type": "application/json" } })), null);
  assert.equal(cacheableCopy(html({ "set-cookie": "authjs.session-token=x; Path=/" })), null);
  assert.equal(cacheableCopy(html({ vary: "Cookie" })), null);
  assert.ok(cacheableCopy(html({ vary: "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding" })));
});

test("cached copy: public TTL in the cache, original Cache-Control and locale cookies for the visitor", () => {
  const original = html({ "set-cookie": "REGA_LOCALE=ckb; Path=/; Max-Age=31536000; SameSite=lax" });
  const copy = cacheableCopy(original)!;
  assert.equal(copy.headers.get("cache-control"), "public, max-age=300");
  assert.equal(copy.headers.get("set-cookie"), null);
  const back = fromCache(copy);
  assert.equal(back.headers.get("cache-control"), "private, no-cache, no-store, max-age=0, must-revalidate");
  assert.match(back.headers.get("set-cookie") ?? "", /^REGA_LOCALE=ckb/);
  assert.equal(back.headers.get(CACHE_HEADER), "HIT");
});

test("wrapper: second identical request is served from the cache without rendering; personal requests always render", async () => {
  const store = new Map<string, Response>();
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => { store.set(r.url, new Response(await res.text(), res)); },
    },
  };
  let renders = 0;
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
  const handler = withEdgeCache(async () => { renders++; return html({ "set-cookie": "REGA_LOCALE=ckb; Path=/" }); });

  const first = await handler(req("/ckb"), {}, ctx);
  assert.equal(first.headers.get(CACHE_HEADER), "MISS");
  assert.equal(await first.text(), "<html>ok</html>");
  await Promise.all(pending);
  const second = await handler(req("/ckb"), {}, ctx);
  assert.equal(second.headers.get(CACHE_HEADER), "HIT");
  assert.equal(await second.text(), "<html>ok</html>");
  assert.match(second.headers.get("set-cookie") ?? "", /REGA_LOCALE=ckb/);
  assert.equal(renders, 1);

  const signedIn = await handler(req("/ckb", { headers: { cookie: "__Secure-authjs.session-token=abc" } }), {}, ctx);
  assert.equal(signedIn.headers.get(CACHE_HEADER), "BYPASS");
  assert.equal(renders, 2);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

test("a render marked as rendered without its data is sent but never stored", async () => {
  const store = new Map<string, Response>();
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => { store.set(r.url, new Response(await res.text(), res)); },
    },
  };
  let degraded = true;
  let renders = 0;
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
  const page = () => new Response(`<html><head>${degraded ? `<meta name="${NO_STORE_MARKER}" content="1"/>` : ""}</head><body>x</body></html>`, { headers: { "content-type": "text/html" } });
  const handler = withEdgeCache(async () => { renders++; return page(); });

  const outage = await handler(req("/ckb"), {}, ctx);
  assert.match(await outage.text(), new RegExp(NO_STORE_MARKER)); // the visitor still gets the page
  await Promise.all(pending);
  assert.equal(store.size, 0);
  degraded = false;
  assert.equal((await handler(req("/ckb"), {}, ctx)).headers.get(CACHE_HEADER), "MISS"); // rendered again
  await Promise.all(pending);
  assert.equal((await handler(req("/ckb"), {}, ctx)).headers.get(CACHE_HEADER), "HIT");
  assert.equal(renders, 2);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

// Shapes produced by React 19 when a <Suspense> section throws on the server after the 200 shell was streamed (the
// list pages' results during a database outage), and the RSC error row of a client navigation.
const STREAMED_ERROR_HTML =
  `<html><body><h1>shell</h1><!--$?--><template id="B:0"></template><div>skeleton</div><!--/$-->` +
  `<script>$RX=function(b,c){};$RX("B:0","123456")</script></body></html>`;
const EARLY_ERROR_HTML = `<html><body><!--$!--><template data-dgst="123456"></template><div>skeleton</div><!--/$--></body></html>`;
const RSC_ERROR = `0:["$","div",null,{}]\n5:E{"digest":"123456"}\n`;

test("render errors React streams into a 200 response are detected; healthy pages and look-alike user text are not", () => {
  assert.ok(renderedWithoutData(STREAMED_ERROR_HTML));
  assert.ok(renderedWithoutData(EARLY_ERROR_HTML));
  assert.ok(renderedWithoutData(RSC_ERROR));
  assert.ok(renderedWithoutData(`5:E{"digest":"1"}`)); // first row of a payload
  assert.ok(renderedWithoutData(`<meta name="${NO_STORE_MARKER}" content="1"/>`));
  // A healthy streamed page: a boundary completed later ($RC), no error.
  assert.equal(renderedWithoutData(`<!--$?--><template id="B:0"></template>x<!--/$--><div hidden id="S:0">data</div><script>$RC("B:0","S:0")</script>`), false);
  // User text: escaped in HTML, JSON-encoded (no raw newline) in RSC and in the inline RSC data of HTML.
  assert.equal(renderedWithoutData(`<p>&lt;!--$!--&gt; $RX(&quot;B:0&quot;) 5:E{</p>`), false);
  assert.equal(renderedWithoutData(`1:["$","p",null,{"children":"a\\n5:E{b"}]\n`), false);
  assert.equal(renderedWithoutData(`<script>self.__next_f.push([1,"1:[\\"$\\",\\"p\\",null,{}]\\n"])</script>`), false);
  assert.equal(renderedWithoutData("<html><body>ok</body></html>"), false);
});

test("a page whose streamed section failed (database outage) is sent but neither stored nor shared", async () => {
  const store = new Map<string, Response>();
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => { store.set(r.url, new Response(await res.text(), res)); },
    },
  };
  for (const [type, failed, ok] of [["text/html", STREAMED_ERROR_HTML, "<html>ok</html>"], ["text/x-component", RSC_ERROR, `0:["$","div",null,{}]\n`]]) {
    let outage = true;
    let renders = 0;
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const handler = withEdgeCache(async () => {
      renders++;
      if (renders === 1) await gate;
      return new Response(outage ? failed : ok, { headers: { "content-type": type } });
    });
    const path = `/de/businesses?t=${encodeURIComponent(type)}`;
    const leader = handler(req(path), {}, ctx);
    const waiter = handler(req(path), {}, ctx); // waits for the leader's render
    release();
    assert.equal(await (await leader).text(), failed); // the visitor still gets the page with its error state
    const second = await waiter;
    assert.equal(second.headers.get(CACHE_HEADER), "BYPASS"); // the failed render is never shared: own render
    await Promise.all(pending);
    assert.equal(store.size, 0, type);
    outage = false;
    assert.equal((await handler(req(path), {}, ctx)).headers.get(CACHE_HEADER), "MISS"); // database back: fresh render
    await Promise.all(pending);
    assert.equal((await handler(req(path), {}, ctx)).headers.get(CACHE_HEADER), "HIT");
    assert.equal(renders, 3);
    store.clear();
  }
  assert.equal(inFlightCount(), 0);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

test("concurrent identical misses share one render; only a cacheable, unmarked render is ever shared", async () => {
  const store = new Map<string, Response>();
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => { store.set(r.url, new Response(await res.text(), res)); },
    },
  };
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
  let renders = 0;
  let make: () => Response = () => html({ "set-cookie": "REGA_LOCALE=ckb; Path=/" });
  const handler = withEdgeCache(async () => { renders++; await new Promise((r) => setTimeout(r, 30)); return make(); });
  const burst = async (path: string, n: number, init: RequestInit = {}) => Promise.all(Array.from({ length: n }, () => handler(req(path, init), {}, ctx)));

  // 1. A cacheable page: one render, everyone gets the same page and the locale cookie, the original Cache-Control.
  let res = await burst("/ckb/a", 6);
  assert.equal(renders, 1);
  assert.deepEqual(res.map((r) => r.headers.get(CACHE_HEADER)).sort(), ["COALESCED", "COALESCED", "COALESCED", "COALESCED", "COALESCED", "MISS"]);
  for (const r of res) {
    assert.equal(await r.text(), "<html>ok</html>");
    assert.match(r.headers.get("set-cookie") ?? "", /^REGA_LOCALE=ckb/);
    assert.equal(r.headers.get("cache-control"), "private, no-cache, no-store, max-age=0, must-revalidate");
  }
  await Promise.all(pending);
  assert.equal((await handler(req("/ckb/a"), {}, ctx)).headers.get(CACHE_HEADER), "HIT");
  assert.equal(renders, 1);

  // 2. Not cacheable (a personal cookie, an error status) or marked as rendered without data: every request renders.
  for (const [path, page] of [
    ["/ckb/b", () => html({ "set-cookie": "authjs.session-token=x; Path=/" })],
    ["/ckb/c", () => html({}, 500)],
    ["/ckb/d", () => new Response(`<meta name="${NO_STORE_MARKER}" content="1">`, { headers: { "content-type": "text/html" } })],
  ] as const) {
    renders = 0;
    make = page;
    res = await burst(path, 4);
    await Promise.all(pending);
    assert.equal(renders, 4, path);
    assert.ok(res.every((r) => r.headers.get(CACHE_HEADER) !== "COALESCED"), path);
  }

  // 3. A failed render is not shared either; different keys (browser vs bot) never share.
  renders = 0;
  make = () => { throw new Error("render failed"); };
  const failed = await Promise.allSettled(Array.from({ length: 3 }, () => handler(req("/ckb/e"), {}, ctx)));
  assert.equal(renders, 3);
  assert.ok(failed.every((r) => r.status === "rejected"));
  renders = 0;
  make = () => html();
  await Promise.all([handler(req("/ckb/f"), {}, ctx), handler(req("/ckb/f", { headers: { "user-agent": "facebookexternalhit/1.1" } }), {}, ctx)]);
  assert.equal(renders, 2);
  await Promise.all(pending);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

// In-flight entry lifetime. A leader whose invocation is cancelled before its render returns never runs its own
// cleanup; that is simulated here with a render that never settles (real workerd cancellation is not reproduced).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function memoryCache() {
  const store = new Map<string, Response>();
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => { store.set(r.url, new Response(await res.text(), res)); },
    },
  };
  const pending: Promise<unknown>[] = [];
  return { store, pending, ctx: { waitUntil: (p: Promise<unknown>) => { pending.push(p); } } };
}

test("an unfinished leader holds its key only until the entry expires; the next request leads and is stored", async () => {
  const { pending, ctx } = memoryCache();
  let renders = 0;
  const h = withEdgeCache(async () => { renders++; if (renders === 1) return new Promise<Response>(() => undefined); await sleep(5); return html(); }, { coalesceWaitMs: 300 });

  void h(req("/ckb/stuck"), {}, ctx); // never settles
  await sleep(10);
  let t = Date.now();
  const waiting = await Promise.all([h(req("/ckb/stuck"), {}, ctx), h(req("/ckb/stuck"), {}, ctx)]);
  const waited = Date.now() - t;
  assert.deepEqual(waiting.map((r) => r.headers.get(CACHE_HEADER)), ["BYPASS", "BYPASS"]); // own render after expiry
  assert.ok(waited >= 250 && waited < 2000, `waited ${waited} ms`);

  t = Date.now();
  const next = await h(req("/ckb/stuck"), {}, ctx); // entry expired: leads at once instead of waiting
  assert.equal(next.headers.get(CACHE_HEADER), "MISS");
  assert.ok(Date.now() - t < 250);
  await Promise.all(pending);
  assert.equal((await h(req("/ckb/stuck"), {}, ctx)).headers.get(CACHE_HEADER), "HIT");
  assert.equal(renders, 4);
  assert.equal(inFlightCount(), 0);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

test("expired entries of other keys are swept when a render starts (no growth from unfinished renders)", async () => {
  const { pending, ctx } = memoryCache();
  let renders = 0;
  const h = withEdgeCache(async (r: Request) => { renders++; if (r.url.includes("/never")) return new Promise<Response>(() => undefined); return html(); }, { coalesceWaitMs: 50 });
  void h(req("/ckb/never-1"), {}, ctx);
  void h(req("/ckb/never-2"), {}, ctx);
  await sleep(10);
  assert.equal(inFlightCount(), 2);
  await sleep(60);
  await h(req("/ckb/other"), {}, ctx);
  await Promise.all(pending);
  assert.equal(inFlightCount(), 0);
  assert.equal(renders, 3);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

test("entries are removed after normal completion, a non-cacheable response and a failed render", async () => {
  const { pending, ctx } = memoryCache();
  let mode: "ok" | "500" | "throw" = "ok";
  const h = withEdgeCache(async () => {
    await sleep(5);
    if (mode === "throw") throw new Error("render failed");
    return mode === "500" ? html({}, 500) : html();
  }, { coalesceWaitMs: 5_000 });

  assert.equal((await h(req("/ckb/c1"), {}, ctx)).headers.get(CACHE_HEADER), "MISS");
  await Promise.all(pending);
  assert.equal(inFlightCount(), 0);

  mode = "500";
  assert.equal((await h(req("/ckb/c2"), {}, ctx)).headers.get(CACHE_HEADER), "BYPASS");
  assert.equal(inFlightCount(), 0);

  mode = "throw";
  await assert.rejects(h(req("/ckb/c3"), {}, ctx), /render failed/);
  assert.equal(inFlightCount(), 0);
  mode = "ok";
  const t = Date.now();
  assert.equal((await h(req("/ckb/c3"), {}, ctx)).headers.get(CACHE_HEADER), "MISS"); // no wait on the failed render
  assert.ok(Date.now() - t < 1000);
  await Promise.all(pending);
  assert.equal(inFlightCount(), 0);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

test("an older render finishing after expiry never removes the newer entry for the same key", async () => {
  const { pending, ctx } = memoryCache();
  let renders = 0;
  const h = withEdgeCache(async () => {
    renders++;
    if (renders === 1) { await sleep(650); return html({}, 500); } // old leader: outlives its entry, not cacheable
    await sleep(200);
    return html();
  }, { coalesceWaitMs: 500 });

  const old = h(req("/ckb/race"), {}, ctx); // t=0, entry expires at 500
  await sleep(520);
  const newer = h(req("/ckb/race"), {}, ctx); // t≈520: leads with a new entry (expires ≈1020), done ≈720
  await old; // t≈650: the old render ends; it must not remove the newer entry
  await sleep(50);
  const late = await h(req("/ckb/race"), {}, ctx); // t≈700: waits for the newer render
  assert.equal((await newer).headers.get(CACHE_HEADER), "MISS");
  assert.equal(late.headers.get(CACHE_HEADER), "COALESCED");
  assert.equal(renders, 2);
  await Promise.all(pending);
  assert.equal(inFlightCount(), 0);
  delete (globalThis as unknown as { caches?: unknown }).caches;
});
