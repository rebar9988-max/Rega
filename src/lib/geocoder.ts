/**
 * Address -> coordinates for the admin business form (server-side only; the browser never talks to the geocoder).
 * Provider: any Nominatim-compatible search API (GEOCODING_URL), or "none". No API key, nothing secret.
 * Results are only suggestions: an admin must confirm the marker on the map before a business can be published.
 */
import "server-only";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { parseNominatim, parsePostal, type GeocodeHit, type PostalHit } from "./geocoder-parse";

export type { GeocodeHit, PostalHit } from "./geocoder-parse";
export type GeocodeInput = { addressLine1: string; postalCode?: string; city?: string; countryCode: string };
export type PostalOutcome = { ok: true; hit: PostalHit } | { ok: false; reason: "disabled" | "not_found" | "unavailable" };
export type GeocodeOutcome = { ok: true; hits: GeocodeHit[] } | { ok: false; reason: "disabled" | "not_found" | "unavailable" };

/** GEOCODING_URL may carry a path (self-hosted instances often live under one). */
const searchUrl = (base: string) => new URL(`${base.replace(/\/+$/, "")}/search`);

// Public Nominatim allows at most one request per second per application; stay under it.
// Requests queue behind each other, so two lookups started together (postal code + address) still keep the gap.
let last = 0;
let queue: Promise<void> = Promise.resolve();
function throttle(): Promise<void> {
  queue = queue.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  });
  return queue;
}

type Fetched = { ok: true; body: unknown } | { ok: false };

async function search(params: Record<string, string>): Promise<Fetched> {
  const env = serverEnv();
  const url = searchUrl(env.GEOCODING_URL);
  url.search = new URLSearchParams({ format: "jsonv2", ...params }).toString();
  try {
    await throttle();
    const res = await fetch(url, {
      headers: { "user-agent": `REGA Platform (+https://${env.CANONICAL_HOST})`, accept: "application/json" },
      signal: AbortSignal.timeout(env.GEOCODING_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn("geocode.http", { status: res.status });
      return { ok: false };
    }
    return { ok: true, body: await res.json() };
  } catch (error) {
    log.warn("geocode.failed", { error: error instanceof Error ? error.name : "unknown" }); // never logs the address
    return { ok: false };
  }
}

/**
 * Street + postal code first: a postal code pins the place even when the city is misspelled or missing, which made
 * the old all-fields query return nothing. Then street + city, then the whole address as free text.
 */
export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeOutcome> {
  if (serverEnv().GEOCODING_PROVIDER === "none") return { ok: false, reason: "disabled" };
  const base = { limit: "5", addressdetails: "0", countrycodes: input.countryCode.toLowerCase() };
  const postalCode = input.postalCode?.trim(), city = input.city?.trim();
  const attempts: Record<string, string>[] = [
    ...(postalCode ? [{ ...base, street: input.addressLine1, postalcode: postalCode }] : []),
    ...(city ? [{ ...base, street: input.addressLine1, city }] : []),
    { ...base, q: [input.addressLine1, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ") },
  ];
  let reached = false;
  for (const params of attempts) {
    const res = await search(params);
    if (!res.ok) continue;
    reached = true;
    const hits = parseNominatim(res.body);
    if (hits.length > 0) return { ok: true, hits };
  }
  return { ok: false, reason: reached ? "not_found" : "unavailable" };
}

// Postal areas do not move: remember recent answers so retyping a code costs no second request.
const postalCache = new Map<string, PostalHit>();

/** Centre and place name of a postal code (opens the map there and suggests the city). */
export async function lookupPostalCode(postalCode: string, countryCode: string): Promise<PostalOutcome> {
  if (serverEnv().GEOCODING_PROVIDER === "none") return { ok: false, reason: "disabled" };
  const key = `${countryCode.toUpperCase()}:${postalCode.trim().toUpperCase().replace(/\s+/g, " ")}`;
  const cached = postalCache.get(key);
  if (cached) return { ok: true, hit: cached };
  const res = await search({ limit: "3", addressdetails: "1", postalcode: postalCode.trim(), countrycodes: countryCode.toLowerCase() });
  if (!res.ok) return { ok: false, reason: "unavailable" };
  const hit = parsePostal(res.body);
  if (!hit) return { ok: false, reason: "not_found" };
  if (postalCache.size >= 200) postalCache.delete(postalCache.keys().next().value as string);
  postalCache.set(key, hit);
  return { ok: true, hit };
}

/** Centre of a city (used to open the map picker there and for the Nearby city picker). */
export async function geocodeCity(city: string, countryCode: string): Promise<{ lat: number; lng: number } | null> {
  const env = serverEnv();
  if (env.GEOCODING_PROVIDER === "none") return null;
  const url = searchUrl(env.GEOCODING_URL);
  url.search = new URLSearchParams({ format: "jsonv2", limit: "1", city, countrycodes: countryCode.toLowerCase() }).toString();
  try {
    await throttle();
    const res = await fetch(url, { headers: { "user-agent": `REGA Platform (+https://${env.CANONICAL_HOST})` }, signal: AbortSignal.timeout(env.GEOCODING_TIMEOUT_MS) });
    if (!res.ok) return null;
    const [hit] = parseNominatim(await res.json());
    return hit ? { lat: hit.lat, lng: hit.lng } : null;
  } catch {
    return null;
  }
}
