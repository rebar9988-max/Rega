"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { createStaffUser, createUserSchema, updateStaffUser, updateUserSchema } from "@/lib/user-admin";

export async function createUserAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.write");
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dr/users?error=invalid`);
  const result = await createStaffUser(actor, parsed.data);
  if (!result.ok) redirect(`/dr/users?error=${result.error}`);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.create", entity: "User", entityId: result.id, after: { role: parsed.data.role } });
  revalidatePath("/dr/users");
  redirect("/dr/users?done=created");
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.write", "user.role");
  const parsed = updateUserSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) redirect(`/dr/users?error=invalid`);
  const result = await updateStaffUser(actor, parsed.data);
  if (!result.ok) redirect(`/dr/users?error=${result.error}`);
  if (result.changed.length) {
    await writeAudit({
      actorId: actor.id, actorEmail: actor.email, action: "user.update", entity: "User", entityId: parsed.data.id,
      // Never the password itself: only which fields changed and the new role/status.
      after: { changed: result.changed, role: parsed.data.role ?? null, status: parsed.data.status ?? null },
    });
  }
  revalidatePath("/dr/users");
  redirect(`/dr/users?done=${result.changed.length ? "updated" : "unchanged"}`);
}
