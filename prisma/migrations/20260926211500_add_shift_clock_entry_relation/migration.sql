-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClockEntry_shiftId_idx" ON "ClockEntry"("shiftId");

-- AddForeignKey
ALTER TABLE "ClockEntry" ADD CONSTRAINT "ClockEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ScheduledShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
