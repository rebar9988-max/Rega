import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_HEADER, cacheableCopy, edgeCacheKey, fromCache, withEdgeCache } from "../src/lib/edge-cache";

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
