import { isValidCoordinate } from "./coordinates";
export type AddressResult = { lat: number; lng: number; label: string; street: string; houseNumber: string; postalCode: string; city: string; countryCode: string };
/** Only provider fields are returned; absent address components are never inferred. */
export function parseAddressResults(body: unknown): AddressResult[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { features?: unknown }).features)) return [];
  return (body as { features: unknown[] }).features.slice(0, 6).flatMap((feature) => {
    if (!feature || typeof feature !== "object") return [];
    const f = feature as { geometry?: { type?: string; coordinates?: unknown[] }; properties?: Record<string, unknown> };
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (f.geometry?.type !== "Point" || !isValidCoordinate(lat, lng)) return [];
    const p = f.properties ?? {};
    const text = (key: string) => typeof p[key] === "string" ? (p[key] as string).trim().slice(0, 200) : "";
    const street = text("street"), houseNumber = text("housenumber"), postalCode = text("postcode") || (text("osm_key") === "place" && text("osm_value") === "postcode" ? text("name") : "");
    const city = text("city") || text("town") || text("village") || (text("osm_key") === "place" && ["city", "town", "village", "hamlet"].includes(text("osm_value")) ? text("name") : "");
    const label = [...new Set([text("name"), [street, houseNumber].filter(Boolean).join(" "), [postalCode, city].filter(Boolean).join(" "), text("country")].filter(Boolean))].join(", ");
    return label ? [{ lat, lng: lng as number, label, street, houseNumber, postalCode, city, countryCode: text("countrycode").toUpperCase() }] : [];
  });
}
