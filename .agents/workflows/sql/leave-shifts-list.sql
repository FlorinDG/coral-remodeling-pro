-- LEAVE-1 · shifts that are really leave (READ ONLY). Planner 2026-10-08.
-- Since SCH-1 the scheduler wrote leave as a TimeOffRequest; rows older than that may still be ScheduledShift rows
-- with status 'leave'. The screens no longer show them as anything (a shift's status can no longer be 'leave').
-- If this returns rows: re-enter those absences in the scheduler (Verlof) and delete the rows with
-- leave-shifts-delete.sql — Florin: delete + re-enter over a conversion feature.
SELECT s."tenantId", s.id, s."userId", s."shiftDate", s."shiftName", s.notes, s."createdAt"
FROM "ScheduledShift" s
WHERE lower(s.status) = 'leave'
ORDER BY s."tenantId", s."userId", s."shiftDate";
