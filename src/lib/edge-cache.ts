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
 *   Set-Cookie headers are the locale preference cookies (derived from the URL, the same for everybody);
 * - never a render made without its data (database outage): see NO_STORE_MARKER and RENDER_ERROR.
 * The key is the full URL (path and query), the values of the Next.js router headers the response varies on (so client
 * navigations and prefetches get their own entries) and the kind of client by Next.js's own bot classification: link
 * preview and search bots get a non-streamed HTML variant with the metadata in <head>, so a bot render is never
 * served to browsers and a browser render never to bots. The browser still receives the original
 * Cache-Control (no-store), so nothing is cached in a visitor's browser.
 */

import { getBotType } from "next/dist/shared/lib/router/utils/is-bot";

/**
 * 300 s: measured in production with 60 s, the synchronized re-render of every cached URL at each expiry (about 12
 * renders within seconds, every minute) used up the Worker's CPU allowance again and produced 1102. Public pages can
 * be up to five minutes behind an admin edit; signed-in visitors (and the dashboard) always see fresh renders.
 */
export const TTL_SECONDS = 300;
export const CACHE_HEADER = "x-rega-cache";
/**
 * Pages that had to render without their data (database briefly unavailable) say so with this marker
 * (<NoEdgeCache />). Such a render is sent to the visitor but never stored, so a short outage is not served from the
 * cache for TTL_SECONDS after the database is back.
 */
export const NO_STORE_MARKER = "rega-edge-cache-no-store";
/**
 * React's own signs that part of a page failed on the server after the 200 response had already started streaming,
 * e.g. the list pages' <Suspense> results during a database outage (no page code catches those errors, so they carry
 * no NO_STORE_MARKER): an errored boundary in HTML (`<!--$!-->` if it failed before its fallback was sent, a
 * `$RX("…")` call after) and an error row in an RSC payload (`<id>:E{…}`). User text does not produce these (HTML text
 * is escaped, RSC strings are JSON-encoded); a rare false match would only skip storing that render. Such a render is
 * sent to the visitor but never stored or shared.
 */
const RENDER_ERROR = /<!--\$!-->|\$RX\("|(?:^|\n)[0-9a-f]+:E\{/;

/** True when a page body says it was rendered without (part of) its data: the explicit marker or a render error. Pure. */
export function renderedWithoutData(body: string): boolean {
  return body.includes(NO_STORE_MARKER) || RENDER_ERROR.test(body);
}

/** Request headers Next.js varies page responses on (RSC payloads, prefetches, interception routes). */
const KEY_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"] as const;
/** Vary entries that are covered by the key (or irrelevant for cached copies). */
const VARY_OK = new Set<string>([...KEY_HEADERS, "accept-encoding"]);
/** Cookies whose presence makes a page personal (signed-in header, draft mode). */
const PERSONAL_COOKIE = /(?:^|;\s*)(?:__Secure-|__Host-)?(?:authjs|next-auth)\.[^=]*=|(?:^|;\s*)__prerender_bypass=/i;
/** Set-Cookie headers that may be replayed from the cache: locale preference only. */
const REPLAYABLE_COOKIE = /^(?:NEXT_LOCALE|REGA_LOCALE)=/;
// Pages with one-time tokens in the URL or per-user content are never stored.
const BYPASS_PATH = /^\/(?:api|dr|_next)(?:\/|$)|^\/[a-z]{2,3}\/(?:login|account|register|verify-email|forgot-password|reset-password)(?:\/|$)/;
const MAX_KEY_LENGTH = 6000;

const REPLAY_HEADER = "x-rega-replay-set-cookie";
const CLIENT_CC_HEADER = "x-rega-client-cache-control";

/** "html" (link-preview/search bots that get non-streamed HTML), "dom" (Googlebot) or "" (browsers). Pure. */
export function clientKind(request: Request): string {
  return getBotType(request.headers.get("user-agent") ?? "") ?? "";
}

/** Cache key URL for a request, or null when the request must not use the cache. Pure. */
export function edgeCacheKey(request: Request): string | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (BYPASS_PATH.test(url.pathname)) return null;
  if (request.headers.has("authorization")) return null;
  if (PERSONAL_COOKIE.test(request.headers.get("cookie") ?? "")) return null;
  const vary = [...KEY_HEADERS.map((h) => `${h}:${request.headers.get(h) ?? ""}`), `bot:${clientKind(request)}`].join("|");
  const key = `${url.origin}/__rega-edge-cache/v2${url.pathname}?u=${encodeURIComponent(url.search)}&v=${encodeURIComponent(vary)}`;
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
export function fromCache(cached: Response, label = "HIT"): Response {
  const headers = new Headers(cached.headers);
  const replay = headers.get(REPLAY_HEADER);
  headers.delete(REPLAY_HEADER);
  if (replay) for (const c of JSON.parse(replay) as string[]) headers.append("set-cookie", c);
  const clientCc = headers.get(CLIENT_CC_HEADER);
  headers.delete(CLIENT_CC_HEADER);
  if (clientCc) headers.set("cache-control", clientCc); else headers.delete("cache-control");
  headers.delete("age");
  headers.delete("cf-cache-status");
  headers.set(CACHE_HEADER, label);
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

/** A cacheable render held in memory: what is stored, and what concurrent identical requests are given. */
type Stored = { body: string; status: number; statusText: string; headers: [string, string][] };
const toResponse = (s: Stored) => new Response(s.body, { status: s.status, statusText: s.statusText, headers: s.headers });

/**
 * Renders in progress in this isolate, by cache key. Concurrent identical requests that miss the cache (a new or just
 * expired URL) wait for the one render instead of each rendering the same page (measured: N concurrent misses = N
 * renders). They only ever receive a render that is stored for everyone anyway (same key, cacheable, not marked).
 *
 * Every entry expires COALESCE_WAIT_MS after its render started. If the leading request never finishes (its
 * invocation cancelled before the render returned, so its own cleanup never runs), the entry stops being waited on at
 * that time and the next request for the key starts a new render; expired entries are swept whenever a render starts.
 */
type Flight = { promise: Promise<Stored | null>; expires: number };
const inFlight = new Map<string, Flight>();
/** Longest a request waits for a shared render (and lifetime of an in-flight entry); then it renders by itself. */
export const COALESCE_WAIT_MS = 10_000;

/** Number of in-flight entries in this isolate (tests and diagnostics). */
export function inFlightCount(): number {
  return inFlight.size;
}

/** Reads a cacheable copy; null when the page was rendered without its data (never stored or shared). */
async function readUnlessMarked(copy: Response): Promise<Stored | null> {
  const body = await copy.text();
  if (renderedWithoutData(body)) return null;
  return { body, status: copy.status, statusText: copy.statusText, headers: [...copy.headers] };
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([promise.catch(() => null), timeout]).finally(() => clearTimeout(timer));
}

type Ctx = { waitUntil(promise: Promise<unknown>): void };
type Fetch<E> = (request: Request, env: E, ctx: Ctx) => Promise<Response>;

/**
 * Wraps the OpenNext Worker's fetch handler with the edge cache. Any cache failure falls back to rendering.
 * `coalesceWaitMs` is only overridden by tests.
 */
export function withEdgeCache<E>(render: Fetch<E>, { coalesceWaitMs = COALESCE_WAIT_MS }: { coalesceWaitMs?: number } = {}): Fetch<E> {
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
    const now = Date.now();
    const pending = inFlight.get(key);
    if (pending && pending.expires > now) {
      const shared = await within(pending.promise, pending.expires - now);
      if (shared) return fromCache(toResponse(shared), "COALESCED");
      return render(request, env, ctx).then((r) => withHeader(r, "BYPASS")); // shared render not usable: own render
    }

    // No render in progress, or only an expired one: this request leads. Expired entries (including one for this key)
    // are removed or replaced, so an unfinished render never holds a key past its expiry.
    for (const [k, f] of inFlight) if (f.expires <= now) inFlight.delete(k);
    let settle: (stored: Stored | null) => void = () => undefined;
    const flight: Flight = { promise: new Promise<Stored | null>((resolve) => { settle = resolve; }), expires: now + coalesceWaitMs };
    inFlight.set(key, flight);
    // Removes only this request's own entry: a newer render for the same key (after expiry) is never touched.
    const finish = (stored: Stored | null) => { settle(stored); if (inFlight.get(key) === flight) inFlight.delete(key); };
    let response: Response;
    try {
      response = await render(request, env, ctx);
    } catch (error) {
      finish(null);
      throw error;
    }
    const copy = cacheableCopy(response);
    if (!copy) {
      finish(null);
      return withHeader(response, "BYPASS");
    }
    ctx.waitUntil(readUnlessMarked(copy)
      .then(async (stored) => {
        settle(stored); // waiting requests get the page as soon as it is complete
        if (stored) await cache.put(keyRequest, toResponse(stored)).catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => finish(null))); // no-op if already settled; removed once stored, later requests hit the cache
    return withHeader(response, "MISS");
  };
}
