/**
 * Smart Request — pure rules shared by the server actions, the pages and the tests (no I/O, no server-only).
 * Deterministic matching only: a request goes to published businesses of its category within its radius.
 */
import { z } from "zod";

export const REQUEST_TTL_DAYS = 14;
/** A user may have this many open requests at once (spam protection). */
export const MAX_OPEN_REQUESTS = 5;
/** Matching never notifies more businesses than this per request (no inbox flooding). */
export const MAX_RECIPIENTS = 20;
export const REQUEST_RADII_KM = [1, 2, 5, 10, 25, 50] as const;
export const AVAILABILITY = ["now", "today", "tomorrow", "thisWeek", "onRequest"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const MAX_PRICE_CENTS = 100_000_000;

export type RequestStatus = "open" | "closed" | "cancelled";
export type OfferStatus = "active" | "withdrawn" | "selected" | "rejected";

/** ~1 km: the finest location the platform stores for a request. Businesses never receive it, only a distance. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Plain text: control characters removed, spaces collapsed; line breaks kept only when asked for. */
export function cleanText(value: string, multiline = false): string {
  const stripped = value.replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]+/g : /[\u0000-\u001f\u007f]+/g, " ");
  return (multiline ? stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : stripped.replace(/\s+/g, " ")).trim();
}

/** "12,50" / "12.5" / 12 → integer cents; null when not a price between 0.01 and 1,000,000. */
export function parsePriceCents(input: unknown): number | null {
  const raw = typeof input === "number" ? String(input) : typeof input === "string" ? input.trim().replace(/\s/g, "").replace(",", ".") : "";
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  return cents >= 1 && cents <= MAX_PRICE_CENTS ? cents : null;
}

export function formatEuro(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** An open request past its expiry reads as "expired" everywhere; nothing has to run on a schedule. */
export function effectiveStatus(row: { status: string; expiresAt: Date }, now = new Date()): RequestStatus | "expired" {
  if (row.status === "open") return row.expiresAt.getTime() <= now.getTime() ? "expired" : "open";
  return row.status === "closed" ? "closed" : "cancelled";
}

export function isActionable(row: { status: string; expiresAt: Date }, now = new Date()): boolean {
  return effectiveStatus(row, now) === "open";
}

export function expiryFrom(now = new Date()): Date {
  return new Date(now.getTime() + REQUEST_TTL_DAYS * 86_400_000);
}

const id = z.string().trim().min(1).max(64).regex(/^[\w-]+$/);
const blank = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

export const createRequestSchema = z
  .object({
    categoryId: id,
    title: z.string().transform((v) => cleanText(v)).pipe(z.string().min(3).max(120)),
    description: z.string().optional().transform((v) => (v ? cleanText(v, true) : "")).pipe(z.string().max(1000)),
    cityId: z.preprocess(blank, id.optional()),
    lat: z.preprocess(blank, z.coerce.number().min(-90).max(90).optional()),
    lng: z.preprocess(blank, z.coerce.number().min(-180).max(180).optional()),
    radiusKm: z.coerce.number().refine((r) => (REQUEST_RADII_KM as readonly number[]).includes(r), "radius").default(10),
    /** Consent: businesses learn the approximate distance, never the position. */
    consent: z.literal("on"),
    locale: z.string().min(2).max(8),
  })
  .refine((v) => v.cityId !== undefined || (v.lat !== undefined && v.lng !== undefined), { message: "location", path: ["cityId"] });
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const offerSchema = z.object({
  requestId: id,
  businessId: id,
  price: z.string().transform((v, ctx) => {
    const cents = parsePriceCents(v);
    if (cents === null) ctx.addIssue({ code: "custom", message: "price" });
    return cents ?? 0;
  }),
  availability: z.enum(AVAILABILITY),
  message: z.string().optional().transform((v) => (v ? cleanText(v, true) : "")).pipe(z.string().max(500)),
});
export type OfferInput = z.infer<typeof offerSchema>;

/** Business-facing distance label ("< 1 km", "3.4 km"); rounded so it cannot pin a home address. */
export function distanceLabel(km: number): string {
  if (km < 1) return "< 1 km";
  return `${(Math.round(km * 10) / 10).toLocaleString("en", { maximumFractionDigits: 1 })} km`;
}
