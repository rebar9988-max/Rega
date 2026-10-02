/** GET /api/v1/businesses/[id] — single business with locations, services, media */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { currentUser } from "@/lib/auth-helpers";
import { isStaff } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await currentUser();

    const business = await prisma.business.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      include: {
        locations: { where: { deletedAt: null }, include: { city: true }, orderBy: { isPrimary: "desc" } },
        services: {
          where: isStaff(user?.role) ? { deletedAt: null } : { status: "published", deletedAt: null },
          include: { category: true },
          orderBy: { sortOrder: "asc" },
        },
        media: { where: { deletedAt: null }, take: 50 },
        _count: { select: { services: true, locations: true, reviews: true } },
      },
    });

    if (!business) return fail(404, "not_found", "Business not found.");
    if (business.status !== "published" && !isStaff(user?.role)) {
      return fail(404, "not_found", "Business not found.");
    }

    if (isStaff(user?.role)) return ok(business);
    // Public callers get the public profile only: no internal ids, counters or storage keys.
    const { createdById: _c, viewCount: _v, deletedAt: _d, media, ...rest } = business;
    void _c; void _v; void _d;
    return ok({ ...rest, media: media.map(({ id, url, mimeType, kind, width, height, altCkb, altDe, altAr, altTr }) => ({ id, url, mimeType, kind, width, height, altCkb, altDe, altAr, altTr })) });
  } catch (error) {
    return handleError(error, "businesses.get");
  }
}

/** PATCH /api/v1/businesses/[id] */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { requirePermission } = await import("@/lib/auth-helpers");
    const { businessUpdateSchema } = await import("@/lib/validation");
    const { writeAudit } = await import("@/lib/audit");
    const { assertBusinessAccess } = await import("@/lib/business-access");
    const { reindexBusinessTree } = await import("@/lib/search-index");

    const user = await requirePermission("business.write");
    const { id } = await ctx.params;
    const payload = businessUpdateSchema.parse(await request.json());

    const before = await prisma.business.findFirst({ where: { id, deletedAt: null } });
    if (!before) return fail(404, "not_found", "Business not found.");
    await assertBusinessAccess(user, id);

    // Publishing is a separate permission from editing, and needs a complete profile with a confirmed location.
    if (payload.status === "published" && before.status !== "published") {
      await requirePermission("business.publish");
      const { readinessFor } = await import("@/lib/business-admin");
      const readiness = await readinessFor(id);
      if (!readiness.ok) return fail(422, "not_publishable", `Missing before publishing: ${readiness.missing.join(", ")}.`);
    }

    // Business has no nameDe column (`name` is the canonical/German text); never pass it to Prisma.
    const { nameDe, ...columns } = payload;
    void nameDe;
    const business = await prisma.business.update({
      where: { id },
      data: {
        ...columns,
        ...(payload.email === "" ? { email: null } : {}),
        ...(payload.website === "" ? { website: null } : {}),
        ...(payload.status === "published" && before.status !== "published" ? { publishedAt: new Date() } : {}),
        ...(payload.status === "archived" ? { archivedAt: new Date() } : {}),
      },
    });
    await reindexBusinessTree(prisma, id);

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "business.update",
      entity: "Business",
      entityId: id,
      before: { name: before.name, status: before.status, featured: before.featured },
      after: { name: business.name, status: business.status, featured: business.featured },
    });

    return ok(business);
  } catch (error) {
    return handleError(error, "businesses.update");
  }
}

/** DELETE /api/v1/businesses/[id] — soft delete (archive + trash flag) by default, hard only with ?hard=true */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { requirePermission } = await import("@/lib/auth-helpers");
    const { writeAudit } = await import("@/lib/audit");

    const user = await requirePermission("business.delete");
    const { id } = await ctx.params;
    const hard = new URL(request.url).searchParams.get("hard") === "true";

    if (hard) {
      await prisma.business.delete({ where: { id } });
    } else {
      await prisma.business.update({
        where: { id },
        data: { status: "archived", archivedAt: new Date(), deletedAt: new Date() },
      });
    }

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: hard ? "business.delete.hard" : "business.delete.soft",
      entity: "Business",
      entityId: id,
    });

    return ok({ id, hard });
  } catch (error) {
    return handleError(error, "businesses.delete");
  }
}
