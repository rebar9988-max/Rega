"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";

const addSchema = z.object({ businessId: z.string().min(1).max(64), email: z.string().trim().toLowerCase().email().max(200) });
const removeSchema = z.object({ businessId: z.string().min(1).max(64), userId: z.string().min(1).max(64) });

/** Adds an existing staff account as a member of a business (it may then edit that business and its services). */
export async function addBusinessMember(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.write");
  const parsed = addSchema.safeParse({ businessId: formData.get("businessId"), email: formData.get("email") });
  if (!parsed.success) redirect(`/dr/businesses/${encodeURIComponent(String(formData.get("businessId") ?? ""))}?team=invalid`);
  const { businessId, email } = parsed.data;
  const [business, user] = await Promise.all([
    prisma.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { id: true } }),
    prisma.user.findFirst({ where: { email, deletedAt: null, role: { not: "USER" } }, select: { id: true, role: true } }),
  ]);
  if (!business) redirect("/dr/businesses");
  if (!user) redirect(`/dr/businesses/${businessId}?team=notfound`);
  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId, userId: user.id } },
    update: { isActive: true },
    create: { businessId, userId: user.id, role: "EMPLOYEE" },
  });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "business.member.add", entity: "Business", entityId: businessId, after: { userId: user.id } });
  revalidatePath(`/dr/businesses/${businessId}`);
  redirect(`/dr/businesses/${businessId}?team=added`);
}

export async function removeBusinessMember(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.write");
  const { businessId, userId } = removeSchema.parse({ businessId: formData.get("businessId"), userId: formData.get("userId") });
  await prisma.businessMember.updateMany({ where: { businessId, userId }, data: { isActive: false } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "business.member.remove", entity: "Business", entityId: businessId, after: { userId } });
  revalidatePath(`/dr/businesses/${businessId}`);
}
