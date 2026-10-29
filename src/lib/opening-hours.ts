/**
 * Opening hours: the one format stored in Location.openingHours and read by isOpenNow (src/lib/geo.ts).
 *   { mon: "09:00–17:00", tue: "09:00–12:00, 14:00–18:00", fri: "20:00–02:00", sun: "closed" }
 * A missing day means closed that day once any day is set; no hours at all means "unknown" (never shown as open).
 * Pure: shared by the admin form, the API and tests.
 */
export const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK)[number];
/**
 * Date-based changes to the weekly hours, in the location's own calendar (inclusive "YYYY-MM-DD" range):
 * `hours: "closed"` is a temporary closure, any other value replaces that date's weekly hours (special hours, e.g.
 * on a holiday). `reason` is optional public text.
 */
export type HoursException = { from: string; to: string; hours: string; reason?: string };
/**
 * Stored in Location.openingHours. The weekday keys are the long-standing format; `holidays: "closed"` (closed on
 * official public holidays, see lib/holidays.ts) and `exceptions` are optional additions that older readers ignore.
 */
export type OpeningHours = Partial<Record<WeekDay, string>> & { holidays?: "closed"; exceptions?: HoursException[] };

/** Limits for date exceptions: entries per location, days per entry, reason length. */
export const EXCEPTION_LIMITS = { max: 30, maxDays: 366, reason: 120 } as const;

const TIME = /^([01]?\d|2[0-4]):([0-5]\d)$/;

function toMinutes(v: string): number | null {
  const m = TIME.exec(v.trim());
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return total <= 24 * 60 ? total : null;
}
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** One day's value -> normalized "HH:MM–HH:MM, …" or "closed"; null when it cannot be read. Empty -> "". */
export function normalizeDay(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  if (/^(closed|geschlossen|داخراوە|مغلق|بسته|kapalı|girtî|-)$/i.test(v)) return "closed";
  const parts = v.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const [a, b, extra] = part.split(/\s*[–—-]\s*/);
    if (extra !== undefined || !a || !b) return null;
    const start = toMinutes(a);
    const end = toMinutes(b);
    if (start === null || end === null || start === end) return null;
    out.push(`${fmt(start)}–${fmt(end)}`);
  }
  return out.length ? out.join(", ") : null;
}

export type ParsedHours = { ok: true; value: OpeningHours | null } | { ok: false; invalid: string[] };

/** Validates and normalizes a day -> text map. Unknown keys are rejected. All days empty -> value null. */
export function parseOpeningHours(input: Record<string, unknown>): ParsedHours {
  const invalid: string[] = [];
  const value: OpeningHours = {};
  for (const [key, raw] of Object.entries(input)) {
    const day = key.toLowerCase().slice(0, 3) as WeekDay;
    if (!WEEK.includes(day) || typeof raw !== "string") { invalid.push(key); continue; }
    const norm = normalizeDay(raw);
    if (norm === null) invalid.push(day);
    else if (norm) value[day] = norm;
  }
  if (invalid.length) return { ok: false, invalid };
  return { ok: true, value: Object.keys(value).length ? value : null };
}

/** Stored JSON -> rows Monday first, for display and for the admin form. */
export function hoursRows(stored: unknown): { day: WeekDay; value: string }[] {
  const table = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  return WEEK.map((day) => ({ day, value: typeof table[day] === "string" ? String(table[day]) : "" }));
}

export function hasHours(stored: unknown): boolean {
  return hoursRows(stored).some((r) => r.value !== "");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type ParsedExceptions = { ok: true; value: HoursException[] } | { ok: false; invalid: number[] };

/**
 * Validates and normalizes date exceptions (from the dashboard form). Each entry needs real dates, `to` not before
 * `from`, at most a year long, and hours that `normalizeDay` accepts ("closed" or ranges). Reason: plain text, one
 * line, trimmed. Entries are sorted by start date. Invalid entries are reported by their index.
 */
export function parseHoursExceptions(input: unknown): ParsedExceptions {
  if (input === undefined || input === null || input === "") return { ok: true, value: [] };
  if (!Array.isArray(input) || input.length > EXCEPTION_LIMITS.max) return { ok: false, invalid: [-1] };
  const invalid: number[] = [];
  const value: HoursException[] = [];
  input.forEach((raw, i) => {
    const e = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const from = typeof e.from === "string" ? e.from.trim() : "";
    const to = typeof e.to === "string" && e.to.trim() ? e.to.trim() : from;
    const hours = typeof e.hours === "string" ? normalizeDay(e.hours) : null;
    const reason = typeof e.reason === "string" ? e.reason.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, EXCEPTION_LIMITS.reason) : "";
    if (!isIsoDate(from) || !isIsoDate(to) || to < from || daysBetween(from, to) >= EXCEPTION_LIMITS.maxDays || !hours) { invalid.push(i); return; }
    value.push({ from, to, hours, ...(reason ? { reason } : {}) });
  });
  if (invalid.length) return { ok: false, invalid };
  return { ok: true, value: value.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)) };
}

/** Exceptions as stored (tolerant reader: unreadable entries are skipped, never thrown on). */
export function hoursExceptions(stored: unknown): HoursException[] {
  const list = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>).exceptions : undefined;
  if (!Array.isArray(list)) return [];
  return list.flatMap((e) => {
    const parsed = parseHoursExceptions([e]);
    return parsed.ok ? parsed.value : [];
  });
}

/** True when the business stated it is closed on official public holidays. */
export function closedOnHolidays(stored: unknown): boolean {
  return Boolean(stored && typeof stored === "object" && !Array.isArray(stored) && (stored as Record<string, unknown>).holidays === "closed");
}

/** Weekly hours plus the optional holiday setting and exceptions, in the stored form; null when nothing at all is set. */
export function composeOpeningHours(weekly: OpeningHours | null, holidaysClosed: boolean, exceptions: HoursException[]): OpeningHours | null {
  const out: OpeningHours = { ...(weekly ?? {}) };
  if (holidaysClosed) out.holidays = "closed";
  if (exceptions.length) out.exceptions = exceptions;
  return Object.keys(out).length ? out : null;
}

/** Anything to show about hours: weekly hours, the holiday setting or date exceptions. */
export function hasHoursInfo(stored: unknown): boolean {
  return hasHours(stored) || closedOnHolidays(stored) || hoursExceptions(stored).length > 0;
}

/** Exceptions that have not ended yet on `today` ("YYYY-MM-DD", the location's local date), soonest first. */
export function upcomingExceptions(stored: unknown, today: string): HoursException[] {
  return hoursExceptions(stored).filter((e) => e.to >= today);
}
