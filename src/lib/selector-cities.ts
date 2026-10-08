/**
 * Cities offered in public dropdowns and city browsers.
 * The full German gazetteer is about 2,000 rows. Putting every one in the HTML
 * (homepage alone was ~550 KB / 2,000 <option>s) is what exhausts Cloudflare
 * Worker CPU and returns error 1102. Callers embed only this bounded set.
 */
export const SELECTOR_CITY_LIMIT = 80;

/**
 * Curated German cities (prisma/seed-data/geography.ts). Always offered, even
 * before any business is published, so the "where" search stays useful.
 * Cities an admin adds are flagged `inDirectory` and offered the same way.
 * The bulk gazetteer appears only once a city has a public listing.
 */
export const MAJOR_CITY_SLUGS = [
  "berlin",
  "hamburg",
  "koeln",
  "muenchen",
  "frankfurt",
  "duesseldorf",
  "bremen",
  "hannover",
  "dortmund",
  "essen",
  "stuttgart",
  "bielefeld",
  "duisburg",
  "bonn",
  "nuernberg",
] as const;

const majorOrder = new Map<string, number>(MAJOR_CITY_SLUGS.map((slug, index) => [slug, index]));

export type RankedCity = { id: string; slug: string | null; nameEn: string; count: number };

/** Listing cities first, then the curated German cities, capped. */
export function rankSelectorCities<T extends RankedCity>(rows: T[], limit = SELECTOR_CITY_LIMIT): T[] {
  return [...rows]
    .sort((a, b) =>
      b.count - a.count
      || (majorOrder.get(a.slug ?? "") ?? 1_000) - (majorOrder.get(b.slug ?? "") ?? 1_000)
      || a.nameEn.localeCompare(b.nameEn),
    )
    .slice(0, limit);
}
