import assert from "node:assert/strict";
import test from "node:test";
import { MAJOR_CITY_SLUGS, rankSelectorCities, SELECTOR_CITY_LIMIT } from "../src/lib/selector-cities";

test("selector cities prefer listings, then curated German cities, and stay bounded", () => {
  const rows = [
    { id: "aachen", slug: "aachen", nameEn: "Aachen", count: 0 },
    { id: "berlin", slug: "berlin", nameEn: "Berlin", count: 0 },
    { id: "hamburg", slug: "hamburg", nameEn: "Hamburg", count: 2 },
    { id: "small", slug: "aach", nameEn: "Aach", count: 4 },
    { id: "koeln", slug: "koeln", nameEn: "Köln", count: 0 },
  ];
  const ranked = rankSelectorCities(rows);
  assert.deepEqual(ranked.map((c) => c.slug), ["aach", "hamburg", "berlin", "koeln", "aachen"]);
  assert.ok(MAJOR_CITY_SLUGS.includes("berlin"));
  assert.ok(SELECTOR_CITY_LIMIT < 200);
  assert.equal(rankSelectorCities(Array.from({ length: 200 }, (_, i) => ({ id: String(i), slug: `c${i}`, nameEn: `C${i}`, count: 1 }))).length, SELECTOR_CITY_LIMIT);
});

test("a city an admin added stays selectable at count 0 when the cap is already full", () => {
  const listings = Array.from({ length: SELECTOR_CITY_LIMIT }, (_, i) => ({
    id: `l${i}`, slug: `listed-${i}`, nameEn: `Listed ${String(i).padStart(3, "0")}`, count: 1, pinned: false,
  }));
  const added = { id: "new", slug: "teststadt-x", nameEn: "Teststadt x", count: 0, pinned: true };
  const ranked = rankSelectorCities([...listings, added]);
  assert.equal(ranked.length, SELECTOR_CITY_LIMIT);
  assert.equal(ranked.some((c) => c.id === "new"), true);
  assert.equal(ranked.at(-1)?.id, "new");
  assert.equal(ranked.filter((c) => c.pinned).length, 1);
});
