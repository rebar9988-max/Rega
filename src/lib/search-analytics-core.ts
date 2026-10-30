import { normalizeSearch } from "@/lib/text";

/** Longest search text that is stored; longer texts are cut (they are rare and the start says what was looked for). */
export const MAX_QUERY_LENGTH = 60;

/**
 * The search text as it is counted, or null when it must not be stored. Normalized like the search itself (case,
 * Arabic-script variants, digits, accents, spaces), so "Restaurant", "restaurant " and "RESTAURANT" are one entry.
 * Dropped as possibly personal: e-mail addresses, web addresses, anything with five or more digits (phone numbers,
 * customer or document numbers), and texts shorter than two characters. Pure.
 */
export function analyticsQuery(raw: string | null | undefined): string | null {
  const q = normalizeSearch(raw ?? "");
  if ([...q].length < 2) return null;
  if (/@|https?:|www\.|\.(com|de|net|org|iq)\b/i.test(q)) return null;
  if ((q.match(/\d/g) ?? []).length >= 5) return null;
  return [...q].slice(0, MAX_QUERY_LENGTH).join("").trim();
}

export type SearchStats = {
  days: number;
  searches: number;
  zeroResults: number;
  top: { query: string; searches: number; zeroResults: number }[];
  missing: { query: string; zeroResults: number }[];
  perDay: { day: string; searches: number; zeroResults: number }[];
};

/** Pure aggregation of stored rows (unit-tested). */
export function summarize(rows: { day: string; query: string; searches: number; zeroResults: number }[], days: number): SearchStats {
  const byQuery = new Map<string, { searches: number; zeroResults: number }>();
  const byDay = new Map<string, { searches: number; zeroResults: number }>();
  let searches = 0;
  let zeroResults = 0;
  for (const r of rows) {
    searches += r.searches;
    zeroResults += r.zeroResults;
    for (const [map, key] of [[byQuery, r.query], [byDay, r.day]] as const) {
      const v = map.get(key) ?? { searches: 0, zeroResults: 0 };
      v.searches += r.searches;
      v.zeroResults += r.zeroResults;
      map.set(key, v);
    }
  }
  const entries = [...byQuery].map(([query, v]) => ({ query, ...v }));
  return {
    days,
    searches,
    zeroResults,
    top: entries.sort((a, b) => b.searches - a.searches || a.query.localeCompare(b.query)).slice(0, 25),
    missing: entries.filter((e) => e.zeroResults > 0).sort((a, b) => b.zeroResults - a.zeroResults || a.query.localeCompare(b.query)).slice(0, 25).map(({ query, zeroResults: z }) => ({ query, zeroResults: z })),
    perDay: [...byDay].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}
