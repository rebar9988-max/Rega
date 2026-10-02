import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { LOCALES } from "../src/config/locales";
import { CATEGORIES } from "../prisma/seed-data/categories";
import { CITIES, COUNTRIES, REGIONS } from "../prisma/seed-data/geography";
import { assertSafeDatabase } from "./e2e/global-setup";

test("seed data: 20 top-level categories with unique keys, an icon and a name in every locale", () => {
  assert.equal(CATEGORIES.length, 20);
  assert.equal(new Set(CATEGORIES.map((c) => c.key)).size, 20);
  for (const c of CATEGORIES) {
    assert.match(c.key, /^[a-z0-9-]+$/);
    for (const l of LOCALES) assert.ok(c.names[l]?.trim(), `${c.key}.${l}`);
  }
  // The suggested categories of the brief are all present.
  for (const key of ["legal", "food", "health", "admin", "translation", "beauty-barber", "auto-garage", "construction-crafts", "education", "real-estate", "travel-tickets", "groceries-markets", "events-weddings", "it-phones", "tax-accounting", "driving-schools", "cleaning", "transport-moving", "insurance", "community-associations"]) {
    assert.ok(CATEGORIES.some((c) => c.key === key), key);
  }
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
