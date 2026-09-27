-- AlterTable
ALTER TABLE "GlobalDatabase" ADD COLUMN "logicalKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GlobalDatabase_tenantId_logicalKey_key" ON "GlobalDatabase"("tenantId", "logicalKey");

-- Backfill GlobalDatabase.logicalKey from Tenant.lockedDbIds (never from id text)
UPDATE "GlobalDatabase" gd
SET "logicalKey" = kv.key
FROM "Tenant" t,
LATERAL jsonb_each_text(t."lockedDbIds") AS kv(key, value)
WHERE gd."tenantId" = t.id
  AND gd.id = kv.value
  AND gd."logicalKey" IS NULL;
