"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { getGateway } from "@/lib/ai";

export async function setAssistantEnabled(formData: FormData): Promise<void> {
  const enabled = z.enum(["1", "0"]).parse(formData.get("enabled")) === "1";
  const user = await requirePermission("featureflag.write");
  const before = await prisma.featureFlag.findUnique({ where: { key: "public.aiSearch" }, select: { enabled: true } });
  await prisma.featureFlag.upsert({
    where: { key: "public.aiSearch" },
    update: { enabled, rollout: enabled ? 100 : 0, updatedById: user.id },
    create: { key: "public.aiSearch", description: "Public REGA AI assistant", enabled, rollout: enabled ? 100 : 0, updatedById: user.id },
  });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "featureflag.update", entity: "FeatureFlag", entityId: "public.aiSearch", before, after: { enabled } });
  revalidatePath("/dr/ai");
}

/** Sends one tiny request to a provider so admins can verify a key works. The reply text is discarded. */
export async function probeProvider(formData: FormData): Promise<void> {
  const id = z.string().regex(/^[a-z0-9_-]{1,32}$/).parse(formData.get("id"));
  const user = await requirePermission("aiconfig.write");
  const result = await getGateway().probe(id);
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "ai.probe", entity: "AiProvider", entityId: id, after: { ok: result.ok, kind: result.kind ?? null, latencyMs: result.latencyMs } });
  revalidatePath("/dr/ai");
}
