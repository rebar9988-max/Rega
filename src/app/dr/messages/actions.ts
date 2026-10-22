"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ id: z.string().min(1).max(64), status: z.enum(["new", "read", "replied", "spam"]) });

export async function setMessageStatus(formData: FormData): Promise<void> {
  const user = await requirePermission("review.moderate");
  const { id, status } = schema.parse({ id: formData.get("id"), status: formData.get("status") });
  const changed = await prisma.contactMessage.updateMany({ where: { id }, data: { status } });
  // Every dashboard mutation leaves an audit row (who changed which message to which status).
  if (changed.count) await writeAudit({ actorId: user.id, actorEmail: user.email, action: "message.status", entity: "ContactMessage", entityId: id, after: { status } });
  revalidatePath("/dr/messages");
}
