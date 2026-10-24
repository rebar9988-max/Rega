import { isValidCoordinate } from "./coordinates";

/** Only http(s) URLs may be rendered as links: blocks javascript:/data: URLs from user-generated content. */
export function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Directions to a place. A Google Maps URL is the one link that opens the device's map app (Android, iOS) and falls
 * back to the browser elsewhere; coordinates win, else the address is searched. Null when there is nothing to find.
 */
export function directionsUrl(lat?: number | null, lng?: number | null, address?: string | null): string | null {
  if (isValidCoordinate(lat, lng)) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const q = (address ?? "").trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/** Keeps digits and a leading "+", so a tel: link cannot carry anything else. */
export function safeTel(value?: string | null): string | null {
  const cleaned = (value ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned.length >= 5 ? cleaned : null;
}
