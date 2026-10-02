"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ id: z.string().min(1).max(64), status: z.enum(["open", "reviewing", "actioned", "dismissed"]), note: z.string().trim().max(1000).optional() });

/** Moderators record the outcome of a content report (DSA notice-and-action). The note is kept with the decision. */
export async function setReportStatus(formData: FormData): Promise<void> {
  const user = await requirePermission("review.moderate");
  const { id, status, note } = schema.parse({ id: formData.get("id"), status: formData.get("status"), note: formData.get("note") || undefined });
  const before = await prisma.report.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.report.update({ where: { id }, data: { status, note: note ?? undefined, handledById: status === "open" ? null : user.id, handledAt: status === "open" ? null : new Date() } });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `report.${status}`, entity: "Report", entityId: id, before, after: { status } });
  revalidatePath("/dr/reports");
}
