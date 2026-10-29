import { databaseTransaction } from "@/lib/database-transaction";
/**
 * GET  /api/v1/locations — paginated list (?businessId, ?cityId, ?countryCode, ?q)
 * POST /api/v1/locations — create
 */
import type { NextRequest } from "next/server";
import { lockBusiness, businessReadiness, publicationSelect } from "@/lib/business-publication";
import { HttpError } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { created, fail, handleError, metaFor, ok, orderBy, pageParams } from "@/lib/api";
import { PUBLIC_BUSINESS, textWhere } from "@/lib/search-where";
import { reindexBusinessTree } from "@/lib/search-index";
import { assertBusinessAccess } from "@/lib/business-access";
import { parseOpeningHours } from "@/lib/opening-hours";
import { currentAccount, requirePermission } from "@/lib/auth-helpers";
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
    const staff = isStaff((await currentAccount())?.role);

    const where = {
      deletedAt: null,
      ...(staff && status ? { status } : { status: "active" }),
      ...textWhere(q),
      ...(businessId ? { businessId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(countryCode ? { countryCode: countryCode.toUpperCase() } : {}),
      ...(staff ? {} : { business: PUBLIC_BUSINESS }),
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

    const response = ok(rows, metaFor(total, { page, perPage, skip, take }));
    if (staff) response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return handleError(error, "locations.list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("location.write");
    const payload = locationCreateSchema.parse(await request.json());
    if (!(await prisma.business.findFirst({ where: { id: payload.businessId, deletedAt: null }, select: { id: true } }))) {
      return fail(404, "not_found", "Business not found.");
    }
    await assertBusinessAccess(user, payload.businessId);
    if (payload.openingHours) {
      const parsed = parseOpeningHours(payload.openingHours);
      if (!parsed.ok) return fail(422, "validation_error", "Invalid opening hours.", { days: parsed.invalid });
      payload.openingHours = (parsed.value ?? undefined) as Record<string, string> | undefined;
    }

    if (payload.cityId && !await prisma.city.findFirst({ where: { id: payload.cityId, isActive: true, country: { code: payload.countryCode } }, select: { id: true } })) return fail(422, "validation_error", "The city must belong to the selected country.");
    // A business may have exactly one primary location; demote the previous one first.
    const location = await databaseTransaction(async (tx) => {
      await lockBusiness(tx, payload.businessId);
      if (payload.isPrimary) {
        await tx.location.updateMany({ where: { businessId: payload.businessId, isPrimary: true }, data: { isPrimary: false } });
      }
      const row = await tx.location.create({
        data: {
          ...payload,
          email: payload.email === "" ? null : payload.email,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          cityId: payload.cityId ?? null,
        },
      });
      const business = await tx.business.findUniqueOrThrow({ where: { id: payload.businessId }, select: publicationSelect });
      if (business.status === "published" && !businessReadiness(business).ok) throw new HttpError(422, "not_publishable", "A published business must keep its confirmed primary location.");
      return row;
    });
    await reindexBusinessTree(prisma, payload.businessId);

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
