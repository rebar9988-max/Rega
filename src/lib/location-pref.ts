/**
 * Location preference: the place a visitor last chose, kept only in that visitor's own browser so the home page,
 * the business list and the map can share it without an account. Pure helpers (no I/O): safe for tests, server
 * and client. Nothing here invents places; it only validates, matches and ranks what the database already has.
 */
import { distanceKm } from "./geo";

/** Browser storage key (documented in the privacy text). Holds a city id and two optional parent ids, nothing else. */
export const LOCATION_STORAGE_KEY = "rega-location";
export const LOCATION_PREF_VERSION = 1;
/** A preference not refreshed for this long is dropped (the city may have been removed in the meantime). */
export const LOCATION_PREF_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
/** The farthest a detected position may be from a known city to be offered that city. */
export const NEAREST_CITY_MAX_KM = 60;

export type LocationPref = { cityId: string; countryCode: string | null; regionId: string | null; savedAt: number };
export type LocationPrefInput = { cityId: string; countryCode?: string | null; regionId?: string | null };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COUNTRY = /^[A-Za-z]{2}$/;

export const isGeoId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

/** Reads what was stored. Anything malformed, from another version or too old is ignored (never thrown). */
export function parseLocationPref(raw: string | null | undefined, now = Date.now()): LocationPref | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.v !== LOCATION_PREF_VERSION || !isGeoId(row.cityId)) return null;
  const savedAt = typeof row.savedAt === "number" && Number.isFinite(row.savedAt) ? row.savedAt : null;
  if (savedAt === null || savedAt > now + 24 * 60 * 60 * 1000 || now - savedAt > LOCATION_PREF_MAX_AGE_MS) return null;
  return {
    cityId: row.cityId,
    countryCode: typeof row.countryCode === "string" && COUNTRY.test(row.countryCode) ? row.countryCode.toUpperCase() : null,
    regionId: isGeoId(row.regionId) ? row.regionId : null,
    savedAt,
  };
}

/** What gets stored. Returns null for an invalid city id so a bad value is never written. */
export function serializeLocationPref(input: LocationPrefInput, now = Date.now()): string | null {
  if (!isGeoId(input.cityId)) return null;
  return JSON.stringify({
    v: LOCATION_PREF_VERSION,
    cityId: input.cityId,
    countryCode: input.countryCode && COUNTRY.test(input.countryCode) ? input.countryCode.toUpperCase() : null,
    regionId: isGeoId(input.regionId) ? input.regionId : null,
    savedAt: now,
  });
}

/**
 * The query string a list page should use when the visitor arrives without a city. An explicit `city` parameter
 * (even an empty one, meaning "all cities") always wins; a saved city is applied only when none is present.
 */
export function savedCityQuery(search: string, pref: LocationPref | null): string | null {
  if (!pref) return null;
  const params = new URLSearchParams(search);
  if (params.has("city")) return null;
  params.set("city", pref.cityId);
  params.delete("page");
  return params.toString();
}

/** True when the URL says "all cities" on purpose (`?city=`), which clears the saved place. */
export function explicitlyAllCities(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("city") && params.get("city") === "";
}

// ------------------------------------------------------------------ searching

/** Case-, accent- and ß-insensitive text for matching ("Köln", "koln", "KÖLN" and "Koeln" are not all equal, see variants). */
export function foldSearch(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Spellings worth trying against the database: what was typed, the German transliteration ("Köln" -> "koeln", the
 * form used in URL slugs), the accent-stripped form ("Köln" -> "koln") and the umlaut form of a transliteration
 * ("koeln" -> "köln"). At most four, lower case, no duplicates.
 */
export function queryVariants(query: string): string[] {
  const typed = query.trim().toLocaleLowerCase();
  if (!typed) return [];
  const german = typed.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  const stripped = foldSearch(typed);
  const umlauts = typed.replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü");
  return Array.from(new Set([typed, german, stripped, umlauts])).filter(Boolean);
}

/** Matches whose name starts with the query first, then the others, each group in its original order. */
export function rankByQuery<T>(items: readonly T[], query: string, names: (item: T) => readonly (string | null | undefined)[], limit = 40): T[] {
  const variants = queryVariants(query).map(foldSearch);
  if (variants.length === 0) return items.slice(0, limit);
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const folded = names(item).filter((n): n is string => typeof n === "string" && n.length > 0).map(foldSearch);
    if (folded.some((n) => variants.some((v) => n.startsWith(v)))) starts.push(item);
    else if (folded.some((n) => variants.some((v) => n.includes(v)))) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}

// ------------------------------------------------------------------ nearby detection

type Point = { lat: number; lng: number };

/** The known city closest to a detected position, or null when none is within `maxKm`. Cities without coordinates are skipped. */
export function nearestCity<T extends { latitude: number | null; longitude: number | null }>(point: Point, cities: readonly T[], maxKm = NEAREST_CITY_MAX_KM): { city: T; km: number } | null {
  let best: { city: T; km: number } | null = null;
  for (const city of cities) {
    if (city.latitude == null || city.longitude == null) continue;
    const km = distanceKm(point, { lat: city.latitude, lng: city.longitude });
    if (km <= maxKm && (best === null || km < best.km)) best = { city, km };
  }
  return best;
}

/** Display name without a trailing "(count)" that list options may carry. Only used when no plain name is given. */
export function plainCityName(option: { label: string; name?: string }): string {
  return option.name ?? option.label;
}
