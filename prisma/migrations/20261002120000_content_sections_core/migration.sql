-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "businessId" TEXT,
    "createdById" TEXT,
    "cityId" TEXT,
    "categoryId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "searchText" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingTranslation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,

    CONSTRAINT "ListingTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDetails" (
    "listingId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'full_time',
    "applyUrl" TEXT,
    "applyEmail" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "JobDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "EventDetails" (
    "listingId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venue" TEXT,
    "infoUrl" TEXT,

    CONSTRAINT "EventDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "GuideDetails" (
    "listingId" TEXT NOT NULL,
    "readMinutes" INTEGER,

    CONSTRAINT "GuideDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateIndex
CREATE INDEX "Listing_sectionKey_status_publishedAt_idx" ON "Listing"("sectionKey", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Listing_cityId_idx" ON "Listing"("cityId");

-- CreateIndex
CREATE INDEX "Listing_categoryId_idx" ON "Listing"("categoryId");

-- CreateIndex
CREATE INDEX "Listing_businessId_idx" ON "Listing"("businessId");

-- CreateIndex
CREATE INDEX "Listing_createdAt_idx" ON "Listing"("createdAt");

-- CreateIndex
CREATE INDEX "Listing_searchText_trgm_idx" ON "Listing" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sectionKey_slug_key" ON "Listing"("sectionKey", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ListingTranslation_listingId_locale_key" ON "ListingTranslation"("listingId", "locale");

-- CreateIndex
CREATE INDEX "EventDetails_startsAt_idx" ON "EventDetails"("startsAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingTranslation" ADD CONSTRAINT "ListingTranslation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDetails" ADD CONSTRAINT "JobDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDetails" ADD CONSTRAINT "EventDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideDetails" ADD CONSTRAINT "GuideDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

