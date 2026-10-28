-- D1 runtime support. Apply atomically before enabling the D1 application client.
PRAGMA defer_foreign_keys=ON;
ALTER TABLE "User" ADD COLUMN "foldedEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "foldedName" TEXT;
ALTER TABLE "Business" ADD COLUMN "foldedName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "City" ADD COLUMN "foldedNameEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "City" ADD COLUMN "foldedNameCkb" TEXT;
ALTER TABLE "City" ADD COLUMN "foldedNameKmr" TEXT;
ALTER TABLE "City" ADD COLUMN "foldedNameDe" TEXT;
ALTER TABLE "City" ADD COLUMN "foldedNameFa" TEXT;
ALTER TABLE "City" ADD COLUMN "foldedNameAr" TEXT;
ALTER TABLE "City" ADD COLUMN "foldedNameTr" TEXT;
ALTER TABLE "CityTranslation" ADD COLUMN "foldedName" TEXT NOT NULL DEFAULT '';
CREATE TABLE "__rega_new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "label" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "cityId" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "coordsSource" TEXT,
    "coordsVerifiedAt" DATETIME,
    "phone" TEXT,
    "email" TEXT,
    "openingHours" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "searchText" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Location_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "__rega_new_Location" SELECT * FROM "Location";
DROP TABLE "Location";
ALTER TABLE "__rega_new_Location" RENAME TO "Location";
CREATE INDEX "Location_businessId_isPrimary_idx" ON "Location"("businessId", "isPrimary");
CREATE INDEX "Location_latitude_longitude_idx" ON "Location"("latitude", "longitude");
CREATE INDEX "Location_cityId_idx" ON "Location"("cityId");
CREATE INDEX "Location_status_idx" ON "Location"("status");
CREATE TABLE "__rega_new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "__rega_new_AuditLog" SELECT * FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "__rega_new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE TABLE "__rega_new_Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "__rega_new_Setting" SELECT * FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "__rega_new_Setting" RENAME TO "Setting";
CREATE TABLE "_RegaRevision" (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CONSTRAINT RegaRevision_nonnegative CHECK(revision>=0));
INSERT INTO "_RegaRevision" VALUES(1,0);
CREATE TRIGGER "_rega_revision_User_INSERT" AFTER INSERT ON "User" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_User_UPDATE" AFTER UPDATE ON "User" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_User_DELETE" AFTER DELETE ON "User" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Account_INSERT" AFTER INSERT ON "Account" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Account_UPDATE" AFTER UPDATE ON "Account" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Account_DELETE" AFTER DELETE ON "Account" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Session_INSERT" AFTER INSERT ON "Session" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Session_UPDATE" AFTER UPDATE ON "Session" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Session_DELETE" AFTER DELETE ON "Session" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AdminSignInCode_INSERT" AFTER INSERT ON "AdminSignInCode" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AdminSignInCode_UPDATE" AFTER UPDATE ON "AdminSignInCode" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AdminSignInCode_DELETE" AFTER DELETE ON "AdminSignInCode" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_VerificationToken_INSERT" AFTER INSERT ON "VerificationToken" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_VerificationToken_UPDATE" AFTER UPDATE ON "VerificationToken" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_VerificationToken_DELETE" AFTER DELETE ON "VerificationToken" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Country_INSERT" AFTER INSERT ON "Country" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Country_UPDATE" AFTER UPDATE ON "Country" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Country_DELETE" AFTER DELETE ON "Country" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Region_INSERT" AFTER INSERT ON "Region" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Region_UPDATE" AFTER UPDATE ON "Region" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Region_DELETE" AFTER DELETE ON "Region" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CountryTranslation_INSERT" AFTER INSERT ON "CountryTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CountryTranslation_UPDATE" AFTER UPDATE ON "CountryTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CountryTranslation_DELETE" AFTER DELETE ON "CountryTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_RegionTranslation_INSERT" AFTER INSERT ON "RegionTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_RegionTranslation_UPDATE" AFTER UPDATE ON "RegionTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_RegionTranslation_DELETE" AFTER DELETE ON "RegionTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CityTranslation_INSERT" AFTER INSERT ON "CityTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CityTranslation_UPDATE" AFTER UPDATE ON "CityTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CityTranslation_DELETE" AFTER DELETE ON "CityTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_City_INSERT" AFTER INSERT ON "City" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_City_UPDATE" AFTER UPDATE ON "City" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_City_DELETE" AFTER DELETE ON "City" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Category_INSERT" AFTER INSERT ON "Category" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Category_UPDATE" AFTER UPDATE ON "Category" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Category_DELETE" AFTER DELETE ON "Category" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CategoryTranslation_INSERT" AFTER INSERT ON "CategoryTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CategoryTranslation_UPDATE" AFTER UPDATE ON "CategoryTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_CategoryTranslation_DELETE" AFTER DELETE ON "CategoryTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Business_INSERT" AFTER INSERT ON "Business" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Business_UPDATE" AFTER UPDATE ON "Business" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Business_DELETE" AFTER DELETE ON "Business" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_BusinessTranslation_INSERT" AFTER INSERT ON "BusinessTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_BusinessTranslation_UPDATE" AFTER UPDATE ON "BusinessTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_BusinessTranslation_DELETE" AFTER DELETE ON "BusinessTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Location_INSERT" AFTER INSERT ON "Location" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Location_UPDATE" AFTER UPDATE ON "Location" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Location_DELETE" AFTER DELETE ON "Location" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Service_INSERT" AFTER INSERT ON "Service" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Service_UPDATE" AFTER UPDATE ON "Service" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Service_DELETE" AFTER DELETE ON "Service" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Offer_INSERT" AFTER INSERT ON "Offer" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Offer_UPDATE" AFTER UPDATE ON "Offer" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Offer_DELETE" AFTER DELETE ON "Offer" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_BusinessMember_INSERT" AFTER INSERT ON "BusinessMember" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_BusinessMember_UPDATE" AFTER UPDATE ON "BusinessMember" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_BusinessMember_DELETE" AFTER DELETE ON "BusinessMember" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Media_INSERT" AFTER INSERT ON "Media" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Media_UPDATE" AFTER UPDATE ON "Media" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Media_DELETE" AFTER DELETE ON "Media" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Review_INSERT" AFTER INSERT ON "Review" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Review_UPDATE" AFTER UPDATE ON "Review" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Review_DELETE" AFTER DELETE ON "Review" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AuditLog_INSERT" AFTER INSERT ON "AuditLog" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AuditLog_UPDATE" AFTER UPDATE ON "AuditLog" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AuditLog_DELETE" AFTER DELETE ON "AuditLog" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_FeatureFlag_INSERT" AFTER INSERT ON "FeatureFlag" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_FeatureFlag_UPDATE" AFTER UPDATE ON "FeatureFlag" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_FeatureFlag_DELETE" AFTER DELETE ON "FeatureFlag" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Setting_INSERT" AFTER INSERT ON "Setting" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Setting_UPDATE" AFTER UPDATE ON "Setting" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Setting_DELETE" AFTER DELETE ON "Setting" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiConversation_INSERT" AFTER INSERT ON "AiConversation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiConversation_UPDATE" AFTER UPDATE ON "AiConversation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiConversation_DELETE" AFTER DELETE ON "AiConversation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiMessage_INSERT" AFTER INSERT ON "AiMessage" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiMessage_UPDATE" AFTER UPDATE ON "AiMessage" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiMessage_DELETE" AFTER DELETE ON "AiMessage" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiUsageDaily_INSERT" AFTER INSERT ON "AiUsageDaily" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiUsageDaily_UPDATE" AFTER UPDATE ON "AiUsageDaily" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_AiUsageDaily_DELETE" AFTER DELETE ON "AiUsageDaily" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Report_INSERT" AFTER INSERT ON "Report" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Report_UPDATE" AFTER UPDATE ON "Report" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Report_DELETE" AFTER DELETE ON "Report" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_ContactMessage_INSERT" AFTER INSERT ON "ContactMessage" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_ContactMessage_UPDATE" AFTER UPDATE ON "ContactMessage" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_ContactMessage_DELETE" AFTER DELETE ON "ContactMessage" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Page_INSERT" AFTER INSERT ON "Page" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Page_UPDATE" AFTER UPDATE ON "Page" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Page_DELETE" AFTER DELETE ON "Page" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_PageTranslation_INSERT" AFTER INSERT ON "PageTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_PageTranslation_UPDATE" AFTER UPDATE ON "PageTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_PageTranslation_DELETE" AFTER DELETE ON "PageTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Listing_INSERT" AFTER INSERT ON "Listing" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Listing_UPDATE" AFTER UPDATE ON "Listing" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_Listing_DELETE" AFTER DELETE ON "Listing" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_ListingTranslation_INSERT" AFTER INSERT ON "ListingTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_ListingTranslation_UPDATE" AFTER UPDATE ON "ListingTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_ListingTranslation_DELETE" AFTER DELETE ON "ListingTranslation" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_JobDetails_INSERT" AFTER INSERT ON "JobDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_JobDetails_UPDATE" AFTER UPDATE ON "JobDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_JobDetails_DELETE" AFTER DELETE ON "JobDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_EventDetails_INSERT" AFTER INSERT ON "EventDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_EventDetails_UPDATE" AFTER UPDATE ON "EventDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_EventDetails_DELETE" AFTER DELETE ON "EventDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_GuideDetails_INSERT" AFTER INSERT ON "GuideDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_GuideDetails_UPDATE" AFTER UPDATE ON "GuideDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER "_rega_revision_GuideDetails_DELETE" AFTER DELETE ON "GuideDetails" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;
