/**
 * Geo helpers for Nearby Discovery. Pure (no I/O): safe for tests, server and client.
 * Location-agnostic: nothing here assumes a country or city; timezones come from the location's country code.
 */
import { closedOnHolidays, hoursExceptions, type HoursException } from "./opening-hours";
import { addDays, holidaysOn, type Holiday } from "./holidays";

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
export type Day = (typeof DAYS)[number];

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

/** Local calendar date, weekday and minute of the day in a timezone. */
function localNow(now: Date, timeZone: string): { date: string; day: Day; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").slice(0, 3).toLowerCase() as Day;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

const CLOSED_RE = /^closed$/i;
const dayOfDate = (date: string) => DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

type DayPlan = { ranges: [number, number][]; exception?: HoursException; holiday?: Holiday };

/**
 * The hours that apply on one local date, in this order: a date exception (closure or special hours; the shortest
 * matching range wins, so a one-day change inside a longer one is respected), then an official public holiday when
 * the business is closed on holidays, then the weekly hours of that weekday.
 */
function dayPlan(table: Record<string, unknown>, exceptions: HoursException[], holidaysClosed: boolean, countryCode: string | null | undefined, regionSlug: string | null | undefined, date: string): DayPlan {
  const span = (e: HoursException) => Date.parse(`${e.to}T00:00:00Z`) - Date.parse(`${e.from}T00:00:00Z`);
  const exception = exceptions
    .filter((e) => e.from <= date && date <= e.to)
    .sort((a, b) => span(a) - span(b) || b.from.localeCompare(a.from))[0];
  const holiday = holidaysOn(countryCode, regionSlug, date)[0];
  if (exception) return { ranges: exception.hours === "closed" ? [] : parseRanges(exception.hours), exception, holiday };
  if (holiday && holidaysClosed) return { ranges: [], holiday };
  return { ranges: parseRanges(table[dayOfDate(date)]), holiday };
}

/** Weekly hours readable at all: a day with valid ranges, or one explicitly marked "closed". */
function weeklyReadable(table: Record<string, unknown>): boolean {
  return DAYS.some((d) => parseRanges(table[d]).length > 0 || (typeof table[d] === "string" && CLOSED_RE.test(String(table[d]).trim())));
}

/**
 * Open right now? `hours` is the stored JSON ({ mon: "09:00–17:00", ..., holidays?, exceptions? }). Returns null when
 * unknown (no readable hours), so the UI can say "hours unknown" instead of guessing "closed". Same reading as
 * `openStatus`, including closures, special hours and public holidays.
 */
export function isOpenNow(hours: unknown, countryCode: string | null | undefined, now = new Date(), regionSlug?: string | null): boolean | null {
  const { status } = openStatus(hours, countryCode, now, SOON_MINUTES, regionSlug);
  return status === "HOURS_UNKNOWN" ? null : status === "OPEN" || status === "CLOSING_SOON";
}

export type BusinessOpenStatus = "OPEN" | "CLOSING_SOON" | "CLOSED" | "OPENS_SOON" | "TEMPORARILY_CLOSED" | "HOURS_UNKNOWN";
export type OpenStatusResult = {
  status: BusinessOpenStatus;
  /** Next change in the location's own calendar: when an open business closes, or when a closed one opens. */
  next?: { day: Day; date: string; time: string; inMinutes: number };
  /** Today is an official public holiday (shown even when the business keeps its regular hours). */
  holiday?: Holiday;
  /** Today's hours come from a date exception: a closure (with its last day) or special hours. */
  exception?: HoursException;
};
/** Default lead time for "closing soon" / "opens soon". */
export const SOON_MINUTES = 60;
/** Days looked ahead for the next opening (a closure may last weeks; longer ones report no next opening). */
const HORIZON_DAYS = 45;
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Detailed state for business pages: OPEN / CLOSING_SOON / CLOSED / OPENS_SOON, TEMPORARILY_CLOSED while a closure
 * covers today, HOURS_UNKNOWN when nothing is readable, plus the next opening or closing time — all in the location's
 * own timezone and calendar. Adjacent ranges ("20:00–24:00" then "00:00–02:00") count as one opening period; an
 * overnight range belongs to the date it starts on. A business is never reported open on a guess.
 */
export function openStatus(hours: unknown, countryCode: string | null | undefined, now = new Date(), soonMinutes = SOON_MINUTES, regionSlug?: string | null): OpenStatusResult {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return { status: "HOURS_UNKNOWN" };
  const table = hours as Record<string, unknown>;
  const exceptions = hoursExceptions(table);
  const holidaysClosed = closedOnHolidays(table);
  const local = localNow(now, timezoneFor(countryCode));
  const plans = Array.from({ length: HORIZON_DAYS + 2 }, (_, i) => {
    const date = addDays(local.date, i - 1);
    return { offset: i - 1, date, plan: dayPlan(table, exceptions, holidaysClosed, countryCode, regionSlug, date) };
  });
  const today = plans[1].plan;
  // Unknown unless the weekly hours are readable or a date exception decides today.
  if (!weeklyReadable(table) && !today.exception) return { status: "HOURS_UNKNOWN" };

  const t = local.minute;
  const ranges: [number, number][] = plans.flatMap(({ offset, plan }) =>
    plan.ranges.map(([s, e]) => [offset * 1440 + s, offset * 1440 + (e > s ? e : e + 1440)] as [number, number]));
  ranges.sort((a, b) => a[0] - b[0]);
  const at = (abs: number, inMinutes: number) => {
    const date = addDays(local.date, Math.floor(abs / 1440));
    return { day: dayOfDate(date), date, time: hhmm(((abs % 1440) + 1440) % 1440), inMinutes };
  };
  const context = { ...(today.holiday ? { holiday: today.holiday } : {}), ...(today.exception ? { exception: today.exception } : {}) };

  const current = ranges.filter(([s, e]) => s <= t && t < e);
  if (current.length) {
    let end = Math.max(...current.map(([, e]) => e));
    for (let grew = true; grew;) {
      grew = false;
      for (const [s, e] of ranges) if (s <= end && e > end) { end = e; grew = true; }
    }
    // Open around the clock for the whole horizon: nothing to announce.
    if (end >= (HORIZON_DAYS + 1) * 1440) return { status: "OPEN", ...context };
    const inMinutes = end - t;
    return { status: inMinutes <= soonMinutes ? "CLOSING_SOON" : "OPEN", next: at(end, inMinutes), ...context };
  }
  const nextStart = ranges.find(([s]) => s > t)?.[0];
  const next = nextStart === undefined ? undefined : at(nextStart, nextStart - t);
  if (today.exception?.hours === "closed") return { status: "TEMPORARILY_CLOSED", ...(next ? { next } : {}), ...context };
  if (!next) return { status: "CLOSED", ...context };
  return { status: next.inMinutes <= soonMinutes ? "OPENS_SOON" : "CLOSED", next, ...context };
}
