import { isMappableCoordinate } from "./coordinates";

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
  if (isMappableCoordinate(lat, lng)) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const q = (address ?? "").trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export type MapLinks = { google: string; apple: string; waze: string; geo: string };

/**
 * The same destination for each map app the visitor may have: universal links open the installed app (Google Maps,
 * Apple Maps, Waze) or its website; `geo:` lets Android offer every installed map app. Coordinates win; else the
 * address is searched. Null when there is nothing to find. Browsers cannot list installed apps, so the page offers these.
 */
export function mapLinks(lat?: number | null, lng?: number | null, address?: string | null, label?: string): MapLinks | null {
  if (isMappableCoordinate(lat, lng)) {
    const at = `${lat},${lng}`;
    const name = label ? `(${encodeURIComponent(label)})` : "";
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${at}`,
      apple: `https://maps.apple.com/?daddr=${at}`,
      waze: `https://waze.com/ul?ll=${at}&navigate=yes`,
      geo: `geo:${at}?q=${at}${name}`,
    };
  }
  const q = encodeURIComponent((address ?? "").trim());
  if (!q) return null;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple: `https://maps.apple.com/?daddr=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    geo: `geo:0,0?q=${q}`,
  };
}

/** Keeps digits and a leading "+", so a tel: link cannot carry anything else. */
export function safeTel(value?: string | null): string | null {
  const cleaned = (value ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned.length >= 5 ? cleaned : null;
}
