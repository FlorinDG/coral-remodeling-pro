-- Add seriesId column to ScheduledShift
ALTER TABLE "ScheduledShift" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
