/**
 * GET /api/v1/geo — the places behind the location selector (Country -> Region -> City). Public, read-only.
 *
 *   ?country=DE[&region=<id>][&q=text][&limit=40]  countries, the regions of the country and a bounded list of cities
 *   ?city=<id>                                     one active city (labels a saved or shared choice)
 *   ?lat=..&lng=..                                 the known city nearest to a position, used for that lookup only
 *
 * Strictly validated and rate limited. Only existing rows are returned, in a bounded number, never the whole gazetteer.
 * A position is coarsened (~110 m) again here and never logged or stored; position lookups are not cacheable.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { clientIp } from "@/lib/client-ip";
import { coarsen } from "@/lib/geo";
import { allowShared } from "@/lib/rate-limit";
import { DEFAULT_PUBLIC_COUNTRY_CODE } from "@/lib/data";
import { GEO_CITY_LIMIT, geoCities, geoCityById, geoCountries, geoNearestCity, geoRegions } from "@/lib/data/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/);

const querySchema = z
  .object({
    country: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
    region: id.optional(),
    q: z.string().trim().max(80).optional(),
    city: id.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(GEO_CITY_LIMIT),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: "lat and lng go together" });

// These responses include live publication counts; a suspended listing must not survive in a cached total.
const CACHE_CONTROL = "no-store";

export async function GET(request: NextRequest) {
  try {
    // Validate before touching rate-limit storage or the database.
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (!(await allowShared("SEARCH_LIMITER", `geo:${clientIp(request.headers)}`, 120, 60_000))) {
      return fail(429, "rate_limited", "Too many requests. Please wait a moment.");
    }

    if (query.city) {
      const res = ok({ city: await geoCityById(query.city) });
      res.headers.set("Cache-Control", CACHE_CONTROL);
      return res;
    }

    if (query.lat !== undefined && query.lng !== undefined) {
      const res = ok({ nearest: await geoNearestCity({ lat: coarsen(query.lat), lng: coarsen(query.lng) }) });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const countryCode = (query.country ?? DEFAULT_PUBLIC_COUNTRY_CODE).toUpperCase();
    // Text without letters or digits (only % or _ for instance) is not a search.
    const q = query.q && /[\p{L}\p{N}]/u.test(query.q) ? query.q.replace(/[%_\\]/g, " ").trim() : undefined;
    const [countries, regions, list] = await Promise.all([
      geoCountries(),
      geoRegions(countryCode),
      geoCities({ countryCode, regionId: query.region, q, limit: query.limit }),
    ]);
    const res = ok({ countryCode, countries, regions, cities: list.cities, hasMore: list.hasMore });
    res.headers.set("Cache-Control", CACHE_CONTROL);
    return res;
  } catch (error) {
    return handleError(error, "geo");
  }
}
