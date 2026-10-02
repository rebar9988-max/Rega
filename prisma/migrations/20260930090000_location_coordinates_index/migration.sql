-- Nearby Discovery: bounding-box pre-filter on coordinates. Additive only (no data change).
CREATE INDEX "Location_latitude_longitude_idx" ON "Location"("latitude", "longitude");
