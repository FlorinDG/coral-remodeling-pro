-- AlterTable
ALTER TABLE "ScheduledShift" ADD COLUMN     "seriesId" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledShift_seriesId_idx" ON "ScheduledShift"("seriesId");
