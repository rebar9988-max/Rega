/**
 * Opening hours: the one format stored in Location.openingHours and read by isOpenNow (src/lib/geo.ts).
 *   { mon: "09:00–17:00", tue: "09:00–12:00, 14:00–18:00", fri: "20:00–02:00", sun: "closed" }
 * A missing day means closed that day once any day is set; no hours at all means "unknown" (never shown as open).
 * Pure: shared by the admin form, the API and tests.
 */
export const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK)[number];
export type OpeningHours = Partial<Record<WeekDay, string>>;

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
