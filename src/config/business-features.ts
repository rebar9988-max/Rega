/**
 * Optional, category-specific business details ("features") for the one shared business form.
 *
 * Every category offers the universal features; a top-level category key may add its own. Sub-categories (any depth)
 * use their top-level category's list, and a category without an entry here (e.g. one added later in the admin panel)
 * simply offers the universal ones — no code change is needed for new categories and there is never a separate form.
 *
 * Stored in the existing `Business.tags` column as "feature:<id>" (no schema change); other tags are left untouched.
 * Only the feature ids listed here are ever accepted (server-side, src/lib/business-admin.ts).
 */
export const UNIVERSAL_FEATURES = ["wheelchair", "parking", "cardPayment"] as const;

export const CATEGORY_FEATURES: Readonly<Record<string, readonly string[]>> = {
  food: ["delivery", "takeaway", "halal", "vegetarian", "outdoorSeating"],
  "groceries-markets": ["delivery", "halal"],
  health: ["appointment", "homeVisits"],
  "beauty-barber": ["appointment", "walkIns"],
  "auto-garage": ["appointment", "repairService"],
  "it-phones": ["repairService"],
  education: ["onlineLessons"],
  "driving-schools": ["onlineLessons"],
  legal: ["freeConsultation", "onlineAppointments"],
  "tax-accounting": ["freeConsultation", "onlineAppointments"],
  translation: ["freeConsultation", "onlineAppointments"],
  insurance: ["freeConsultation", "onlineAppointments"],
  admin: ["freeConsultation", "onlineAppointments"],
  "real-estate": ["freeConsultation", "onlineAppointments"],
  "construction-crafts": ["freeQuote", "serviceAtCustomer"],
  cleaning: ["freeQuote", "serviceAtCustomer"],
  "transport-moving": ["freeQuote", "serviceAtCustomer"],
  "travel-tickets": ["onlineBooking"],
};

/** Every known feature id (for translations and tests). */
export const ALL_FEATURES = [...new Set([...UNIVERSAL_FEATURES, ...Object.values(CATEGORY_FEATURES).flat()])];

export const FEATURE_TAG = "feature:";

/** Features offered for a category, by the key of its top-level category (undefined/unknown -> universal only). */
export function featuresFor(rootKey: string | null | undefined): string[] {
  return [...new Set([...(rootKey ? CATEGORY_FEATURES[rootKey] ?? [] : []), ...UNIVERSAL_FEATURES])];
}

/** Feature ids stored in a business's tags, in the configured order. */
export function featuresFromTags(tags: readonly string[] | null | undefined): string[] {
  const set = new Set((tags ?? []).filter((t) => t.startsWith(FEATURE_TAG)).map((t) => t.slice(FEATURE_TAG.length)));
  return ALL_FEATURES.filter((f) => set.has(f));
}

/**
 * New tags: the submitted features that the category allows, plus every tag that is not a feature (kept as it was).
 * Unknown ids, and features of another category, are dropped.
 */
export function mergeFeatureTags(previous: readonly string[] | null | undefined, submitted: readonly string[], rootKey: string | null | undefined): string[] {
  const allowed = new Set(featuresFor(rootKey));
  const chosen = ALL_FEATURES.filter((f) => allowed.has(f) && submitted.includes(f));
  return [...(previous ?? []).filter((t) => !t.startsWith(FEATURE_TAG)), ...chosen.map((f) => `${FEATURE_TAG}${f}`)];
}

/** Key of the top-level ancestor of a category (the category's own key when it has no known parent; cycles stop). */
export function rootCategoryKey(id: string | null | undefined, rows: readonly { id: string; key: string; parentId: string | null }[]): string | null {
  const byId = new Map(rows.map((r) => [r.id, r]));
  let row = id ? byId.get(id) : undefined;
  for (let depth = 0; row?.parentId && byId.has(row.parentId) && depth < 20; depth++) row = byId.get(row.parentId);
  return row?.key ?? null;
}
