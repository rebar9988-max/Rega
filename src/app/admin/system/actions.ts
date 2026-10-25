"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, HttpError } from "@/lib/auth-helpers";
import { isManagedFlag } from "@/lib/control-center";

/** Settings and their audit entry commit together; never accept arbitrary setting names or secret values. */
export async function setSystemFlag(form: FormData): Promise<void> {
  const actor = await requirePermission("settings.write");
  const key = form.get("key");
  const raw = form.get("enabled");
  if (!isManagedFlag(key) || (raw !== "1" && raw !== "0")) throw new HttpError(422, "invalid_setting", "Invalid setting.");
  const enabled = raw === "1";
  await prisma.$transaction(async (tx) => {
    const before = await tx.featureFlag.findUnique({ where: { key }, select: { enabled: true, rollout: true } });
    await tx.featureFlag.upsert({ where: { key }, update: { enabled, rollout: enabled ? 100 : 0, updatedById: actor.id },
      create: { key, enabled, rollout: enabled ? 100 : 0, updatedById: actor.id } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "system.featureflag.update",
      entity: "FeatureFlag", entityId: key, before: before ?? undefined, after: { enabled, rollout: enabled ? 100 : 0 } } });
  });
  revalidatePath("/admin/system");
}
