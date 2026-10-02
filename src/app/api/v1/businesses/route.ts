/**
 * GET  /api/v1/businesses — paginated, searchable, filterable list (public: published only)
 * POST /api/v1/businesses — create (requires business.write)
 */
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { created, fail, handleError, metaFor, ok, orderBy, pageParams, slugify } from "@/lib/api";
import { businessInCategories, businessInCity, textWhere } from "@/lib/search-where";
import { reindexBusinessTree } from "@/lib/search-index";
import { addCreatorAsMember } from "@/lib/business-access";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth-helpers";
import { businessCreateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const { page, perPage, skip, take } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status");
    const featured = url.searchParams.get("featured");
    const categoryId = url.searchParams.get("categoryId");
    const cityId = url.searchParams.get("cityId");

    // Anonymous and non-staff callers only ever see published records.
    const publicOnly = !(await isStaffRequest());
    // Same category rule as the public pages: own category or a published service in it, children included.
    const categoryIds = categoryId
      ? [categoryId, ...(await prisma.category.findMany({ where: { parentId: categoryId, deletedAt: null }, select: { id: true } })).map((c) => c.id)]
      : null;
    const where: Prisma.BusinessWhereInput = {
      deletedAt: null,
      ...(publicOnly ? { status: "published" } : status ? { status } : {}),
      ...(featured === "true" ? { featured: true } : {}),
      ...textWhere(q),
      ...(categoryIds ? businessInCategories(categoryIds) : {}),
      ...(cityId ? businessInCity(cityId) : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        skip,
        take,
        orderBy: orderBy(url, ["createdAt", "updatedAt", "name", "ratingAvg", "viewCount"], "createdAt"),
        include: {
          _count: { select: { services: true, locations: true } },
          locations: { where: { isPrimary: true, deletedAt: null }, take: 1, include: { city: true } },
        },
      }),
    ]);

    return ok(rows, metaFor(total, { page, perPage, skip, take }));
  } catch (error) {
    return handleError(error, "businesses.list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("business.write");
    const payload = businessCreateSchema.parse(await request.json());
    // A new business has no confirmed location yet, so it always starts as a draft (publish after adding one).
    if (payload.status === "published") return fail(422, "not_publishable", "Missing before publishing: category, address, city, country, location, locationVerified.");

    // Business has no nameDe column (`name` is the canonical/German text); never pass it to Prisma.
    const { nameDe, ...columns } = payload;
    void nameDe;
    // "verified" and "featured" are moderation decisions: only roles that may publish can set them.
    if (!can(user.role, "business.publish")) { columns.verified = false; columns.featured = false; }
    const business = await prisma.business.create({
      data: {
        ...columns,
        slug: payload.slug ? slugify(payload.slug) : slugify(payload.name),
        publishedAt: null,
        createdById: user.id,
      },
    });
    await reindexBusinessTree(prisma, business.id);
    await addCreatorAsMember(user, business.id);

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "business.create",
      entity: "Business",
      entityId: business.id,
      after: { name: business.name, status: business.status },
    });

    return created(business);
  } catch (error) {
    return handleError(error, "businesses.create");
  }
}

async function isStaffRequest(): Promise<boolean> {
  const { currentUser } = await import("@/lib/auth-helpers");
  const { isStaff } = await import("@/lib/rbac");
  return isStaff((await currentUser())?.role);
}
