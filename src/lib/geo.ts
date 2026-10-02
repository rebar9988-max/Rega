/**
 * Geo helpers for Nearby Discovery. Pure (no I/O): safe for tests, server and client.
 * Location-agnostic: nothing here assumes a country or city; timezones come from the location's country code.
 */

/** Search radii offered in the UI and accepted by the API (km). */
export const RADII_KM = [1, 2, 5, 10, 25, 50, 100] as const;

const EARTH_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box that contains the circle (cheap indexed pre-filter before the exact distance check). */
export function boundingBox(center: { lat: number; lng: number }, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const cos = Math.max(0.01, Math.cos(rad(center.lat)));
  const dLng = Math.min(180, radiusKm / (111.32 * cos));
  return {
    minLat: Math.max(-90, center.lat - dLat),
    maxLat: Math.min(90, center.lat + dLat),
    minLng: Math.max(-180, center.lng - dLng),
    maxLng: Math.min(180, center.lng + dLng),
  };
}

/** Coarsens coordinates (~110 m) so precise positions are never sent, stored or logged. */
export function coarsen(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Local timezone of a location, from its ISO country code. Countries spanning several zones use their most
 * populated one; unknown countries fall back to UTC (open-now is then best effort, never an error).
 */
const TZ_BY_COUNTRY: Record<string, string> = {
  DE: "Europe/Berlin", AT: "Europe/Vienna", CH: "Europe/Zurich", NL: "Europe/Amsterdam", BE: "Europe/Brussels",
  FR: "Europe/Paris", LU: "Europe/Luxembourg", DK: "Europe/Copenhagen", SE: "Europe/Stockholm", NO: "Europe/Oslo",
  FI: "Europe/Helsinki", GB: "Europe/London", IE: "Europe/Dublin", IT: "Europe/Rome", ES: "Europe/Madrid",
  PT: "Europe/Lisbon", PL: "Europe/Warsaw", CZ: "Europe/Prague", GR: "Europe/Athens", TR: "Europe/Istanbul",
  IQ: "Asia/Baghdad", IR: "Asia/Tehran", SY: "Asia/Damascus", US: "America/New_York", CA: "America/Toronto",
  AU: "Australia/Sydney",
};
export function timezoneFor(countryCode?: string | null): string {
  return TZ_BY_COUNTRY[(countryCode ?? "").toUpperCase()] ?? "UTC";
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Day = (typeof DAYS)[number];

function minutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 24 && min < 60 ? h * 60 + min : null;
}

/** "09:00–17:00", "09:00-12:00, 14:00-18:00", "20:00–02:00" (overnight) -> minute ranges. Unparseable -> []. */
export function parseRanges(value: unknown): [number, number][] {
  if (typeof value !== "string") return [];
  return value.split(/[,;]/).flatMap((part) => {
    const [a, b, extra] = part.split(/[–—-]/);
    const start = a ? minutes(a) : null;
    const end = b ? minutes(b) : null;
    return extra !== undefined || start === null || end === null || start === end ? [] : [[start, end] as [number, number]];
  });
}

function localDayAndMinute(now: Date, timeZone: string): { day: Day; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").slice(0, 3).toLowerCase() as Day;
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * Open right now? `hours` is the stored JSON ({ mon: "09:00–17:00", ... }). Returns null when unknown
 * (no hours stored), so the UI can say "hours unknown" instead of guessing "closed".
 */
export function isOpenNow(hours: unknown, countryCode: string | null | undefined, now = new Date()): boolean | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const table = hours as Record<string, unknown>;
  // Unknown unless at least one day is readable: a day with valid ranges, or one explicitly marked "closed".
  // Unreadable values never make a business "open"; with nothing readable at all the answer is "unknown".
  const readable = DAYS.some((d) => parseRanges(table[d]).length > 0 || (typeof table[d] === "string" && /^closed$/i.test(String(table[d]).trim())));
  if (!readable) return null;
  const { day, minute } = localDayAndMinute(now, timezoneFor(countryCode));
  const prev = DAYS[(DAYS.indexOf(day) + 6) % 7];
  for (const [start, end] of parseRanges(table[day])) {
    if (end > start ? minute >= start && minute < end : minute >= start) return true; // overnight: until midnight
  }
  for (const [start, end] of parseRanges(table[prev])) {
    if (end < start && minute < end) return true; // yesterday's overnight range still running
  }
  return false;
}
