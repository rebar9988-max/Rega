-- Nullable, additive account links. Existing Business rows and ownership stay intact.
-- This migration was already applied to production before the canonical migration file was restored.
ALTER TABLE "Business" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "snapchatUrl" TEXT;
