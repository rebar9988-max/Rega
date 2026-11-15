/**
 * Saved businesses ("favourites"): the visitor's list of business slugs, kept in this browser's localStorage only
 * (no account, no database table, never sent to the server except as the slugs the saved page asks the public
 * businesses API for). Pure helpers, shared by the browser store, the API and the tests.
 */

export const SAVED_STORAGE_KEY = "rega-saved";
/** Upper bound for one browser's list and for one API lookup. */
export const SAVED_MAX = 100;

// Same alphabet as slugify() in ./slug: lowercase latin, digits, Arabic-script letters and hyphens.
const SLUG = /^[a-z0-9؀-ۿ-]{1,160}$/;

export function isSavedSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG.test(value) && !value.startsWith("-") && !value.endsWith("-");
}

function clean(values: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (isSavedSlug(v) && !out.includes(v)) out.push(v);
    if (out.length >= SAVED_MAX) break;
  }
  return out;
}

/** Stored value -> list of slugs (newest first). Anything malformed is ignored rather than thrown. */
export function parseSaved(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? clean(data) : [];
  } catch {
    return [];
  }
}

export function serializeSaved(slugs: readonly string[]): string {
  return JSON.stringify(clean(slugs));
}

/** Adds the slug at the front, or removes it when already saved. Invalid slugs leave the list unchanged. */
export function toggleSaved(list: readonly string[], slug: string): string[] {
  if (!isSavedSlug(slug)) return clean(list);
  return list.includes(slug) ? list.filter((s) => s !== slug) : clean([slug, ...list]);
}

/** `?slugs=a,b,c` for the public businesses list. null when absent; invalid entries are dropped. */
export function parseSlugsParam(value: string | null): string[] | null {
  if (value === null) return null;
  return clean(value.split(",").map((s) => s.trim()));
}
