"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth-helpers";
import { emailEnabled } from "@/lib/email";
import { isEnabled } from "@/lib/flags";
import { isLocale } from "@/config/locales";
import { allowShared } from "@/lib/rate-limit";
import { guardForm } from "@/features/forms/guard";
import { MAX_COMMENT } from "./rating";
import { recomputeRating } from "./queries";

const schema = z.object({
  businessId: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(MAX_COMMENT).optional().transform((v) => v || undefined),
  locale: z.string().refine(isLocale),
});

export type ReviewFormState = { status: "idle" | "ok" | "error"; error?: "invalid" | "rate" | "failed" | "signin" | "own" | "unverified" | "disabled"; fields?: string[] };

/**
 * One review per user per business (a new submission replaces the earlier one and goes back to moderation). Reviews are
 * never public before a moderator approves them. Business owners cannot review their own business.
 */
export async function submitReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  if (!(await isEnabled("public.reviews"))) return { status: "error", error: "disabled" };
  const user = await currentUser().catch(() => null);
  if (!user) return { status: "error", error: "signin" };
  const guard = await guardForm(formData, `review:${user.id}`, 10);
  if (guard === "spam") return { status: "ok" };
  if (guard === "rate") return { status: "error", error: "rate" };
  if (!(await allowShared("FORM_LIMITER", `review-day:${user.id}`, 20, 24 * 3_600_000))) return { status: "error", error: "rate" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const { businessId, rating, comment, locale } = parsed.data;

  const [business, account, member] = await Promise.all([
    prisma.business.findFirst({ where: { id: businessId, status: "published", deletedAt: null }, select: { id: true, slug: true } }),
    prisma.user.findFirst({ where: { id: user.id, deletedAt: null, status: "active" }, select: { emailVerified: true } }),
    prisma.businessMember.findFirst({ where: { businessId, userId: user.id, isActive: true }, select: { id: true } }),
  ]);
  if (!business || !account) return { status: "error", error: "failed" };
  if (member) return { status: "error", error: "own" };
  if (emailEnabled() && !account.emailVerified) return { status: "error", error: "unverified" };

  const wasApproved = (await prisma.review.findUnique({ where: { businessId_userId: { businessId, userId: user.id } }, select: { status: true } }))?.status === "approved";
  await prisma.review.upsert({
    where: { businessId_userId: { businessId, userId: user.id } },
    create: { businessId, userId: user.id, rating, comment, locale, status: "pending" },
    update: { rating, comment: comment ?? null, locale, status: "pending", moderatedAt: null, moderatedById: null },
  });
  // An edited approved review leaves the public aggregate until it is approved again.
  if (wasApproved) await recomputeRating(businessId);
  revalidatePath(`/${locale}/business/${business.slug}`);
  return { status: "ok" };
}
