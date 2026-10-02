/**
 * GET  /api/v1/categories — full active tree (small, cacheable dataset)
 * POST /api/v1/categories — create (requires category.write)
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { created, handleError, ok, slugify } from "@/lib/api";
import { requirePermission } from "@/lib/auth-helpers";
import { categoryCreateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
      include: { _count: { select: { services: true, children: true } } },
    });
    return ok(categories, undefined, 200);
  } catch (error) {
    return handleError(error, "categories.list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("category.write");
    const payload = categoryCreateSchema.parse(await request.json());

    const category = await prisma.category.create({
      data: {
        ...payload,
        slug: payload.slug ? slugify(payload.slug) : slugify(payload.key),
        parentId: payload.parentId ?? null,
      },
    });

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "category.create",
      entity: "Category",
      entityId: category.id,
      after: { key: category.key, nameDe: category.nameDe },
    });

    return created(category);
  } catch (error) {
    return handleError(error, "categories.create");
  }
}
