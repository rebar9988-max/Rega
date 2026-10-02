"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { recomputeRating } from "@/features/reviews/queries";

const schema = z.object({ id: z.string().min(1).max(64), decision: z.enum(["approved", "rejected"]) });

/** Approve or reject a review; the business rating is recomputed from the approved reviews. */
export async function moderateReview(formData: FormData): Promise<void> {
  const user = await requirePermission("review.moderate");
  const { id, decision } = schema.parse({ id: formData.get("id"), decision: formData.get("decision") });
  const review = await prisma.review.findUnique({ where: { id }, select: { businessId: true, status: true } });
  if (!review) return;
  await prisma.review.update({ where: { id }, data: { status: decision, moderatedById: user.id, moderatedAt: new Date() } });
  await recomputeRating(review.businessId);
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `review.${decision}`, entity: "Review", entityId: id, before: { status: review.status }, after: { status: decision } });
  revalidatePath("/", "layout");
}
