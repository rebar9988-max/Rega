/**
 * Browser side of the location filter (client only): the visitor's saved place, shared by every selector and the
 * map on every page, and small helpers around /api/v1/geo. The saved place is one city id plus its country code and
 * region id, kept in this browser's localStorage only (no account, never sent to the server by REGA). If browser
 * storage is blocked, the choice still works for the rest of the visit through an in-memory copy.
 */
import { LOCATION_STORAGE_KEY, parseLocationPref, serializeLocationPref, type LocationPref, type LocationPrefInput } from "./location-pref";

// ------------------------------------------------------------------ saved place

let memory: string | null = null;
const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastPref: LocationPref | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(LOCATION_STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/** The saved place, or null. The same object is returned until the stored value changes (needed by useSyncExternalStore). */
export function getSavedLocation(): LocationPref | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastPref = parseLocationPref(raw);
  }
  return lastPref;
}

export function subscribeSavedLocation(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LOCATION_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveLocation(input: LocationPrefInput): void {
  const raw = serializeLocationPref(input);
  if (!raw) return;
  memory = raw;
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, raw);
  } catch {
    // Storage blocked or full: the in-memory copy keeps the choice for this visit.
  }
  emit();
}

export function clearSavedLocation(): void {
  memory = null;
  try {
    window.localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch {
    // Nothing to remove.
  }
  emit();
}

// ------------------------------------------------------------------ places from the server

export type GeoNames = {
  nameEn: string;
  nameCkb?: string | null;
  nameKmr?: string | null;
  nameDe?: string | null;
  nameFa?: string | null;
  nameAr?: string | null;
  nameTr?: string | null;
};
export type GeoCountry = GeoNames & { code: string };
export type GeoRegion = GeoNames & { id: string; slug: string };
export type GeoCity = GeoNames & {
  id: string;
  slug: string | null;
  regionId: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  count: number;
};
export type GeoList = { countryCode: string; countries: GeoCountry[]; regions: GeoRegion[]; cities: GeoCity[]; hasMore: boolean };

const GEO_PATH = "/api/v1/geo";
// Geography responses carry moderation-sensitive listing counts; fetch fresh on every open.

async function getData<T>(query: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${GEO_PATH}?${query}`, { cache: "no-store", headers: { accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`geo ${res.status}`);
  const body = (await res.json()) as { ok?: boolean; data?: T };
  if (!body.ok || body.data === undefined) throw new Error("geo response");
  return body.data;
}

/** Countries, the regions of a country and a bounded list of its cities (default, one region, or a text search). */
export async function fetchGeoList(params: { country?: string; region?: string; q?: string }, signal?: AbortSignal): Promise<GeoList> {
  const query = new URLSearchParams();
  if (params.country) query.set("country", params.country);
  if (params.region) query.set("region", params.region);
  if (params.q) query.set("q", params.q);
  return getData<GeoList>(query, signal);
}

/** One city by id, or null when it no longer exists (a stale saved choice). */
export async function fetchGeoCity(id: string): Promise<GeoCity | null> {
  const data = await getData<{ city: GeoCity | null }>(new URLSearchParams({ city: id }));
  return data.city;
}

/** The known city nearest to a position. The position is used for this one lookup and is never stored. */
export async function fetchNearestGeoCity(lat: number, lng: number): Promise<{ city: GeoCity; km: number } | null> {
  const data = await getData<{ nearest: { city: GeoCity; km: number } | null }>(new URLSearchParams({ lat: String(lat), lng: String(lng) }));
  return data.nearest;
}
