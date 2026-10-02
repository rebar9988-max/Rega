/**
 * Edge cache for anonymous page renders (Cloudflare Cache API, per data centre).
 *
 * Why: every public page is server-rendered on each request (28–75 ms CPU per render, measured), which is far above
 * the Worker's per-request CPU allowance; sustained traffic exhausted it and Cloudflare answered every request with
 * error 1102. Identical anonymous requests now reuse one render for TTL_SECONDS, so a cache hit costs ~1–2 ms CPU.
 *
 * Only what is identical for every anonymous visitor is cached:
 * - GET requests without a session (auth) or draft-mode cookie and without an Authorization header;
 * - never /api, /dr (dashboard), /_next, login or account pages;
 * - only 200 responses with HTML or RSC content, whose Vary headers are all part of the cache key, and whose only
 *   Set-Cookie headers are the locale preference cookies (derived from the URL, the same for everybody).
 * The key is the full URL (path and query) plus the values of the Next.js router headers the response varies on,
 * so client navigations and prefetches get their own entries. The browser still receives the original
 * Cache-Control (no-store), so nothing is cached in a visitor's browser.
 */

/**
 * 300 s: measured in production with 60 s, the synchronized re-render of every cached URL at each expiry (about 12
 * renders within seconds, every minute) used up the Worker's CPU allowance again and produced 1102. Public pages can
 * be up to five minutes behind an admin edit; signed-in visitors (and the dashboard) always see fresh renders.
 */
export const TTL_SECONDS = 300;
export const CACHE_HEADER = "x-rega-cache";

/** Request headers Next.js varies page responses on (RSC payloads, prefetches, interception routes). */
const KEY_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"] as const;
/** Vary entries that are covered by the key (or irrelevant for cached copies). */
const VARY_OK = new Set<string>([...KEY_HEADERS, "accept-encoding"]);
/** Cookies whose presence makes a page personal (signed-in header, draft mode). */
const PERSONAL_COOKIE = /(?:^|;\s*)(?:__Secure-|__Host-)?(?:authjs|next-auth)\.[^=]*=|(?:^|;\s*)__prerender_bypass=/i;
/** Set-Cookie headers that may be replayed from the cache: locale preference only. */
const REPLAYABLE_COOKIE = /^(?:NEXT_LOCALE|REGA_LOCALE)=/;
const BYPASS_PATH = /^\/(?:api|dr|_next)(?:\/|$)|^\/[a-z]{2,3}\/(?:login|account)(?:\/|$)/;
const MAX_KEY_LENGTH = 6000;

const REPLAY_HEADER = "x-rega-replay-set-cookie";
const CLIENT_CC_HEADER = "x-rega-client-cache-control";

/** Cache key URL for a request, or null when the request must not use the cache. Pure. */
export function edgeCacheKey(request: Request): string | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (BYPASS_PATH.test(url.pathname)) return null;
  if (request.headers.has("authorization")) return null;
  if (PERSONAL_COOKIE.test(request.headers.get("cookie") ?? "")) return null;
  const vary = KEY_HEADERS.map((h) => `${h}:${request.headers.get(h) ?? ""}`).join("|");
  const key = `${url.origin}/__rega-edge-cache/v1${url.pathname}?u=${encodeURIComponent(url.search)}&v=${encodeURIComponent(vary)}`;
  return key.length > MAX_KEY_LENGTH ? null : key;
}

/** A copy of `response` suitable for the cache, or null when it must not be cached. Pure. */
export function cacheableCopy(response: Response): Response | null {
  if (response.status !== 200 || !response.body) return null;
  const type = response.headers.get("content-type") ?? "";
  if (!/^text\/html|^text\/x-component/i.test(type)) return null;
  const vary = (response.headers.get("vary") ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (vary.some((v) => !VARY_OK.has(v))) return null;
  const cookies = getSetCookies(response.headers);
  if (cookies.some((c) => !REPLAYABLE_COOKIE.test(c))) return null;

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  if (cookies.length) headers.set(REPLAY_HEADER, JSON.stringify(cookies));
  headers.set(CLIENT_CC_HEADER, response.headers.get("cache-control") ?? "");
  headers.set("cache-control", `public, max-age=${TTL_SECONDS}`);
  headers.delete(CACHE_HEADER);
  return new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers });
}

/** Turns a cached copy back into the response the visitor gets (original Cache-Control and locale cookies). Pure. */
export function fromCache(cached: Response): Response {
  const headers = new Headers(cached.headers);
  const replay = headers.get(REPLAY_HEADER);
  headers.delete(REPLAY_HEADER);
  if (replay) for (const c of JSON.parse(replay) as string[]) headers.append("set-cookie", c);
  const clientCc = headers.get(CLIENT_CC_HEADER);
  headers.delete(CLIENT_CC_HEADER);
  if (clientCc) headers.set("cache-control", clientCc); else headers.delete("cache-control");
  headers.delete("age");
  headers.delete("cf-cache-status");
  headers.set(CACHE_HEADER, "HIT");
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}

function getSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[]; getAll?: (name: string) => string[] };
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  if (typeof h.getAll === "function") return h.getAll("set-cookie");
  const one = headers.get("set-cookie");
  return one ? [one] : [];
}

function withHeader(response: Response, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set(CACHE_HEADER, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

type Ctx = { waitUntil(promise: Promise<unknown>): void };
type Fetch<E> = (request: Request, env: E, ctx: Ctx) => Promise<Response>;

/** Wraps the OpenNext Worker's fetch handler with the edge cache. Any cache failure falls back to rendering. */
export function withEdgeCache<E>(render: Fetch<E>): Fetch<E> {
  return async (request, env, ctx) => {
    const key = edgeCacheKey(request);
    const cache = key ? (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default : undefined;
    if (!key || !cache) return withHeader(await render(request, env, ctx), "BYPASS");

    const keyRequest = new Request(key, { method: "GET" });
    try {
      const hit = await cache.match(keyRequest);
      if (hit) return fromCache(hit);
    } catch {
      // Cache unavailable: render normally.
    }
    const response = await render(request, env, ctx);
    const copy = cacheableCopy(response);
    if (!copy) return withHeader(response, "BYPASS");
    ctx.waitUntil(cache.put(keyRequest, copy).catch(() => undefined));
    return withHeader(response, "MISS");
  };
}
