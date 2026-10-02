/** Coordinate validation shared by forms, APIs, publish checks and the location audit. */

/** A usable map position: finite, in range, and not the (0, 0) "null island" placeholder. */
export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export type PublishCheck = { name: boolean; category: boolean; address: boolean; city: boolean; country: boolean; location: boolean; locationVerified: boolean };

/** Everything a business needs before it may be published (and appear on the map and in Nearby). */
export function publishReadiness(b: {
  name?: string | null; categoryId?: string | null;
  primary?: { addressLine1?: string | null; cityId?: string | null; countryCode?: string | null; latitude?: number | null; longitude?: number | null; coordsVerifiedAt?: Date | string | null } | null;
}): { ok: boolean; missing: (keyof PublishCheck)[] } {
  const p = b.primary;
  const check: PublishCheck = {
    name: (b.name ?? "").trim().length >= 2,
    category: Boolean(b.categoryId),
    address: (p?.addressLine1 ?? "").trim().length >= 3,
    city: Boolean(p?.cityId),
    country: /^[A-Z]{2}$/.test(p?.countryCode ?? ""),
    location: isValidCoordinate(p?.latitude, p?.longitude),
    locationVerified: Boolean(p?.coordsVerifiedAt),
  };
  const missing = (Object.keys(check) as (keyof PublishCheck)[]).filter((k) => !check[k]);
  return { ok: missing.length === 0, missing };
}
