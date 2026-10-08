-- LEAVE-1 · remove leave stored as shifts (WRITES, one statement). Planner 2026-10-08.
-- Run ONLY after leave-shifts-list.sql and after re-entering those absences as Verlof in the scheduler.
-- Clock entries, tasks or attachments on such a row would block nothing here: a leave row never had any — the
-- guard below keeps any row that does.
DELETE FROM "ScheduledShift" s
WHERE lower(s.status) = 'leave'
  AND NOT EXISTS (SELECT 1 FROM "ClockEntry" c WHERE c."shiftId" = s.id)
  AND NOT EXISTS (SELECT 1 FROM "ShiftTask" t WHERE t."shiftId" = s.id)
  AND NOT EXISTS (SELECT 1 FROM "ShiftAttachment" a WHERE a."shiftId" = s.id);
