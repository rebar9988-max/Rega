import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { analyticsQuery, summarize, MAX_QUERY_LENGTH } from "../src/lib/search-analytics-core";

test("search texts are normalized like the search; personal-looking texts are never stored", () => {
  assert.equal(analyticsQuery("  Restaurant  Erbil "), "restaurant erbil");
  assert.equal(analyticsQuery("RESTAURANT erbil"), "restaurant erbil");
  assert.equal(analyticsQuery("چێشتخانە"), analyticsQuery("چێشتخانە "));
  assert.equal(analyticsQuery("ي"), null); // one letter
  assert.equal(analyticsQuery(""), null);
  assert.equal(analyticsQuery(null), null);
  for (const personal of ["max@example.org", "https://example.org/x", "www.example.de", "shop.com", "0176 1234567", "+49 30 123456", "Kunde 123456"])
    assert.equal(analyticsQuery(personal), null, personal);
  assert.equal(analyticsQuery("Bus 1234"), "bus 1234"); // up to four digits (years, bus lines) are fine
  assert.equal(analyticsQuery("x".repeat(200))?.length, MAX_QUERY_LENGTH);
});

test("stats sum per text and per day, list the most searched and the not-found texts", () => {
  const s = summarize([
    { day: "2026-10-28", query: "restaurant", searches: 3, zeroResults: 0 },
    { day: "2026-10-29", query: "restaurant", searches: 2, zeroResults: 0 },
    { day: "2026-10-29", query: "zahnarzt", searches: 4, zeroResults: 4 },
    { day: "2026-10-29", query: "friseur", searches: 1, zeroResults: 1 },
  ], 7);
  assert.equal(s.searches, 10);
  assert.equal(s.zeroResults, 5);
  assert.deepEqual(s.top.map((r) => [r.query, r.searches]), [["restaurant", 5], ["zahnarzt", 4], ["friseur", 1]]);
  assert.deepEqual(s.missing, [{ query: "zahnarzt", zeroResults: 4 }, { query: "friseur", zeroResults: 1 }]);
  assert.deepEqual(s.perDay, [{ day: "2026-10-28", searches: 3, zeroResults: 0 }, { day: "2026-10-29", searches: 7, zeroResults: 5 }]);
  assert.deepEqual(summarize([], 30), { days: 30, searches: 0, zeroResults: 0, top: [], missing: [], perDay: [] });
});

test("D1 migration: one atomic UPSERT per search keeps one row per day, language and text", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("prisma/d1/migrations/0004_search_query_daily.sql", "utf8"));
  // The statement of recordSearch (lib/search-analytics.ts), with SQLite placeholders.
  const upsert = db.prepare(`INSERT INTO "SearchQueryDaily" ("id", "day", "locale", "query", "searches", "zeroResults")
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT ("day", "locale", "query") DO UPDATE SET "searches" = "SearchQueryDaily"."searches" + 1,
        "zeroResults" = "SearchQueryDaily"."zeroResults" + excluded."zeroResults"`);
  upsert.run("a", "2026-10-29", "de", "zahnarzt", 1);
  upsert.run("b", "2026-10-29", "de", "zahnarzt", 0);
  upsert.run("c", "2026-10-29", "ckb", "zahnarzt", 1);
  upsert.run("d", "2026-10-30", "de", "zahnarzt", 1);
  const rows = db.prepare('SELECT id, day, locale, query, searches, zeroResults FROM "SearchQueryDaily" ORDER BY day, locale').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { id: "c", day: "2026-10-29", locale: "ckb", query: "zahnarzt", searches: 1, zeroResults: 1 },
    { id: "a", day: "2026-10-29", locale: "de", query: "zahnarzt", searches: 2, zeroResults: 1 },
    { id: "d", day: "2026-10-30", locale: "de", query: "zahnarzt", searches: 1, zeroResults: 1 },
  ]);
  const pg = readFileSync("prisma/migrations/20261029120000_search_query_daily/migration.sql", "utf8");
  assert.match(pg, /CREATE UNIQUE INDEX "SearchQueryDaily_day_locale_query_key" ON "SearchQueryDaily"\("day", "locale", "query"\)/);
});
