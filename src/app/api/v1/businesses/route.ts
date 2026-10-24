/**
 * GET  /api/v1/businesses — paginated, searchable, filterable list (public: published only)
 * POST /api/v1/businesses — create (requires business.write)
 */
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { created, fail, handleError, metaFor, ok, orderBy, pageParams, slugify } from "@/lib/api";
import { PUBLIC_BUSINESS, businessInCategories, businessInCity, textWhere } from "@/lib/search-where";
import { reindexBusinessTree } from "@/lib/search-index";
import { addCreatorAsMember } from "@/lib/business-access";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth-helpers";
import { businessCreateSchema } from "@/lib/validation";
import { ownsBusinessImages } from "@/lib/business-media";
import { BUSINESS_CATEGORY } from "@/lib/business-publication";
import { descendantIds } from "@/lib/category-tree";
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
    const country = url.searchParams.get("country");
    if (country && !/^[A-Z]{2}$/.test(country)) return fail(422,"validation_error","Invalid country.");

    // Anonymous and non-staff callers only ever see published records.
    const publicOnly = !(await isStaffRequest());
    // Canonical primary category only, including descendants at any depth.
    const categoryIds = categoryId
      ? descendantIds(await prisma.category.findMany({ where: BUSINESS_CATEGORY, select: { id: true, parentId: true } }), categoryId)
      : null;
    const where: Prisma.BusinessWhereInput = {
      ...(publicOnly ? PUBLIC_BUSINESS : { deletedAt: null, ...(status ? { status } : {}) }),
      ...(featured === "true" ? { featured: true } : {}),
      ...textWhere(q),
      ...(categoryIds ? businessInCategories(categoryIds) : {}),
      ...(cityId ? businessInCity(cityId) : {}),
    };

    if (country) where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { locations: { some: { countryCode: country, status: "active", deletedAt: null, ...(cityId ? { cityId } : {}) } } }];
    const [total, rows] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        skip,
        take,
        orderBy: [orderBy(url, ["createdAt", "updatedAt", "name", "ratingAvg", "viewCount"], "createdAt"), { id: "asc" }],
        include: {
          _count: { select: { services: true, locations: true } },
          locations: { where: { isPrimary: true, deletedAt: null }, take: 1, include: { city: true } },
        },
      }),
    ]);

    const publicRows = rows.map((b) => ({ id: b.id, slug: b.slug, name: b.name, nameCkb: b.nameCkb, nameKmr: b.nameKmr, nameAr: b.nameAr, nameTr: b.nameTr,
      status: b.status, description: b.description, logoUrl: b.logoUrl, coverUrl: b.coverUrl, verified: b.verified, categoryId: b.categoryId,
      locations: b.locations.filter((l) => l.status === "active").map((l) => ({ cityId: l.cityId, countryCode: l.countryCode, city: l.city, addressLine1: l.addressLine1 })),
      ratingAvg: b.ratingAvg, ratingCount: b.ratingCount, languages: b.languages }));
    const response = ok(publicOnly ? publicRows : rows, metaFor(total, { page, perPage, skip, take }));
    if (!publicOnly) response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return handleError(error, "businesses.list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("business.write");
    const payload = businessCreateSchema.parse(await request.json());
    // A new business has no confirmed location yet, so it always starts as a draft (publish after adding one).
    if (payload.verified || payload.status === "published") return fail(422, "not_publishable", "Missing before publishing: category, address, city, country, location, locationVerified.");

    if (!payload.categoryId || !await prisma.category.findFirst({ where: { id: payload.categoryId, ...BUSINESS_CATEGORY }, select: { id: true } })) return fail(422, "category_invalid", "Choose an active business category.");
    if (!await ownsBusinessImages(prisma, [payload.logoUrl ?? "", payload.coverUrl ?? ""], user.id)) return fail(422, "media_invalid", "Choose images uploaded through this business form.");
    // Business has no nameDe column (`name` is the canonical/German text); never pass it to Prisma.
    const { nameDe, ...columns } = payload;
    void nameDe;
    // "verified" and "featured" are moderation decisions: only roles that may publish can set them.
    if (!can(user.role, "business.publish")) { columns.verified = false; columns.featured = false; }
    // Pinning ("featured") is an administrator decision.
    if (!can(user.role, "business.pin")) columns.featured = false;
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
  const { currentAccount } = await import("@/lib/auth-helpers");
  const { isStaff } = await import("@/lib/rbac");
  return isStaff((await currentAccount())?.role);
}
