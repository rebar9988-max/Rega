-- Business social links (additive): four nullable TEXT columns, NULL for every existing row. No data is changed.
-- Apply BEFORE deploying code that reads them (npm run db:d1:migrate); the application never writes them otherwise.
-- Rollback: ALTER TABLE "Business" DROP COLUMN "instagram"; (likewise facebook, tiktok, snapchat)
--           DELETE FROM d1_migrations WHERE name='0006_business_social_links.sql';
ALTER TABLE "Business" ADD COLUMN "instagram" TEXT;
ALTER TABLE "Business" ADD COLUMN "facebook" TEXT;
ALTER TABLE "Business" ADD COLUMN "tiktok" TEXT;
ALTER TABLE "Business" ADD COLUMN "snapchat" TEXT;
