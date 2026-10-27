import { normalizeBasic } from "./text";

/** URL slug. Built from the basic normalization (not the search folding), so existing slug rules are unchanged. */
export function slugify(input: string): string {
  const base = normalizeBasic(input)
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `item-${Date.now().toString(36)}`;
}
