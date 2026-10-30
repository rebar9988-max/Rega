-- Search analytics (additive): daily counts per normalized search text. No personal data.
-- Written only by one atomic INSERT ... ON CONFLICT DO UPDATE per search (lib/search-analytics.ts), so the table takes
-- no part in the "_RegaRevision" guard of multi-statement writes: a search never makes a dashboard save retry.
-- Rollback: DROP TABLE "SearchQueryDaily"; DELETE FROM d1_migrations WHERE name='0005_search_query_daily.sql';
CREATE TABLE "SearchQueryDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "zeroResults" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "SearchQueryDaily_day_locale_query_key" ON "SearchQueryDaily"("day", "locale", "query");
CREATE INDEX "SearchQueryDaily_day_idx" ON "SearchQueryDaily"("day");
