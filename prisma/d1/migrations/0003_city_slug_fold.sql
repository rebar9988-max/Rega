-- Unicode-insensitive city slug search; existing URL values are preserved.
ALTER TABLE "City" ADD COLUMN "foldedSlug" TEXT;
