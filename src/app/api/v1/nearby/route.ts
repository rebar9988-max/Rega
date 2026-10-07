/**
 * GET /api/v1/nearby — businesses near a point (Nearby Discovery).
 * Public, read-only, strictly validated and rate limited. The client sends coordinates already coarsened
 * (~110 m); they are coarsened again here and never logged or stored. mode=map returns every match in range
 * (capped) in one response for the map's markers; the list stays paginated.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { clientIp } from "@/lib/client-ip";
import { allowShared } from "@/lib/rate-limit";
import { RADII_KM, coarsen } from "@/lib/geo";
import { NEARBY_MAP_MAX, NEARBY_PER_PAGE, nearbyBusinesses } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().refine((r) => (RADII_KM as readonly number[]).includes(r), "unsupported radius").default(10),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(64).regex(/^[\w-]*$/).optional(),
  open: z.enum(["1"]).optional(),
  sort: z.enum(["distance", "rating"]).default("distance"),
  page: z.coerce.number().int().min(1).max(50).default(1),
  mode: z.enum(["list", "map"]).default("list"),
});

export async function GET(request: NextRequest) {
  try {
    // Validate before touching rate-limit storage or the database. Invalid coordinates must
    // deterministically return 422 even when an optional runtime dependency is temporarily unavailable.
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = querySchema.parse(params);
    if (!(await allowShared("SEARCH_LIMITER", `nearby:${clientIp(request.headers)}`, 120, 60_000))) {
      return fail(429, "rate_limited", "Too many requests. Please wait a moment.");
    }
    const result = await nearbyBusinesses({
      lat: coarsen(query.lat),
      lng: coarsen(query.lng),
      radiusKm: query.radius,
      q: query.q || undefined,
      category: query.category || undefined,
      openNow: query.open === "1",
      sort: query.sort,
      page: query.page,
      mode: query.mode,
    });
    return ok(result.items, { page: result.page, perPage: query.mode === "map" ? NEARBY_MAP_MAX : NEARBY_PER_PAGE, total: result.total, pages: result.pages, truncated: result.truncated });
  } catch (error) {
    return handleError(error, "nearby");
  }
}
