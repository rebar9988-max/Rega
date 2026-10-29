/**
 * Opening-hours editor values <-> the stored day format of src/lib/opening-hours.ts ("09:00–17:00, 18:00–22:00",
 * "00:00–24:00", "closed"). Pure, shared by the form and the tests.
 */
import { normalizeDay, type WeekDay } from "@/lib/opening-hours";

export type Range = { from: string; to: string };
export type Day = { open: boolean; allDay: boolean; ranges: Range[] };

const ALL_DAY = "00:00–24:00";
export const DEFAULT_RANGE: Range = { from: "09:00", to: "17:00" };
export const WEEKDAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri"];

/** Stored value of one day -> controls. Empty (once any day is set) means closed, as the readers treat it. */
export function dayFromStored(value: string | undefined): Day {
  const norm = normalizeDay(value ?? "");
  if (!norm || norm === "closed") return { open: false, allDay: false, ranges: [{ ...DEFAULT_RANGE }] };
  if (norm === ALL_DAY) return { open: true, allDay: true, ranges: [{ ...DEFAULT_RANGE }] };
  return { open: true, allDay: false, ranges: norm.split(", ").map((r) => { const [from, to] = r.split("–"); return { from, to: to === "24:00" ? "00:00" : to }; }) };
}

/** Controls -> stored value; null when a range is incomplete or starts and ends at the same time. */
export function dayToStored(day: Day): string | null {
  if (!day.open) return "closed";
  if (day.allDay) return ALL_DAY;
  if (day.ranges.some((r) => !r.from || !r.to || r.from === r.to)) return null;
  // A range ending at midnight is stored as "…–24:00" (a time field cannot show 24:00).
  return normalizeDay(day.ranges.map((r) => `${r.from}–${r.to === "00:00" ? "24:00" : r.to}`).join(", "));
}

