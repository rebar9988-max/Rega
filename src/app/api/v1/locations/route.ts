/**
 * GET  /api/v1/locations — paginated list (?businessId, ?cityId, ?countryCode, ?q)
 * POST /api/v1/locations — create
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { created, handleError, metaFor, normalizeSearch, ok, orderBy, pageParams } from "@/lib/api";
import { currentUser, requirePermission } from "@/lib/auth-helpers";
import { isStaff } from "@/lib/rbac";
import { locationCreateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const { page, perPage, skip, take } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();
    const businessId = url.searchParams.get("businessId");
    const cityId = url.searchParams.get("cityId");
    const countryCode = url.searchParams.get("countryCode");
    const status = url.searchParams.get("status");
    const staff = isStaff((await currentUser())?.role);

    const where = {
      deletedAt: null,
      ...(staff && status ? { status } : { status: "active" }),
      ...(q ? { searchText: { contains: normalizeSearch(q) } } : {}),
      ...(businessId ? { businessId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(countryCode ? { countryCode: countryCode.toUpperCase() } : {}),
      ...(staff ? {} : { business: { status: "published", deletedAt: null } }),
    };

    const [total, rows] = await Promise.all([
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        skip,
        take,
        orderBy: orderBy(url, ["createdAt", "updatedAt", "addressLine1"], "createdAt"),
        include: {
          city: true,
          business: { select: { id: true, name: true, nameCkb: true, slug: true, status: true } },
        },
      }),
    ]);

    return ok(rows, metaFor(total, { page, perPage, skip, take }));
  } catch (error) {
    return handleError(error, "locations.list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("location.write");
    const payload = locationCreateSchema.parse(await request.json());

    // A business may have exactly one primary location; demote the previous one first.
    const location = await prisma.$transaction(async (tx) => {
      if (payload.isPrimary) {
        await tx.location.updateMany({ where: { businessId: payload.businessId, isPrimary: true }, data: { isPrimary: false } });
      }
      return tx.location.create({
        data: {
          ...payload,
          email: payload.email === "" ? null : payload.email,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          cityId: payload.cityId ?? null,
          searchText: normalizeSearch([payload.addressLine1, payload.addressLine2, payload.postalCode, payload.label].filter(Boolean).join(" ")),
        },
      });
    });

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "location.create",
      entity: "Location",
      entityId: location.id,
      after: { businessId: location.businessId, city: location.addressLine1 },
    });

    return created(location);
  } catch (error) {
    return handleError(error, "locations.create");
  }
}
