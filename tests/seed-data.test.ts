import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { LOCALES } from "../src/config/locales";
import { CATEGORIES } from "../prisma/seed-data/categories";
import { CITIES, COUNTRIES, REGIONS } from "../prisma/seed-data/geography";
import { assertSafeDatabase } from "./e2e/global-setup";

test("seed data: approved top-level categories have unique keys, an icon and a name in every locale", () => {
  assert.equal(CATEGORIES.length, 19);
  assert.equal(new Set(CATEGORIES.map((c) => c.key)).size, 19);
  for (const c of CATEGORIES) {
    assert.match(c.key, /^[a-z0-9-]+$/);
    for (const l of LOCALES) assert.ok(c.names[l]?.trim(), `${c.key}.${l}`);
  }
  // The suggested categories of the brief are all present.
  for (const key of ["legal", "food", "health", "admin", "translation", "beauty-barber", "auto-garage", "construction-crafts", "education", "real-estate", "travel-tickets", "groceries-markets", "it-phones", "tax-accounting", "driving-schools", "cleaning", "transport-moving", "insurance", "community-associations"]) {
    assert.ok(CATEGORIES.some((c) => c.key === key), key);
  }
  assert.ok(!CATEGORIES.some((c) => c.key === "events-weddings"), "events-weddings must stay excluded");
});

test("seed data: required cities exist with slugs, valid coordinates, a known country/region and all locale names", () => {
  const required = ["Berlin", "Hamburg", "Cologne", "Munich", "Frankfurt", "Düsseldorf", "Bremen", "Hanover", "Dortmund", "Essen", "Stuttgart", "Bielefeld", "Duisburg", "Bonn", "Nuremberg", "Vienna", "Stockholm", "London", "Amsterdam", "Paris"];
  for (const en of required) assert.ok(CITIES.some((c) => c.names.en === en), en);
  assert.equal(new Set(CITIES.map((c) => c.slug)).size, CITIES.length, "slugs are unique");
  const codes = new Set(COUNTRIES.map((c) => c.code));
  for (const c of CITIES) {
    assert.match(c.slug, /^[a-z0-9-]+$/);
    assert.ok(codes.has(c.country), c.slug);
    assert.ok(c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180, c.slug);
    if (c.region) assert.ok(REGIONS.some((r) => r.country === c.country && r.slug === c.region), `${c.slug} -> ${c.region}`);
    for (const l of LOCALES) assert.ok(c.names[l]?.trim(), `${c.slug}.${l}`);
  }
  for (const code of ["DE", "AT", "SE", "GB", "NL", "FR"]) assert.ok(codes.has(code), code);
  assert.equal(REGIONS.filter((r) => r.country === "DE").length, 16, "all German states");
});

test("seed data: Kurdistan Region and Iraq cities are complete, unique, inside Iraq and regions are named in every locale", () => {
  const iraq = CITIES.filter((c) => c.country === "IQ");
  const kurdistan = ["Erbil", "Sulaymaniyah", "Duhok", "Halabja", "Ankawa", "Zakho", "Ranya", "Koya", "Soran", "Akre", "Shaqlawa", "Chamchamal", "Kalar", "Darbandikhan"];
  for (const en of kurdistan) assert.equal(iraq.find((c) => c.names.en === en)?.region, "kurdistan-region", en);
  for (const en of ["Baghdad", "Basra", "Mosul", "Kirkuk", "Najaf", "Karbala", "Kifri"]) assert.ok(iraq.some((c) => c.names.en === en), en);
  // Disputed administrative assignment: no region is guessed.
  assert.equal(iraq.find((c) => c.slug === "kifri")?.region, undefined);
  // Kirkuk is a governorate of its own, never filed under the Kurdistan Region.
  assert.equal(iraq.find((c) => c.slug === "kirkuk")?.region, "kirkuk-governorate");
  for (const c of iraq) assert.ok(c.lat > 29 && c.lat < 37.5 && c.lng > 38.7 && c.lng < 48.8, `${c.slug} inside Iraq`);
  assert.equal(new Set(iraq.map((c) => c.names.en)).size, iraq.length, "one record per city name");
  assert.equal(new Set(iraq.map((c) => c.names.ckb)).size, iraq.length, "one record per Sorani name");
  for (const r of REGIONS.filter((x) => x.country === "IQ")) {
    for (const l of LOCALES) assert.ok((l === "en" ? r.en : l === "de" ? r.de : r.names?.[l])?.trim(), `${r.slug}.${l}`);
  }
});

test("seed data: the production data file for Iraq geography holds exactly the seed rows", () => {
  const sql = readFileSync("prisma/d1/data/20261028_iraq_geography.sql", "utf8");
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\b(UPDATE|DELETE|DROP|ALTER)\b/i, "insert-only");
  const iraq = CITIES.filter((c) => c.country === "IQ" && !["erbil", "sulaymaniyah"].includes(c.slug));
  for (const c of iraq) {
    const n = c.names;
    assert.ok(sql.includes(`(${[c.slug, c.region ?? "", n.en, n.ckb, n.kmr, n.de, n.fa, n.ar, n.tr].map(q).join(",")},`), c.slug);
  }
  assert.equal(sql.match(/'seed_city_iq_'/g)?.length, 1);
  assert.equal((sql.match(/\('[a-z-]+','[a-z-]*','[^']+','[^']+','[^']+','[^']+','[^']+','[^']+','[^']+',\d+,/g) ?? []).length, iraq.length);
  for (const r of REGIONS.filter((x) => x.country === "IQ")) {
    for (const [l, name] of [["en", r.en], ["de", r.de], ...Object.entries(r.names ?? {})]) assert.ok(sql.includes(`(${[r.slug, l, name].map(q).join(",")})`), `${r.slug}.${l}`);
  }
});

// Needs the migrated database of CI / local development; skipped when none is configured.
test("seeds are idempotent: running them twice changes nothing", { skip: !process.env.DATABASE_URL }, async () => {
  // This test writes too: apply the same fail-closed production/content guard as E2E before running any seed.
  await assertSafeDatabase(process.env.DATABASE_URL!);
  const counts = async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const r = await client.query(`select (select count(*) from "Category") c, (select count(*) from "City") ci, (select count(*) from "Country") co, (select count(*) from "Region") re, (select count(*) from "RegionTranslation") rt, (select count(*) from "Business") b`);
      return JSON.stringify(r.rows[0]);
    } finally {
      await client.end();
    }
  };
  const run = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "pipe", env: { ...process.env, SEED_DEMO: "", NODE_ENV: "test" } });
  run();
  const first = await counts();
  run();
  assert.equal(await counts(), first);
  // The counts include Business: the seed invents no businesses (demo data only with SEED_DEMO=1 outside production).
});
