-- Optional public social profiles of a business. Additive only: four nullable columns, no existing row or column changes.
ALTER TABLE "Business" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "snapchatUrl" TEXT;
