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
import { approvalData, lockBusiness, publicationSelect } from "@/lib/business-publication";
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
          return { status: "draft", verified: false };
        case "archive":
          return { status: "archived", archivedAt: new Date() };
        case "restore":
          return { status: "draft", verified: false, archivedAt: null, deletedAt: null };
        case "delete":
          return { status: "archived", archivedAt: new Date(), deletedAt: new Date() };
      }
    })();

    // Members-only roles act on the businesses they manage; other ids are ignored (reported as not affected).
    const { manageableIds } = await import("@/lib/business-access");
    const { reindexBusinessTree } = await import("@/lib/search-index");
    const allowed = await manageableIds(user, ids);
    const skipped: string[] = [];
    let affected = 0;
    for (const id of [...new Set(allowed)].sort()) {
      const changed = await prisma.$transaction(async (tx) => {
        await lockBusiness(tx, id);
        const before = await tx.business.findUnique({ where: { id }, select: publicationSelect });
        if (!before || (before.deletedAt && action !== "restore")) return false;
        const next = action === "publish" ? approvalData(before) : data;
        if (!next) { skipped.push(id); return false; }
        if (action === "publish" && before.verified && before.status === "published") return false;
        await tx.business.update({ where: { id }, data: next });
        await reindexBusinessTree(tx, id);
        await tx.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, action: `business.bulk.${action}`, entity: "Business", entityId: id,
          before: { status: before.status, verified: before.verified, categoryId: before.categoryId }, after: { action, ...next } as Prisma.InputJsonObject } });
        return true;
      });
      if (changed) affected++;
    }
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: `business.bulk.${action}`,
      entity: "Business",
      after: { requested: ids.length, affected: affected, skippedIncomplete: skipped.length },
    });

    return ok({ requested: ids.length, affected: affected, action, skippedIncomplete: skipped });
  } catch (error) {
    return handleError(error, "businesses.bulk");
  }
}
