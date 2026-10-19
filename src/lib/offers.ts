/**
 * Genuine business offers: discount rules, dates in the business's own time zone, and the running state.
 * Pure (no I/O, no framework imports) so the dashboard form, the server action, the public page and the tests agree.
 *
 * Principles (see also the Offer model in prisma/schema.prisma):
 * - Nothing is invented. There is no "original price": REGA never computes a "was/now" price or a percentage. A discount
 *   is exactly what the owner declared (none | percent | amount) and the text may not claim a different percentage.
 * - "Running" is never stored. It is computed from the owner's switch and the dates on every read, so an expired or a
 *   not-yet-started offer can never look active.
 */
import { timezoneFor } from "./geo";

export const OFFER_CURRENCIES = ["EUR", "IQD", "USD", "GBP", "CHF", "TRY"] as const;
export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];
export const OFFER_DISCOUNT_TYPES = ["none", "percent", "amount"] as const;
export type OfferDiscountType = (typeof OFFER_DISCOUNT_TYPES)[number];

export const OFFER_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMax: 1000,
  percentMin: 1,
  percentMax: 90,
  amountMax: 100_000,
  /** Longest offer, and furthest start in the future, in days. */
  maxDays: 366,
  /** Most offers shown on a business profile at once. */
  publicMax: 6,
} as const;

// ------------------------------------------------------------------ state

export type OfferState = "active" | "scheduled" | "expired" | "deactivated";

/** The running state of an offer at `now`. The owner's switch wins; otherwise only the dates decide. */
export function offerState(offer: { isActive: boolean; startsAt: Date; endsAt: Date }, now: Date): OfferState {
  if (!offer.isActive) return "deactivated";
  if (now < offer.startsAt) return "scheduled";
  if (now >= offer.endsAt) return "expired";
  return "active";
}

/** Prisma `where` for offers that are running at `now` (switch on, started, not yet ended). The end is exclusive. */
export function activeOfferWhere(now: Date) {
  return { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } } as const;
}

// ------------------------------------------------------------------ discount

export type DiscountInput = { type: OfferDiscountType; value?: number | null; currency?: string | null };
export type DiscountResult =
  | { ok: true; type: OfferDiscountType; value: number | null; currency: OfferCurrency | null }
  | { ok: false; issue: "discount_invalid" };

/** A discount is nothing, a whole percentage from 1 to 90, or a positive amount (two decimals) with a currency. */
export function validateDiscount({ type, value, currency }: DiscountInput): DiscountResult {
  const bad = { ok: false, issue: "discount_invalid" } as const;
  if (type === "none") return value == null && !currency ? { ok: true, type, value: null, currency: null } : bad;
  if (typeof value !== "number" || !Number.isFinite(value)) return bad;
  if (type === "percent") {
    if (currency || !Number.isInteger(value) || value < OFFER_LIMITS.percentMin || value > OFFER_LIMITS.percentMax) return bad;
    return { ok: true, type, value, currency: null };
  }
  if (type === "amount") {
    const cur = OFFER_CURRENCIES.find((c) => c === currency);
    if (!cur || value <= 0 || value > OFFER_LIMITS.amountMax || Math.round(value * 100) / 100 !== value) return bad;
    return { ok: true, type, value, currency: cur };
  }
  return bad;
}

// ------------------------------------------------------------------ misleading claims

/** Arabic-Indic and Persian digits and percent signs to their ASCII forms, so "٢٠٪" is read as "20%". */
function asciiNumbers(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٪﹪％]/g, "%");
}

/** Every percentage figure written in the text: "20%", "20 %", "12,5 %" and the Turkish "%20". */
export function percentClaims(text: string): number[] {
  const claims: number[] = [];
  for (const m of asciiNumbers(text).matchAll(/(\d+(?:[.,]\d+)?)\s*%|%\s*(\d+(?:[.,]\d+)?)/g)) {
    claims.push(Number((m[1] ?? m[2]).replace(",", ".")));
  }
  return claims;
}

export type MisleadingIssue = "percent_mismatch" | "percent_without_discount";

/**
 * Text may only claim the discount that was declared. A percentage in the title or description must equal the declared
 * percent discount; with no percent discount declared the text may not state a percentage at all.
 */
export function misleadingIssues(texts: { title: string; description?: string | null }, discount: { type: OfferDiscountType; value: number | null }): MisleadingIssue[] {
  const claims = percentClaims(`${texts.title}\n${texts.description ?? ""}`);
  if (claims.length === 0) return [];
  if (discount.type !== "percent") return ["percent_without_discount"];
  return claims.some((c) => c !== discount.value) ? ["percent_mismatch"] : [];
}

// ------------------------------------------------------------------ dates (calendar days in the business's time zone)

export type DateIssue = "date_invalid" | "end_before_start" | "ended" | "too_long" | "too_far";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "2026-11-01"; null unless it is a real calendar date. */
function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = YMD.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? { y, m, d } : null;
}

/** Offset (ms) of `tz` from UTC at the instant `utcMs`. */
function offsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(utcMs / 1000) * 1000;
}

/** The instant at which the calendar day `ymd` begins in `tz` (daylight-saving aware), or null for an invalid date. */
export function zonedMidnight(ymd: string, tz: string): Date | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const guess = Date.UTC(p.y, p.m - 1, p.d);
  const first = guess - offsetMs(guess, tz);
  return new Date(guess - offsetMs(first, tz));
}

/** "2026-11-01" plus `days` calendar days. */
export function addDaysYmd(ymd: string, days: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + days)).toISOString().slice(0, 10);
}

/** The calendar date ("2026-11-01") an instant falls on in `tz`. */
export function localYmd(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Time zone of a business: its primary location's country. */
export const offerTimezone = (countryCode?: string | null) => timezoneFor(countryCode);

export type OfferWindow = { ok: true; startsAt: Date; endsAt: Date } | { ok: false; issue: DateIssue };

/**
 * Turns the two calendar dates the owner picked into the offer's window: it starts when the first day begins and ends
 * when the last day is over (the end instant is the start of the next day and is exclusive), in the business's own
 * time zone. Rejects an end before the start, an offer that is already over, one longer than a year and one that starts
 * more than a year ahead.
 */
export function offerWindow(startDate: string, endDate: string, tz: string, now: Date): OfferWindow {
  const startsAt = zonedMidnight(startDate, tz);
  const nextDay = addDaysYmd(endDate, 1);
  const endsAt = nextDay ? zonedMidnight(nextDay, tz) : null;
  if (!startsAt || !endsAt) return { ok: false, issue: "date_invalid" };
  if (endsAt <= startsAt) return { ok: false, issue: "end_before_start" };
  if (endsAt <= now) return { ok: false, issue: "ended" };
  const day = 86_400_000;
  if (endsAt.getTime() - startsAt.getTime() > OFFER_LIMITS.maxDays * day) return { ok: false, issue: "too_long" };
  if (startsAt.getTime() - now.getTime() > OFFER_LIMITS.maxDays * day) return { ok: false, issue: "too_far" };
  return { ok: true, startsAt, endsAt };
}

/** First and last calendar day of a stored offer, for the edit form (the stored end instant is the start of the day after). */
export function offerDates(offer: { startsAt: Date; endsAt: Date }, tz: string): { startDate: string; endDate: string } {
  return { startDate: localYmd(offer.startsAt, tz), endDate: localYmd(new Date(offer.endsAt.getTime() - 1), tz) };
}
