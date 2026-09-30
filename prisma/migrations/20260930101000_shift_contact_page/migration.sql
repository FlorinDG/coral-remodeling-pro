-- AlterTable
ALTER TABLE "ScheduledShift" ADD COLUMN     "contactPageId" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledShift_contactPageId_idx" ON "ScheduledShift"("contactPageId");

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_contactPageId_fkey" FOREIGN KEY ("contactPageId") REFERENCES "GlobalPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

