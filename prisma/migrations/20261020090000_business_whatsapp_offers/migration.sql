-- Additive only: two new nullable/defaulted columns and one new table. No existing row, column or constraint is changed or removed.

-- AlterTable: public business WhatsApp number (international format, validated in the application).
ALTER TABLE "Business" ADD COLUMN "whatsapp" TEXT;

-- AlterTable: public photos of the business (REGA media URLs; logo and cover keep their own columns).
ALTER TABLE "Business" ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: genuine, time-limited offers of a business.
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2),
    "currency" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_businessId_isActive_startsAt_endsAt_idx" ON "Offer"("businessId", "isActive", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defence in depth (the application validates the same rules first): an offer ends after it starts, and a discount is
-- either absent, a percentage between 1 and 90, or a positive amount with a currency. No original/"was" price exists.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_dates_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_discount_check" CHECK (
  ("discountType" = 'none' AND "discountValue" IS NULL AND "currency" IS NULL)
  OR ("discountType" = 'percent' AND "discountValue" >= 1 AND "discountValue" <= 90 AND "currency" IS NULL)
  OR ("discountType" = 'amount' AND "discountValue" > 0 AND "currency" IS NOT NULL)
);
