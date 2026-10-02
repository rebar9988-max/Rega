-- Reviews: one per user per business, linked to the user. Existing rows are kept: before the constraints are added,
-- orphaned user ids and older duplicates of the same (business, user) are detached (userId = NULL), never deleted.
UPDATE "Review" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "Review" r SET "userId" = NULL
WHERE r."userId" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "Review" r2
  WHERE r2."businessId" = r."businessId" AND r2."userId" = r."userId"
    AND (r2."createdAt" > r."createdAt" OR (r2."createdAt" = r."createdAt" AND r2."id" > r."id"))
);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'de',
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT;

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_businessId_userId_key" ON "Review"("businessId", "userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
