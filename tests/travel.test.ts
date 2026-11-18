import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_ROOT_KEYS, TRAVEL_SUBCATEGORIES, parsePostalCode, travelCategoryFilter, travelCategoryIds } from "../src/config/travel";
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
  assert.equal(TRAVEL_SUBCATEGORIES.length, 10);
  assert.equal(new Set(TRAVEL_SUBCATEGORIES.map((s) => s.key)).size, 10, "unique keys");
  assert.equal(new Set(TRAVEL_SUBCATEGORIES.map((s) => s.names.ckb)).size, 10, "unique Sorani names");
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

test("travel: the production data file holds exactly the seed rows, insert-only", () => {
  const sql = readFileSync("prisma/d1/data/20261118_travel_subcategories.sql", "utf8");
  const body = sql.replace(/^--.*$/gm, "");
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  assert.doesNotMatch(body, /\b(UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i, "insert-only");
  assert.equal(body.match(/INSERT INTO/g)?.length, 1);
  assert.match(body, /WHERE NOT EXISTS \(SELECT 1 FROM Category c WHERE c\.key=v\.k OR c\.slug=v\.k\)/, "skips existing keys and slugs");
  for (const [i, s] of TRAVEL_SUBCATEGORIES.entries()) {
    const n = s.names;
    assert.ok(sql.includes(`(${[s.key, s.parent, n.ckb, n.kmr, n.de, n.en, n.ar, n.fa, n.tr].map(q).join(",")},${i})`), s.key);
  }
});

test("travel: the home tile and page reuse the shared directory pieces", () => {
  const home = readFileSync("src/app/[locale]/page.tsx", "utf8");
  assert.match(home, /href="\/travel"/);
  assert.equal(home.match(/href="\/travel"/g)?.length, 1, "one entry on the home page, no duplicate promo link");
  const page = readFileSync("src/app/[locale]/travel/page.tsx", "utf8");
  for (const shared of ["listBusinesses", "BusinessCard", "CityFilter", "Pagination", "sectionEnabled(\"travel\")"]) assert.ok(page.includes(shared), shared);
  assert.doesNotMatch(page, /prisma\./, "no direct queries: the shared data layer only");
});
