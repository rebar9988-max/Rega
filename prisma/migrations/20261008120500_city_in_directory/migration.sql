-- Cities an admin adds (and the curated set) stay selectable in public filters
-- even with zero businesses. The bulk German gazetteer stays out of the HTML.
ALTER TABLE "City" ADD COLUMN "inDirectory" BOOLEAN NOT NULL DEFAULT false;

-- Curated launch cities, plus anything added by hand (no Kurdish name was filled
-- by the gazetteer import, which always writes nameCkb).
UPDATE "City" SET "inDirectory" = true
WHERE "slug" IN (
  'berlin', 'hamburg', 'koeln', 'muenchen', 'frankfurt', 'duesseldorf', 'bremen',
  'hannover', 'dortmund', 'essen', 'stuttgart', 'bielefeld', 'duisburg', 'bonn',
  'nuernberg', 'wien', 'stockholm', 'london', 'amsterdam', 'paris', 'erbil', 'sulaymaniyah'
)
OR "nameCkb" IS NULL;
