/**
 * Admin write-side for business offers: validation, ownership of the uploaded image, and create / update / switch.
 * Server-only; callers check the permission and business access (src/lib/business-access.ts) before calling.
 * The rules themselves (discounts, dates, misleading claims, running state) live in src/lib/offers.ts.
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  OFFER_DISCOUNT_TYPES, OFFER_LIMITS, misleadingIssues, offerDates, offerTimezone, offerWindow, validateDiscount,
  type DateIssue, type MisleadingIssue,
} from "@/lib/offers";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const offerFormSchema = z.object({
  id: optionalText(64),
  businessId: z.string().trim().min(1).max(64),
  title: z.string().trim().min(OFFER_LIMITS.titleMin).max(OFFER_LIMITS.titleMax),
  description: optionalText(OFFER_LIMITS.descriptionMax),
  /** An https image URL of a file the person uploaded (checked against the media table); empty = none. */
  imageUrl: z.union([z.literal(""), z.string().trim().max(500).url().refine((u) => u.startsWith("https://"))]).optional().transform((v) => v || undefined),
  discountType: z.enum(OFFER_DISCOUNT_TYPES).default("none"),
  discountValue: z.union([z.literal(""), z.coerce.number()]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  currency: optionalText(3),
  /** First and last day of the offer (calendar dates in the business's own time zone). */
  startDate: z.string().trim().max(10),
  endDate: z.string().trim().max(10),
});
export type OfferForm = z.infer<typeof offerFormSchema>;

export type OfferError =
  | "not_found" | "business_not_found" | "image_invalid"
  | DateIssue | "discount_invalid" | MisleadingIssue;

export type OfferSaveResult = { ok: true; id: string; businessId: string } | { ok: false; error: OfferError };

/** Which form fields an error belongs to (for highlighting). */
export const OFFER_ERROR_FIELDS: Partial<Record<OfferError, string[]>> = {
  date_invalid: ["startDate", "endDate"], end_before_start: ["endDate"], ended: ["endDate"], too_long: ["endDate"], too_far: ["startDate"],
  discount_invalid: ["discountValue"], percent_mismatch: ["title", "description"], percent_without_discount: ["title", "description"],
  image_invalid: ["imageUrl"],
};

/**
 * Creates or updates an offer of one business. Nothing here trusts the browser: the business and the offer are read
 * from the database, an offer can never be moved to another business, the discount and dates are validated again,
 * text may only claim the declared percentage, and the image must be one the person uploaded.
 */
export async function saveOffer(input: OfferForm, actor: { id: string }, now = new Date()): Promise<OfferSaveResult> {
  const existing = input.id ? await prisma.offer.findFirst({ where: { id: input.id }, select: { id: true, businessId: true, imageUrl: true, startsAt: true, endsAt: true } }) : null;
  if (input.id && !existing) return { ok: false, error: "not_found" };
  if (existing && existing.businessId !== input.businessId) return { ok: false, error: "not_found" };

  const business = await prisma.business.findFirst({
    where: { id: input.businessId, deletedAt: null },
    select: { id: true, locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { countryCode: true } } },
  });
  if (!business) return { ok: false, error: "business_not_found" };
  const tz = offerTimezone(business.locations[0]?.countryCode);

  const discount = validateDiscount({ type: input.discountType, value: input.discountValue, currency: input.currency });
  if (!discount.ok) return { ok: false, error: discount.issue };
  const claim = misleadingIssues({ title: input.title, description: input.description }, discount)[0];
  if (claim) return { ok: false, error: claim };

  // An edit that leaves the dates alone keeps them, so a title typo on a finished offer can still be fixed.
  let window: { startsAt: Date; endsAt: Date };
  const kept = existing ? offerDates(existing, tz) : null;
  if (existing && kept && kept.startDate === input.startDate && kept.endDate === input.endDate) {
    window = { startsAt: existing.startsAt, endsAt: existing.endsAt };
  } else {
    const w = offerWindow(input.startDate, input.endDate, tz, now);
    if (!w.ok) return { ok: false, error: w.issue };
    window = w;
  }

  if (input.imageUrl && input.imageUrl !== existing?.imageUrl) {
    const own = await prisma.media.findFirst({ where: { url: input.imageUrl, uploadedById: actor.id, deletedAt: null }, select: { id: true } });
    if (!own) return { ok: false, error: "image_invalid" };
  }

  const data = {
    title: input.title, description: input.description ?? null, imageUrl: input.imageUrl ?? null,
    discountType: discount.type, discountValue: discount.value, currency: discount.currency,
    startsAt: window.startsAt, endsAt: window.endsAt,
  };
  if (existing) {
    await prisma.offer.update({ where: { id: existing.id }, data });
    return { ok: true, id: existing.id, businessId: existing.businessId };
  }
  const created = await prisma.offer.create({ data: { ...data, businessId: business.id, isActive: true, createdById: actor.id }, select: { id: true } });
  return { ok: true, id: created.id, businessId: business.id };
}
