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
 * Cities an admin adds are marked and offered the same way, even at count 0.
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

export type RankedCity = { id: string; slug: string | null; nameEn: string; count: number; pinned?: boolean };

/**
 * Listing cities first, then curated German cities, then the rest — capped.
 * `pinned` cities (curated set and cities an admin added) keep a slot even when
 * their count is 0, so the cap cannot hide them behind towns that already have
 * a listing. Display order stays the same: busy cities still come first.
 */
export function rankSelectorCities<T extends RankedCity>(rows: T[], limit = SELECTOR_CITY_LIMIT): T[] {
  const ranked = [...rows].sort((a, b) =>
    b.count - a.count
    || (majorOrder.get(a.slug ?? "") ?? 1_000) - (majorOrder.get(b.slug ?? "") ?? 1_000)
    || a.nameEn.localeCompare(b.nameEn),
  );
  const keep = new Set<string>();
  for (const city of ranked) {
    if (city.pinned && keep.size < limit) keep.add(city.id);
  }
  for (const city of ranked) {
    if (keep.size >= limit) break;
    keep.add(city.id);
  }
  return ranked.filter((city) => keep.has(city.id));
}
