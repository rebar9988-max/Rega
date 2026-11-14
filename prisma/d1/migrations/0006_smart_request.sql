-- Smart Request (additive): one request matched to nearby businesses, their inbox rows, offers and an opt-out switch.
-- No existing table is altered. Coordinates are stored rounded (~1 km) and never shown to businesses.
-- Rollback: DROP TABLE "SmartRequestPref"; DROP TABLE "SmartOffer"; DROP TABLE "SmartRequestRecipient"; DROP TABLE "SmartRequest";
--           DELETE FROM d1_migrations WHERE name='0006_smart_request.sql';
CREATE TABLE IF NOT EXISTS "SmartRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cityId" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'open',
    "selectedOfferId" TEXT,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "offersSeenAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "locale" TEXT NOT NULL DEFAULT 'ckb',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SmartRequest_userId_createdAt_idx" ON "SmartRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SmartRequest_status_expiresAt_idx" ON "SmartRequest"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "SmartRequest_categoryId_idx" ON "SmartRequest"("categoryId");

CREATE TABLE IF NOT EXISTS "SmartRequestRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "distanceKm" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" DATETIME,
    CONSTRAINT "SmartRequestRecipient_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SmartRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartRequestRecipient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SmartRequestRecipient_requestId_businessId_key" ON "SmartRequestRecipient"("requestId", "businessId");
CREATE INDEX IF NOT EXISTS "SmartRequestRecipient_businessId_status_idx" ON "SmartRequestRecipient"("businessId", "status");

CREATE TABLE IF NOT EXISTS "SmartOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "availability" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SmartRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SmartOffer_requestId_businessId_key" ON "SmartOffer"("requestId", "businessId");
CREATE INDEX IF NOT EXISTS "SmartOffer_requestId_status_idx" ON "SmartOffer"("requestId", "status");
CREATE INDEX IF NOT EXISTS "SmartOffer_businessId_status_idx" ON "SmartOffer"("businessId", "status");

CREATE TABLE IF NOT EXISTS "SmartRequestPref" (
    "businessId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartRequestPref_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
