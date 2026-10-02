"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";

const schema = z.object({ id: z.string().min(1).max(64), status: z.enum(["new", "read", "replied", "spam"]) });

export async function setMessageStatus(formData: FormData): Promise<void> {
  await requirePermission("review.moderate");
  const { id, status } = schema.parse({ id: formData.get("id"), status: formData.get("status") });
  await prisma.contactMessage.updateMany({ where: { id }, data: { status } });
  revalidatePath("/dr/messages");
}
