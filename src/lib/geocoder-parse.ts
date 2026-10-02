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
