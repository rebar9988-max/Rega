"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertBusinessAccess } from "@/lib/business-access";
import { reindexBusinessTree } from "@/lib/search-index";
import { SERVICE_INTENTS, saveService, serviceFormSchema } from "@/lib/service-admin";

export type ServiceFormState = { error?: "invalid" | "not_found" | "business_not_found" | "category_not_found"; fields?: string[] } | undefined;

/** Create / edit form. Validation, permissions and business access all run here, on the server. */
export async function saveServiceAction(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const user = await requirePermission("service.write");
  const parsed = serviceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const input = parsed.data;
  await assertBusinessAccess(user, input.businessId);
  if (input.id) {
    const current = await prisma.service.findFirst({ where: { id: input.id, deletedAt: null }, select: { businessId: true } });
    if (!current) return { error: "not_found" };
    await assertBusinessAccess(user, current.businessId);
  }
  const result = await saveService(input, can(user.role, "service.publish"));
  if (!result.ok) return { error: result.error, fields: result.error === "category_not_found" ? ["categoryId"] : result.error === "business_not_found" ? ["businessId"] : undefined };

  await writeAudit({
    actorId: user.id, actorEmail: user.email, action: input.id ? "service.update" : "service.create", entity: "Service", entityId: result.id,
    after: { name: input.name, businessId: input.businessId, published: result.published },
  });
  revalidatePath("/", "layout");
  redirect(`/dr/services/${result.id}?${input.intent === "publish" ? (result.published ? "published" : "blocked") : "saved"}=1`);
}

const intentSchema = z.object({ id: z.string().min(1).max(64), intent: z.enum(Object.keys(SERVICE_INTENTS) as [keyof typeof SERVICE_INTENTS, ...(keyof typeof SERVICE_INTENTS)[]]) });

/** Publish / unpublish / archive / restore / feature from the list. Archive is the safe "delete": nothing is erased. */
export async function updateService(formData: FormData): Promise<void> {
  const { id, intent } = intentSchema.parse({ id: formData.get("id"), intent: formData.get("intent") });
  const effect = SERVICE_INTENTS[intent];
  const user = await requirePermission(effect.permission);
  const before = await prisma.service.findFirst({ where: { id, deletedAt: null }, select: { businessId: true, status: true, featured: true } });
  if (!before) return;
  await assertBusinessAccess(user, before.businessId);
  const after = await prisma.service.update({ where: { id }, data: effect.data(), select: { status: true, featured: true } });
  await reindexBusinessTree(prisma, before.businessId);
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `service.${intent}`, entity: "Service", entityId: id, before: { status: before.status, featured: before.featured }, after });
  revalidatePath("/", "layout");
}
