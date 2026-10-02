"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { categoryFormSchema, saveCategory } from "@/lib/category-admin";

export type CategoryFormState = { error?: "invalid" | "not_found" | "parent_invalid"; fields?: string[] } | undefined;

export async function saveCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requirePermission("category.write");
  const parsed = categoryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const result = await saveCategory(parsed.data);
  if (!result.ok) return { error: result.error, fields: result.error === "parent_invalid" ? ["parentId"] : undefined };
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: parsed.data.id ? "category.update" : "category.create", entity: "Category", entityId: result.id, after: { nameDe: parsed.data.nameDe } });
  revalidatePath("/", "layout");
  redirect(`/dr/categories/${result.id}?saved=1`);
}

const toggleSchema = z.object({ id: z.string().min(1).max(64), active: z.enum(["0", "1"]) });

/** Deactivate (hide) or reactivate a category. Nothing is deleted; references stay valid. */
export async function setCategoryActive(formData: FormData): Promise<void> {
  const user = await requirePermission("category.write");
  const { id, active } = toggleSchema.parse({ id: formData.get("id"), active: formData.get("active") });
  const before = await prisma.category.findFirst({ where: { id, deletedAt: null }, select: { isActive: true } });
  if (!before) return;
  await prisma.category.update({ where: { id }, data: { isActive: active === "1" } });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: active === "1" ? "category.activate" : "category.deactivate", entity: "Category", entityId: id, before, after: { isActive: active === "1" } });
  revalidatePath("/", "layout");
}
