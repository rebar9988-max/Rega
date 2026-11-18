import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { parseAddressResults } from "@/lib/address-result";
export const dynamic = "force-dynamic";
const schema = z.union([
  z.object({ q: z.string().trim().min(3).max(160), country: z.string().regex(/^[A-Z]{2}$/).optional() }),
  z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }),
]);
/** Photon explicitly supports search-as-you-type under reasonable-use limits. No Nominatim autocomplete. */
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return fail(422, "validation_error", "Invalid location query");
  if (!await allowShared("SEARCH_LIMITER", `address:${clientIp(request.headers)}`, 30, 60_000) ||
      !await allowShared("SEARCH_LIMITER", "address:provider-budget", 60, 60_000)) return fail(429, "rate_limited", "Please try again later");
  const query = parsed.data;
  const url = new URL("q" in query ? "https://photon.komoot.io/api/" : "https://photon.komoot.io/reverse");
  url.searchParams.set("limit", "5");
  if ("q" in query) { url.searchParams.set("q", query.q); if (query.country) url.searchParams.set("countrycode", query.country.toLowerCase()); }
  else { url.searchParams.set("lat", String(query.lat)); url.searchParams.set("lon", String(query.lng)); }
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Rega24 (https://www.rega24.com)" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!response.ok) return fail(503, "unavailable", "Address service unavailable");
    const result = ok(parseAddressResults(await response.json()));
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch { return fail(503, "unavailable", "Address service unavailable"); }
}
