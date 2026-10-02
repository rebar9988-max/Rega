/**
 * Address -> coordinates for the admin business form (server-side only; the browser never talks to the geocoder).
 * Provider: any Nominatim-compatible search API (GEOCODING_URL), or "none". No API key, nothing secret.
 * Results are only suggestions: an admin must confirm the marker on the map before a business can be published.
 */
import "server-only";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { parseNominatim, type GeocodeHit } from "./geocoder-parse";

export type { GeocodeHit } from "./geocoder-parse";
export type GeocodeInput = { addressLine1: string; postalCode?: string; city: string; countryCode: string };
export type GeocodeOutcome = { ok: true; hits: GeocodeHit[] } | { ok: false; reason: "disabled" | "not_found" | "unavailable" };

/** GEOCODING_URL may carry a path (self-hosted instances often live under one). */
const searchUrl = (base: string) => new URL(`${base.replace(/\/+$/, "")}/search`);

// Public Nominatim allows at most one request per second per application; stay under it.
let last = 0;
async function throttle() {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeOutcome> {
  const env = serverEnv();
  if (env.GEOCODING_PROVIDER === "none") return { ok: false, reason: "disabled" };
  const url = searchUrl(env.GEOCODING_URL);
  url.search = new URLSearchParams({
    format: "jsonv2", limit: "5", addressdetails: "0",
    street: input.addressLine1, city: input.city, countrycodes: input.countryCode.toLowerCase(),
    ...(input.postalCode ? { postalcode: input.postalCode } : {}),
  }).toString();
  try {
    await throttle();
    const res = await fetch(url, {
      headers: { "user-agent": `REGA Platform (+https://${env.CANONICAL_HOST})`, accept: "application/json" },
      signal: AbortSignal.timeout(env.GEOCODING_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn("geocode.http", { status: res.status });
      return { ok: false, reason: "unavailable" };
    }
    const hits = parseNominatim(await res.json());
    return hits.length > 0 ? { ok: true, hits } : { ok: false, reason: "not_found" };
  } catch (error) {
    log.warn("geocode.failed", { error: error instanceof Error ? error.name : "unknown" }); // never logs the address
    return { ok: false, reason: "unavailable" };
  }
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
