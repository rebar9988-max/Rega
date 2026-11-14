/** Pure parsing of Nominatim search results (unit-tested; no I/O). */
import { isValidCoordinate } from "./coordinates";

export type GeocodeHit = {
  lat: number; lng: number; label: string;
  /** "address": a house/building; "street": the street only; "area": a district, city or wider. */
  precision: "address" | "street" | "area";
};

const ADDRESS_TYPES = new Set(["house", "building", "residential", "apartments", "commercial", "retail", "office", "shop", "amenity", "place"]);
const STREET_TYPES = new Set(["road", "street", "pedestrian", "footway", "service", "living_street", "primary", "secondary", "tertiary", "unclassified"]);

export function parseNominatim(body: unknown): GeocodeHit[] {
  if (!Array.isArray(body)) return [];
  const hits: GeocodeHit[] = [];
  for (const r of body.slice(0, 5)) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!isValidCoordinate(lat, lng)) continue;
    const kind = String(row.addresstype ?? row.type ?? "");
    const cls = String(row.category ?? row.class ?? "");
    const precision: GeocodeHit["precision"] =
      ADDRESS_TYPES.has(kind) || cls === "building" ? "address" : STREET_TYPES.has(kind) || cls === "highway" ? "street" : "area";
    hits.push({ lat: round6(lat), lng: round6(lng), label: String(row.display_name ?? "").slice(0, 300), precision });
  }
  return hits;
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Centre of a postal-code area and the place it belongs to (city, town or village; district when nothing wider is known). */
export type PostalHit = { lat: number; lng: number; place: string; label: string };

const PLACE_KEYS = ["city", "town", "village", "municipality", "hamlet", "suburb", "city_district", "county"];

/** First usable row of a Nominatim postal-code search made with addressdetails=1. */
export function parsePostal(body: unknown): PostalHit | null {
  if (!Array.isArray(body)) return null;
  for (const r of body.slice(0, 5)) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!isValidCoordinate(lat, lng)) continue;
    const address = row.address && typeof row.address === "object" ? (row.address as Record<string, unknown>) : {};
    const key = PLACE_KEYS.find((k) => typeof address[k] === "string" && (address[k] as string).trim());
    return { lat: round6(lat), lng: round6(lng), place: key ? String(address[key]).trim().slice(0, 120) : "", label: String(row.display_name ?? "").slice(0, 300) };
  }
  return null;
}

// Fixed formats where a partial code is recognisable; every other country accepts any plausible code.
const POSTAL_FORMATS: Record<string, RegExp> = {
  DE: /^\d{5}$/, FR: /^\d{5}$/, IT: /^\d{5}$/, ES: /^\d{5}$/, TR: /^\d{5}$/, FI: /^\d{5}$/, IQ: /^\d{5}$/, US: /^\d{5}(-\d{4})?$/,
  AT: /^\d{4}$/, CH: /^\d{4}$/, BE: /^\d{4}$/, DK: /^\d{4}$/, NO: /^\d{4}$/,
  NL: /^\d{4} ?[A-Za-z]{2}$/, SE: /^\d{3} ?\d{2}$/, GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
};

/** True once a typed postal code is complete enough to look up (so a lookup is never sent per keystroke). */
export function isCompletePostalCode(code: string, countryCode: string): boolean {
  const c = code.trim();
  const format = POSTAL_FORMATS[countryCode.toUpperCase()];
  return format ? format.test(c) : /^[A-Za-z\d][A-Za-z\d -]{2,9}$/.test(c);
}
