-- Search analytics (additive): daily counts per normalized search text. No personal data. Rollback: DROP TABLE "SearchQueryDaily";
CREATE TABLE "SearchQueryDaily" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "zeroResults" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SearchQueryDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SearchQueryDaily_day_locale_query_key" ON "SearchQueryDaily"("day", "locale", "query");
CREATE INDEX "SearchQueryDaily_day_idx" ON "SearchQueryDaily"("day");
