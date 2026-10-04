-- TS-ARCH-1 · additive (pd.md 5e: DB first, code second)
-- archived hours stay stored and counted where they belong, but leave the default Timesheets view;
-- always restorable
ALTER TABLE "ClockEntry" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ClockEntry" ADD COLUMN "archivedBy" TEXT;
