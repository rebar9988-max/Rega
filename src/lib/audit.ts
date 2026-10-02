/** Audit trail. Every mutating API route writes one entry. */
import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const h = await headers();
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent") ?? null,
      },
    });
  } catch (error) {
    // Auditing must never break the user-facing request, but it must be visible in logs.
    log.error("audit.write.failed", {
      action: input.action,
      entity: input.entity,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
