import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Owner request 2026-11-15 (global cleanup): each page offers one control per job. These source checks stop the
// removed duplicates from coming back; tests/e2e/catalog.spec.ts checks the rendered pages.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test("business directory: chips are the only category control and the search form has the only submit button", () => {
  const src = read("src/features/listings/BusinessIndex.tsx");
  assert.equal(count(src, /<CategoryNavigation\b/g), 1, "one category navigation");
  assert.equal(count(src, /name="category"/g), 0, "no second category <select> beside the chips");
  assert.equal(count(src, /type="submit"/g), 1, "one submit button (no separate apply button)");
  assert.equal(count(src, /role="search"/g), 1, "one search form");
});

test("/businesses hides the search bar and filters panel; city and category pages keep them (owner request 2026-11-15)", () => {
  assert.match(read("src/app/[locale]/businesses/(list)/page.tsx"), /<BusinessIndex[^>]*\bhideSearchAndFilters\b/);
  for (const p of ["src/app/[locale]/businesses/[slug]/page.tsx", "src/app/[locale]/city/[citySlug]/page.tsx", "src/app/[locale]/city/[citySlug]/[categorySlug]/page.tsx"]) {
    assert.doesNotMatch(read(p), /hideSearchAndFilters/, p);
  }
  // Sort keeps working without the visible form: a hidden form with the same id carries the current query.
  assert.match(read("src/features/listings/BusinessIndex.tsx"), /hideSearchAndFilters \?[\s\S]*?<form id=\{formId\} action=\{pathname\} hidden>/);
});

test("category chips keep a city page's city", () => {
  const nav = read("src/features/listings/categories/CategoryNavigation.tsx");
  assert.doesNotMatch(nav, /href=\{?`?"?\/businesses\//, "chip links are built from the base path");
  for (const p of ["src/app/[locale]/city/[citySlug]/page.tsx", "src/app/[locale]/city/[citySlug]/[categorySlug]/page.tsx"]) {
    assert.match(read(p), /categoryBase=\{`\/city\/\$\{citySlug\}`\}/, p);
  }
});

test("home page lists the categories once (tiles), not again as a second row", () => {
  const home = read("src/app/[locale]/page.tsx");
  assert.equal(count(home, /rootCategories\.map\(/g) + count(home, /tiles\.map\(/g), 2, "hero category select + tiles only");
  assert.doesNotMatch(home, /rh-explore|HomeScroller/);
  assert.equal(count(home, /role="search"/g), 1, "one search form on the home page");
});

test("locations page has one search box and one city control", () => {
  const src = read("src/app/[locale]/locations/page.tsx");
  assert.doesNotMatch(src, /CityBrowser/);
  assert.equal(count(src, /<FilterBar\b/g), 1);
  assert.equal(existsSync(new URL("../src/components/ui/CityBrowser.tsx", import.meta.url)), false);
});

test("list pages render one filter form each", () => {
  for (const p of ["src/app/[locale]/services/(list)/page.tsx", "src/app/[locale]/search/page.tsx", "src/features/content/ContentIndex.tsx"]) {
    const src = read(p);
    assert.ok(count(src, /<FilterBar\b/g) + count(src, /role="search"/g) <= 1, `${p}: more than one search/filter form`);
  }
});
