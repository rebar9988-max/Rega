import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_FEATURES, CATEGORY_FEATURES, UNIVERSAL_FEATURES, featuresFor, featuresFromTags, mergeFeatureTags, rootCategoryKey } from "../src/config/business-features";
import { CATEGORIES } from "../prisma/seed-data/categories";
import { readFileSync } from "node:fs";

const tree = [
  { id: "food", key: "food", parentId: null },
  { id: "pizza", key: "pizza", parentId: "food" },
  { id: "napoli", key: "napoli", parentId: "pizza" },
  { id: "new", key: "brand-new-category", parentId: null },
];

test("one shared list per category: every category gets the universal details, sub-categories inherit their top level", () => {
  for (const c of CATEGORIES) assert.deepEqual(featuresFor(c.key).filter((f) => (UNIVERSAL_FEATURES as readonly string[]).includes(f)), [...UNIVERSAL_FEATURES], c.key);
  assert.equal(rootCategoryKey("napoli", tree), "food");
  assert.deepEqual(featuresFor(rootCategoryKey("napoli", tree)), featuresFor("food"));
  // A category added later in the admin panel works without code: universal details only.
  assert.deepEqual(featuresFor(rootCategoryKey("new", tree)), [...UNIVERSAL_FEATURES]);
  assert.deepEqual(featuresFor(null), [...UNIVERSAL_FEATURES]);
  // Config only names real seeded categories.
  for (const key of Object.keys(CATEGORY_FEATURES)) assert.ok(CATEGORIES.some((c) => c.key === key), key);
});

test("saving keeps other tags, accepts only offered details and drops the rest", () => {
  assert.deepEqual(mergeFeatureTags(["kebab", "feature:halal"], ["delivery", "parking", "freeQuote", "<script>"], "food"), ["kebab", "feature:parking", "feature:delivery"]);
  // Changing to a category without "delivery" drops it; nothing else is lost.
  assert.deepEqual(mergeFeatureTags(["kebab", "feature:delivery"], ["delivery", "wheelchair"], "legal"), ["kebab", "feature:wheelchair"]);
  assert.deepEqual(featuresFromTags(["x", "feature:delivery", "feature:unknown", "feature:wheelchair"]), ["wheelchair", "delivery"]);
  assert.deepEqual(featuresFromTags(null), []);
});

test("every detail has a label in all interface languages", () => {
  for (const l of ["ckb", "kmr", "ar", "fa", "de", "en", "tr", "fr", "sv", "nl", "it"]) {
    const items = JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8")).bizForm.features.items;
    for (const f of ALL_FEATURES) assert.ok(items[f], `${l}: ${f}`);
  }
});
