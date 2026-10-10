-- TRACE-1 (Florin 2026-10-10): every shift and every clocked-hours entry gets a trace number — SH-00123 / HR-00456,
-- per tenant, never reused — so a shift and its hours can be found from each other.
-- ADDITIVE: two nullable columns, one counter table. Existing rows are numbered here, in date order, per tenant
-- (part of introducing the column, not a repair); the counters start after the highest number given.
-- DB first: Florin runs `npx prisma migrate deploy`; the code that writes the numbers follows.

-- AlterTable
ALTER TABLE "ClockEntry" ADD COLUMN "traceNo" TEXT;

-- AlterTable
ALTER TABLE "ScheduledShift" ADD COLUMN "traceNo" TEXT;

-- CreateTable
CREATE TABLE "TraceCounter" (
    "tenantId" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraceCounter_pkey" PRIMARY KEY ("tenantId","series")
);

-- Number the existing shifts: by day, start time, creation (5 digits, wider once past 99999 — never truncated).
UPDATE "ScheduledShift" AS s
SET "traceNo" = 'SH-' || CASE WHEN x.n < 100000 THEN lpad(x.n::text, 5, '0') ELSE x.n::text END
FROM (
    SELECT "id", row_number() OVER (PARTITION BY "tenantId" ORDER BY "shiftDate", "shiftStart", "createdAt", "id") AS n
    FROM "ScheduledShift"
) AS x
WHERE s."id" = x."id";

-- Number the existing hours: by clock-in, creation.
UPDATE "ClockEntry" AS c
SET "traceNo" = 'HR-' || CASE WHEN x.n < 100000 THEN lpad(x.n::text, 5, '0') ELSE x.n::text END
FROM (
    SELECT "id", row_number() OVER (PARTITION BY "tenantId" ORDER BY "clockInTime", "createdAt", "id") AS n
    FROM "ClockEntry"
) AS x
WHERE c."id" = x."id";

-- The counters continue after the numbers given above.
INSERT INTO "TraceCounter" ("tenantId", "series", "value", "updatedAt")
SELECT "tenantId", 'SH', count(*)::int, CURRENT_TIMESTAMP FROM "ScheduledShift" WHERE "tenantId" IN (SELECT "id" FROM "Tenant") GROUP BY "tenantId";

INSERT INTO "TraceCounter" ("tenantId", "series", "value", "updatedAt")
SELECT "tenantId", 'HR', count(*)::int, CURRENT_TIMESTAMP FROM "ClockEntry" WHERE "tenantId" IN (SELECT "id" FROM "Tenant") GROUP BY "tenantId";

-- CreateIndex
CREATE UNIQUE INDEX "ClockEntry_tenantId_traceNo_key" ON "ClockEntry"("tenantId", "traceNo");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledShift_tenantId_traceNo_key" ON "ScheduledShift"("tenantId", "traceNo");

-- AddForeignKey
ALTER TABLE "TraceCounter" ADD CONSTRAINT "TraceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
