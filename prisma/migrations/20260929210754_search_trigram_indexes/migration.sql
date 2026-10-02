-- Trigram search: substring (LIKE %q%) lookups on searchText use a GIN index instead of a sequential scan.
-- Additive: only indexes change, no table data is touched. Requires the pg_trgm extension
-- (available on Neon, Supabase, RDS, Cloud SQL).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- DropIndex
DROP INDEX "Business_searchText_idx";

-- DropIndex
DROP INDEX "Location_searchText_idx";

-- DropIndex
DROP INDEX "Service_searchText_idx";

-- CreateIndex
CREATE INDEX "Business_searchText_trgm_idx" ON "Business" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Location_searchText_trgm_idx" ON "Location" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Service_searchText_trgm_idx" ON "Service" USING GIN ("searchText" gin_trgm_ops);
