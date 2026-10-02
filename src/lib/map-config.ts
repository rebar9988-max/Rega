/**
 * Map configuration (no secrets). The basemap is a MapLibre style URL, set at build time:
 *   NEXT_PUBLIC_MAP_STYLE_URL   any MapLibre/Mapbox-GL v8 style JSON URL (e.g. a MapTiler or Stadia style with its
 *                               public, domain-restricted key); defaults to OpenFreeMap (OpenStreetMap data, no key).
 * The style's origin is added to the Content-Security-Policy (connect-src) by next.config.ts.
 */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function mapStyleUrl(): string {
  const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  return url && /^https:\/\//.test(url) ? url : DEFAULT_MAP_STYLE_URL;
}

/** Origin the map fetches its style, tiles, glyphs and sprites from. */
export function mapStyleOrigin(): string {
  try { return new URL(mapStyleUrl()).origin; } catch { return new URL(DEFAULT_MAP_STYLE_URL).origin; }
}

/** MapLibre's worker, copied from node_modules at build time (scripts/vendor-maplibre.mjs); same origin, no CDN. */
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";
