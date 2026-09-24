-- AddForeignKey
ALTER TABLE "ShiftTask" ADD CONSTRAINT "ShiftTask_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ScheduledShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAttachment" ADD CONSTRAINT "ShiftAttachment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ScheduledShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
