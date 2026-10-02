-- Additive and backward compatible: new nullable columns, a foreign key and indexes. Nothing is dropped,
-- renamed, rewritten or deleted; existing rows keep their values (the new columns start as NULL).

-- Business: primary category chosen in the admin form.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
CREATE INDEX IF NOT EXISTS "Business_categoryId_idx" ON "Business"("categoryId");
DO $$ BEGIN
  ALTER TABLE "Business" ADD CONSTRAINT "Business_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Location: how the coordinates were obtained and when an admin confirmed them on the map.
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "coordsSource" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "coordsVerifiedAt" TIMESTAMP(3);
