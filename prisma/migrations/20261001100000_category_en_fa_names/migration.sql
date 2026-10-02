-- Additive and backward compatible: two nullable columns on "Category" for English and Persian names.
-- Nothing is dropped, renamed or rewritten. Existing rows keep every value; the four base categories created by
-- the seed (keys legal, food, health, admin) get their English and Persian names only where none is set yet.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameEn" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameFa" TEXT;

UPDATE "Category" SET "nameEn" = 'Legal' WHERE "key" = 'legal' AND "nameEn" IS NULL;
UPDATE "Category" SET "nameEn" = 'Food & Drink' WHERE "key" = 'food' AND "nameEn" IS NULL;
UPDATE "Category" SET "nameEn" = 'Health' WHERE "key" = 'health' AND "nameEn" IS NULL;
UPDATE "Category" SET "nameEn" = 'Administration' WHERE "key" = 'admin' AND "nameEn" IS NULL;

UPDATE "Category" SET "nameFa" = 'حقوقی' WHERE "key" = 'legal' AND "nameFa" IS NULL;
UPDATE "Category" SET "nameFa" = 'خوراک و رستوران' WHERE "key" = 'food' AND "nameFa" IS NULL;
UPDATE "Category" SET "nameFa" = 'سلامت' WHERE "key" = 'health' AND "nameFa" IS NULL;
UPDATE "Category" SET "nameFa" = 'امور اداری' WHERE "key" = 'admin' AND "nameFa" IS NULL;
