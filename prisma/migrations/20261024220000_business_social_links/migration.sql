-- Additive and nullable: existing businesses retain their data and have no social accounts by default.
-- Follow the existing Business camelCase column naming (website/logoUrl/coverUrl).
ALTER TABLE "Business"
  ADD COLUMN "facebookUrl" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "tiktokUrl" TEXT,
  ADD COLUMN "snapchatUrl" TEXT;
