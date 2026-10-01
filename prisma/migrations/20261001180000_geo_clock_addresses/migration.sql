-- GEO-1 · additive (pd.md 5e: DB first, code second)
-- where the clock-in / clock-out happened, as a street address (reverse-geocoded once, server-side);
-- the raw latitude/longitude stay as the evidence
ALTER TABLE "ClockEntry" ADD COLUMN "clockInAddress" TEXT;
ALTER TABLE "ClockEntry" ADD COLUMN "clockOutAddress" TEXT;
-- distance in metres from the work site at that moment (recorded, never blocking)
ALTER TABLE "ClockEntry" ADD COLUMN "clockInDistanceM" INTEGER;
ALTER TABLE "ClockEntry" ADD COLUMN "clockOutDistanceM" INTEGER;
-- the work site's coordinates (geocoded from siteAddress, else the project address) and the exact
-- address text they were geocoded from — a changed address is geocoded again
ALTER TABLE "ScheduledShift" ADD COLUMN "siteLat" DOUBLE PRECISION;
ALTER TABLE "ScheduledShift" ADD COLUMN "siteLng" DOUBLE PRECISION;
ALTER TABLE "ScheduledShift" ADD COLUMN "siteGeocodedFrom" TEXT;
