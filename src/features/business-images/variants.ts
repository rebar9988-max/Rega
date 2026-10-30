/**
 * Smaller copies ("variants") of business images for responsive delivery, without a schema change.
 *
 * Next to `business-images/<uuid>.<ext>` the bucket can hold `business-images/<uuid>-w<width>.<ext>` (same format,
 * same aspect ratio). A stored URL announces its variants in its query: `…/<uuid>.jpg?v=160,480,960&w=1280`
 * (`v` = variant widths, `w` = width of the original). The bucket ignores the query, so such a URL still loads the
 * original everywhere; URLs without the query (older uploads, external links) are simply served as they are.
 * Shared by the browser (upload), the server (validation) and pages (srcset). Pure.
 */
export const VARIANT_WIDTHS = [160, 480, 720, 960] as const;

const PATH = /^(.*\/business-images\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png)$/;

export type VariantInfo = { base: string; uuid: string; ext: "jpg" | "png"; widths: number[]; width: number };

/** Widths worth a variant for an image this wide (a copy within 10 % of the original saves little). */
export function variantWidthsFor(width: number): number[] {
  return VARIANT_WIDTHS.filter((w) => w < width * 0.9);
}

export function variantKey(uuid: string, width: number, ext: string): string {
  return `business-images/${uuid}-w${width}.${ext}`;
}

/** The uuid and format of a business image key or URL (`…/business-images/<uuid>.<ext>`), else null. */
export function businessImageId(urlOrKey: string): { uuid: string; ext: "jpg" | "png" } | null {
  const m = PATH.exec(`/${urlOrKey.split(/[?#]/)[0].replace(/^\/+/, "")}`);
  return m ? { uuid: m[2], ext: m[3] as "jpg" | "png" } : null;
}

/** The URL with its variants announced; unchanged when there are none. */
export function withVariants(url: string, widths: number[], width: number): string {
  return widths.length ? `${url.split(/[?#]/)[0]}?v=${widths.join(",")}&w=${width}` : url;
}

/** Variants announced by a URL, or null for a plain URL (also for a malformed or inconsistent query). */
export function parseVariants(url: string): VariantInfo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const v = parsed.searchParams.get("v");
  const w = Number(parsed.searchParams.get("w"));
  if (!v || !/^\d+(,\d+){0,3}$/.test(v) || !Number.isInteger(w) || w < 1 || w > 8192) return null;
  const m = PATH.exec(parsed.pathname);
  if (!m || [...parsed.searchParams.keys()].some((k) => k !== "v" && k !== "w")) return null;
  const widths = v.split(",").map(Number);
  const allowed = new Set(variantWidthsFor(w));
  if (widths.some((x, i) => !allowed.has(x) || (i > 0 && x <= widths[i - 1]))) return null;
  return { base: `${parsed.origin}${m[1]}${m[2]}.${m[3]}`, uuid: m[2], ext: m[3] as "jpg" | "png", widths, width: w };
}

/** `src`/`srcSet` for an <img>: the original as `src`, every announced variant plus the original in `srcSet`. */
export function responsiveImage(url: string): { src: string; srcSet?: string } {
  const info = parseVariants(url);
  if (!info) return { src: url };
  const dir = info.base.slice(0, info.base.lastIndexOf("/") + 1);
  const srcSet = [...info.widths.map((w) => `${dir}${info.uuid}-w${w}.${info.ext} ${w}w`), `${info.base} ${info.width}w`].join(", ");
  return { src: info.base, srcSet };
}
