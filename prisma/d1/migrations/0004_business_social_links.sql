-- Nullable, additive account links. Existing Business rows and ownership stay intact.
ALTER TABLE "Business" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "snapchatUrl" TEXT;
