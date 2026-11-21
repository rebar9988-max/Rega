import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRANSPORT_TYPES, TRAVEL_ROOT_KEYS, TRAVEL_SCOPE_ID, TRAVEL_SHORTCUTS, TRAVEL_SUBCATEGORIES, parsePostalCode, parseServiceAreas, readTravelTags, transportSearchToken, travelCategoryFilter, travelCategoryIds, writeTravelTags } from "../src/config/travel";
import { CATEGORIES } from "../prisma/seed-data/categories";
import { SECTIONS } from "../src/config/sections";

const LOCALE_FILES = ["ckb", "kmr", "de", "en", "ar", "fa", "tr", "fr", "sv", "nl", "it"];

test("travel: reuses the existing top-level categories, never adds a second root", () => {
  for (const key of TRAVEL_ROOT_KEYS) assert.ok(CATEGORIES.some((c) => c.key === key), key);
  for (const s of TRAVEL_SUBCATEGORIES) {
    assert.ok((TRAVEL_ROOT_KEYS as readonly string[]).includes(s.parent), s.key);
    assert.ok(!CATEGORIES.some((c) => c.key === s.key), `${s.key} must not duplicate a top-level category`);
    assert.match(s.key, /^[a-z]+(-[a-z]+)*$/);
    for (const [l, name] of Object.entries(s.names)) assert.ok(name.trim(), `${s.key}.${l}`);
  }
  assert.equal(TRAVEL_SUBCATEGORIES.length, 14);
  assert.equal(new Set(TRAVEL_SUBCATEGORIES.map((s) => s.key)).size, 14, "unique keys");
  assert.equal(new Set(TRAVEL_SUBCATEGORIES.map((s) => s.names.ckb)).size, 14, "unique Sorani names");
  assert.ok(!TRAVEL_SUBCATEGORIES.some((s) => s.key === TRAVEL_SCOPE_ID), "the virtual scope id is never a real slug");
});

test("travel: scope is the roots plus every descendant, and nothing else", () => {
  const rows = [
    { id: "a", slug: "travel-tickets", parentId: null },
    { id: "b", slug: "transport-moving", parentId: null },
    { id: "c", slug: "legal", parentId: null },
    { id: "d", slug: "car-rental", parentId: "b" },
    { id: "e", slug: "vans", parentId: "d" },
    { id: "f", slug: "family-law", parentId: "c" },
    { id: "x", slug: "loop1", parentId: "y" },
    { id: "y", slug: "loop2", parentId: "x" },
  ];
  assert.deepEqual(travelCategoryIds(rows).sort(), ["a", "b", "d", "e"]);
  assert.deepEqual(travelCategoryIds(rows.filter((r) => !["a", "b"].includes(r.id))), [], "no roots: empty scope, never other categories");
  assert.equal(travelCategoryFilter("d", ["a", "d"]), "d");
  assert.equal(travelCategoryFilter("c", ["a", "d"]), undefined, "a category outside travel is ignored");
  assert.equal(travelCategoryFilter(undefined, ["a"]), undefined);
});

test("travel: postal codes are accepted as typed, anything else is dropped", () => {
  assert.equal(parsePostalCode("50667"), "50667");
  assert.equal(parsePostalCode(" sw1a 1aa "), "SW1A 1AA");
  assert.equal(parsePostalCode("1"), undefined);
  assert.equal(parsePostalCode("50667'; DROP"), undefined);
  assert.equal(parsePostalCode(["50667"]), undefined);
});

test("travel: section is registered without touching header, menu or footer", () => {
  const s = SECTIONS.find((x) => x.key === "travel");
  assert.ok(s?.enabled);
  assert.equal(s?.path, "/travel");
  assert.ok(!s?.header && !s?.mobile && !s?.footer, "navigation unchanged");
  assert.ok(s?.sitemap);
});

test("travel: banner shortcuts are real travel sub-categories", () => {
  for (const slug of TRAVEL_SHORTCUTS) assert.ok(TRAVEL_SUBCATEGORIES.some((c) => c.key === slug), slug);
});

test("travel: every catalogue has the travel strings, Sorani is the brief's text", () => {
  const keys = Object.keys(JSON.parse(readFileSync("src/messages/ckb.json", "utf8")).travel).sort();
  for (const l of LOCALE_FILES) {
    const m = JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"));
    assert.ok(m.nav.travel?.trim(), `nav.travel ${l}`);
    assert.deepEqual(Object.keys(m.travel).sort(), keys, l);
    for (const k of keys) assert.ok(String(m.travel[k]).trim(), `${l}.travel.${k}`);
  }
  const ckb = JSON.parse(readFileSync("src/messages/ckb.json", "utf8"));
  assert.equal(ckb.nav.travel, "گەشت و گواستنەوە");
  assert.equal(ckb.travel.lead, "دۆزینەوەی بازرگانی و خزمەتگوزارییەکانی گەشت و گواستنەوە لە نزیکترین شوێنەکان.");
});

test("travel: the production data files hold exactly the seed rows, insert-only", () => {
  const files = [["prisma/d1/data/20261118_travel_subcategories.sql", 0, 10], ["prisma/d1/data/20261118b_travel_scope_subcategories.sql", 10, 14]] as const;
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  for (const [file, from, to] of files) {
    const sql = readFileSync(file, "utf8");
    const body = sql.replace(/^--.*$/gm, "");
    assert.doesNotMatch(body, /\b(UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i, `${file}: insert-only`);
    assert.equal(body.match(/INSERT INTO/g)?.length, 1, file);
    assert.match(body, /WHERE NOT EXISTS \(SELECT 1 FROM Category c WHERE c\.key=v\.k OR c\.slug=v\.k\)/, `${file}: skips existing keys and slugs`);
    for (const [i, s] of TRAVEL_SUBCATEGORIES.entries()) {
      const n = s.names;
      const row = `(${[s.key, s.parent, n.ckb, n.kmr, n.de, n.en, n.ar, n.fa, n.tr].map(q).join(",")},${i})`;
      assert.equal(sql.includes(row), i >= from && i < to, `${file}: ${s.key}`);
    }
  }
});

test("travel: transport types and service areas round-trip through tags, other tags untouched", () => {
  assert.deepEqual(parseServiceAreas(" Köln, köln ,Bonn\nDüsseldorf;، x ,"), ["Köln", "Bonn", "Düsseldorf"]);
  assert.equal(parseServiceAreas(Array.from({ length: 20 }, (_, i) => `City${i}`).join(",")).length, 10);
  assert.deepEqual(parseServiceAreas(42), []);
  const tags = writeTravelTags(["halal", "transport:bus", "area:Old"], ["van", "car", "rocket"], ["Köln", "Bonn"]);
  assert.deepEqual(tags, ["halal", "transport:car", "transport:van", "area:Köln", "area:Bonn"]);
  assert.deepEqual(readTravelTags(tags), { transport: ["car", "van"], areas: ["Köln", "Bonn"], other: ["halal"] });
  assert.deepEqual(writeTravelTags(tags, [], []), ["halal"], "clearing removes only travel details");
  assert.deepEqual(readTravelTags("not-an-array"), { transport: [], areas: [], other: [] });
  assert.ok(writeTravelTags([], [...TRANSPORT_TYPES], Array(20).fill("Very long service area name that exceeds fifty characters")).every((t) => t.length <= 50));
  assert.equal(transportSearchToken("van"), "transport:van");
});

test("travel: the home tile and page reuse the shared directory pieces", () => {
  const home = readFileSync("src/app/[locale]/page.tsx", "utf8");
  assert.equal(home.match(/href="\/travel"/g)?.length, 1, "category tile");
  assert.match(home, /<TravelBanner className=/, "the home page renders the Rega24Travel banner");
  const banner = readFileSync("src/components/travel/TravelBanner.tsx", "utf8");
  assert.equal(banner.match(/href="\/travel"/g)?.length, 1, "one CTA");
  assert.doesNotMatch(banner, /\/nearby/, "the banner no longer opens the map");
  const page = readFileSync("src/app/[locale]/travel/page.tsx", "utf8") + readFileSync("src/components/travel/TravelCard.tsx", "utf8");
  for (const shared of ["listBusinesses", "TravelCard", "CityFilter", "Pagination", "SaveButton", "sectionEnabled(\"travel\")"]) assert.ok(page.includes(shared), shared);
  assert.doesNotMatch(page, /prisma\./, "no direct queries: the shared data layer only");
});
