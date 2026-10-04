-- WO-2 · additive (pd.md 5e: DB first, code second)
-- execution address when the work happens elsewhere than the project address
ALTER TABLE "ScheduledShift" ADD COLUMN "siteAddress" TEXT;
-- the Materials tab is shown only for shifts where the scheduler enabled it
ALTER TABLE "ScheduledShift" ADD COLUMN "materialsEnabled" BOOLEAN NOT NULL DEFAULT false;
-- the crew member's note on the work order (office notes stay in "notes")
ALTER TABLE "ScheduledShift" ADD COLUMN "crewNote" TEXT;
