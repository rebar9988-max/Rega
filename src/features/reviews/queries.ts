import "server-only";
import { prisma } from "@/lib/db";
import { aggregate } from "./rating";

/** Approved reviews of a business, newest first (public). */
export async function approvedReviews(businessId: string, take = 20) {
  return prisma.review.findMany({
    where: { businessId, status: "approved" },
    orderBy: { createdAt: "desc" }, take,
    select: { id: true, rating: true, comment: true, locale: true, createdAt: true, user: { select: { name: true } } },
  });
}

/** The signed-in user's own review of a business (any status), so they see "pending" and can edit it. */
export async function ownReview(businessId: string, userId: string) {
  return prisma.review.findUnique({ where: { businessId_userId: { businessId, userId } }, select: { id: true, rating: true, comment: true, status: true } });
}

/** Recomputes Business.ratingAvg / ratingCount from the approved reviews. Called after every moderation decision. */
export async function recomputeRating(businessId: string): Promise<void> {
  const rows = await prisma.review.findMany({ where: { businessId, status: "approved" }, select: { rating: true } });
  const { avg, count } = aggregate(rows.map((r) => r.rating));
  await prisma.business.update({ where: { id: businessId }, data: { ratingAvg: avg, ratingCount: count } });
}
