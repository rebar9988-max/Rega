-- Additive only: four new nullable columns. No existing row, column or constraint is changed or removed.

-- AlterTable: optional official social profiles of a business (https URLs, validated in the application).
ALTER TABLE "Business" ADD COLUMN "instagram" TEXT;
ALTER TABLE "Business" ADD COLUMN "facebook" TEXT;
ALTER TABLE "Business" ADD COLUMN "tiktok" TEXT;
ALTER TABLE "Business" ADD COLUMN "snapchat" TEXT;
