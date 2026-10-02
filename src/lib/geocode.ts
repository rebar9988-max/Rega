/**
 * Geocoding against REGA's own places (cities with public coordinates in the database). Pure and synchronous:
 * no external geocoder, no API key, nothing about the visitor leaves the device. An external provider can be added
 * behind the same two functions later.
 */
import { distanceKm } from "./geo";
import { normalizeSearch } from "./text";

export type Place = { id: string; lat: number; lng: number; countryCode: string; names: string[] };

/** Forward geocoding: places whose name (in any language) starts with, or contains, the query. Input order is kept. */
export function forwardGeocode(query: string, places: Place[], limit = 5): Place[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const score = (p: Place) => {
    const names = p.names.map(normalizeSearch);
    if (names.some((n) => n === q)) return 3;
    if (names.some((n) => n.startsWith(q))) return 2;
    return names.some((n) => n.includes(q)) ? 1 : 0;
  };
  return places
    .map((p, i) => ({ p, i, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Reverse geocoding: the nearest known place within maxKm of a point, or null. */
export function reverseGeocode(point: { lat: number; lng: number }, places: Place[], maxKm = 40): Place | null {
  let best: { p: Place; d: number } | null = null;
  for (const p of places) {
    const d = distanceKm(point, p);
    if (d <= maxKm && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? null;
}

/** Zoom level that shows a circle of radiusKm around the centre on a typical screen. */
export function zoomForRadius(radiusKm: number): number {
  return Math.max(3, Math.min(15, Math.round(14.3 - Math.log2(Math.max(radiusKm, 0.5)))));
}

/** Polygon ring approximating a circle (for the search-radius overlay). */
export function circleRing(center: { lat: number; lng: number }, radiusKm: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const latR = radiusKm / 110.574;
  const lngR = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180) || 1e-9);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + lngR * Math.cos(a), center.lat + latR * Math.sin(a)]);
  }
  return ring;
}
