-- Smart Request (additive): one request matched to nearby businesses, their inbox rows, offers and an opt-out switch.
-- No existing table is altered. Coordinates are stored rounded (~1 km) and never shown to businesses.
-- Rollback: DROP TABLE "SmartRequestPref"; DROP TABLE "SmartOffer"; DROP TABLE "SmartRequestRecipient"; DROP TABLE "SmartRequest";
CREATE TABLE "SmartRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cityId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'open',
    "selectedOfferId" TEXT,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "offersSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "locale" TEXT NOT NULL DEFAULT 'ckb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmartRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SmartRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SmartRequest_userId_createdAt_idx" ON "SmartRequest"("userId", "createdAt");
CREATE INDEX "SmartRequest_status_expiresAt_idx" ON "SmartRequest"("status", "expiresAt");
CREATE INDEX "SmartRequest_categoryId_idx" ON "SmartRequest"("categoryId");

CREATE TABLE "SmartRequestRecipient" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    CONSTRAINT "SmartRequestRecipient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SmartRequestRecipient_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SmartRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartRequestRecipient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmartRequestRecipient_requestId_businessId_key" ON "SmartRequestRecipient"("requestId", "businessId");
CREATE INDEX "SmartRequestRecipient_businessId_status_idx" ON "SmartRequestRecipient"("businessId", "status");

CREATE TABLE "SmartOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "availability" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmartOffer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SmartOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SmartRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmartOffer_requestId_businessId_key" ON "SmartOffer"("requestId", "businessId");
CREATE INDEX "SmartOffer_requestId_status_idx" ON "SmartOffer"("requestId", "status");
CREATE INDEX "SmartOffer_businessId_status_idx" ON "SmartOffer"("businessId", "status");

CREATE TABLE "SmartRequestPref" (
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmartRequestPref_pkey" PRIMARY KEY ("businessId"),
    CONSTRAINT "SmartRequestPref_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
