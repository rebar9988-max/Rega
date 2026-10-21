/** GET /api/v1/businesses/[id] — single business with locations, services, media */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { currentUser } from "@/lib/auth-helpers";
import { PUBLIC_BUSINESS } from "@/lib/search-where";
import { ownsBusinessImages } from "@/lib/business-media";
import { BUSINESS_CATEGORY, approvalData, businessReadiness, lockBusiness, publicationSelect } from "@/lib/business-publication";
import { isStaff } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await currentUser();

    const business = await prisma.business.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(!isStaff(user?.role) ? PUBLIC_BUSINESS : {}) },
      include: {
        locations: { where: { deletedAt: null, ...(!isStaff(user?.role) ? { status: "active" } : {}) }, include: { city: true }, orderBy: { isPrimary: "desc" } },
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
    return ok({ slug: rest.slug, name: rest.name, nameCkb: rest.nameCkb, nameKmr: rest.nameKmr, nameAr: rest.nameAr, nameTr: rest.nameTr, description: rest.description, phone: rest.phone, email: rest.email, website: rest.website, whatsapp: rest.whatsapp, logoUrl: rest.logoUrl, coverUrl: rest.coverUrl, photos: rest.photos, verified: rest.verified, categoryId: rest.categoryId, languages: rest.languages, locations: rest.locations.map((l) => ({ addressLine1: l.addressLine1, city: l.city, countryCode: l.countryCode, latitude: l.latitude, longitude: l.longitude, openingHours: l.openingHours })), services: rest.services.map((s) => ({ slug: s.slug, name: s.name, description: s.description, category: s.category, priceFrom: s.priceFrom, priceTo: s.priceTo, currency: s.currency })), media: media.filter((m) => [business.logoUrl, business.coverUrl, ...business.photos].includes(m.url)).map(({ id, url, mimeType, kind, width, height, altCkb, altDe, altAr, altTr }) => ({ id, url, mimeType, kind, width, height, altCkb, altDe, altAr, altTr })) });
  } catch (error) {
    return handleError(error, "businesses.get");
  }
}

/** PATCH /api/v1/businesses/[id] */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { requirePermission } = await import("@/lib/auth-helpers");
    const { businessUpdateSchema } = await import("@/lib/validation");
    const { assertBusinessAccess } = await import("@/lib/business-access");
    const { reindexBusinessTree } = await import("@/lib/search-index");

    const user = await requirePermission("business.write");
    const { id } = await ctx.params;
    const payload = businessUpdateSchema.parse(await request.json());

    await assertBusinessAccess(user, id);
    if ((payload.verified === true && payload.status && payload.status !== "published") || (payload.verified === false && payload.status === "published")) return fail(422, "validation_error", "Conflicting moderation decisions.");
    const { can } = await import("@/lib/rbac");
    const { HttpError } = await import("@/lib/auth-helpers");
    if (payload.verified !== undefined || payload.featured !== undefined || payload.status === "published") await requirePermission("business.publish");
    const business = await prisma.$transaction(async (tx) => {
      await lockBusiness(tx, id);
      const before = await tx.business.findFirst({ where: { id, deletedAt: null }, select: { ...publicationSelect, logoUrl: true, coverUrl: true, photos: true } });
      if (!before) throw new HttpError(404, "not_found", "Business not found.");
      if (before.verified && before.status === "published" && businessReadiness(before).ok &&
          Object.keys(payload).every((key) => key === "verified" || key === "status") &&
          (payload.verified === true || payload.status === "published") && payload.verified !== false) return tx.business.findUniqueOrThrow({ where: { id } });
      const { nameDe, ...columns } = payload;
      void nameDe;
      if (columns.categoryId) {
        if (!can(user.role, "business.publish") && before.status !== "draft") throw new HttpError(403, "forbidden", "Only staff may reclassify submitted listings.");
        if (!await tx.category.findFirst({ where: { id: columns.categoryId, ...BUSINESS_CATEGORY }, select: { id: true } })) throw new HttpError(422, "category_invalid", "Choose an active business category.");
      }
      if (!await ownsBusinessImages(tx, [payload.logoUrl ?? "", payload.coverUrl ?? ""], user.id, [before.logoUrl ?? "", before.coverUrl ?? "", ...before.photos])) throw new HttpError(422, "media_invalid", "Choose images uploaded through this business form.");
      // Apply the proposed fields inside this transaction; failed approval rolls everything back.
      let updated = await tx.business.update({ where: { id }, data: { ...columns,
        ...(payload.email === "" ? { email: null } : {}), ...(payload.website === "" ? { website: null } : {}),
        ...(payload.status === "archived" ? { archivedAt: new Date() } : {}),
        ...((payload.verified === false && payload.status !== "archived") || payload.status === "draft" ? { verified: false, status: "draft" } : {}),
      } });
      const approving = payload.verified === true || payload.status === "published";
      const proposed = await tx.business.findUniqueOrThrow({ where: { id }, select: publicationSelect });
      if (approving) {
        // Approval cannot implicitly restore an archived/suspended/deleted listing.
        const data = approvalData({ ...proposed, status: before.status, archivedAt: before.archivedAt });
        if (!data) throw new HttpError(422, "not_publishable", "Complete the primary category and confirmed location before verification.");
        updated = await tx.business.update({ where: { id }, data });
      } else if (updated.status === "published" && !businessReadiness(proposed).ok) throw new HttpError(422, "not_publishable", "Published profile must stay complete.");
      await reindexBusinessTree(tx, id);
      await tx.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, action: approving ? "business.verify" : "business.update", entity: "Business", entityId: id,
        before: { name: before.name, status: before.status, verified: before.verified, categoryId: before.categoryId },
        after: { name: updated.name, status: updated.status, verified: updated.verified, categoryId: updated.categoryId } } });
      return updated;
    });
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");

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

    await prisma.$transaction(async (tx) => {
      await lockBusiness(tx, id);
      if (hard) await tx.business.delete({ where: { id } });
      else await tx.business.update({ where: { id }, data: { status: "archived", archivedAt: new Date(), deletedAt: new Date() } });
    });
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");

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
