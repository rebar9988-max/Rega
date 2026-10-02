/**
 * POST /api/v1/businesses/bulk — bulk publish / archive / restore / delete
 * Bounded to 500 ids per call; each affected row is audited with one summary entry.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth-helpers";
import { bulkActionSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("business.write");
    const { ids, action } = bulkActionSchema.parse(await request.json());

    if (action === "publish" || action === "unpublish") {
      await requirePermission("business.publish");
    }
    if (action === "delete") {
      await requirePermission("business.delete");
    }

    const data: Prisma.BusinessUpdateManyMutationInput = (() => {
      switch (action) {
        case "publish":
          return { status: "published", publishedAt: new Date(), deletedAt: null };
        case "unpublish":
          return { status: "draft" };
        case "archive":
          return { status: "archived", archivedAt: new Date() };
        case "restore":
          return { status: "draft", archivedAt: null, deletedAt: null };
        case "delete":
          return { status: "archived", archivedAt: new Date(), deletedAt: new Date() };
      }
    })();

    // Publishing only applies to complete businesses with a confirmed location; the rest are reported back.
    let targets = ids;
    let skipped: string[] = [];
    if (action === "publish") {
      const { readinessFor } = await import("@/lib/business-admin");
      const ready = await Promise.all(ids.map(async (id) => [id, (await readinessFor(id)).ok] as const));
      targets = ready.filter(([, okay]) => okay).map(([id]) => id);
      skipped = ready.filter(([, okay]) => !okay).map(([id]) => id);
    }
    const result = await prisma.business.updateMany({ where: { id: { in: targets } }, data });

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: `business.bulk.${action}`,
      entity: "Business",
      after: { requested: ids.length, affected: result.count, skippedIncomplete: skipped.length },
    });

    return ok({ requested: ids.length, affected: result.count, action, skippedIncomplete: skipped });
  } catch (error) {
    return handleError(error, "businesses.bulk");
  }
}
