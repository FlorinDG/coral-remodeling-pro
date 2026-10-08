-- SCHED-STATUS-1 / LEAVE-1 · census (READ ONLY). Planner 2026-10-08.
-- The kernel's stored shift statuses are: scheduled · late · completed · cancelled (lib/kernel/shift-status.ts).
-- 'In progress' and 'late' are derived from clock entries; leave is a TimeOffRequest, never a shift.
-- Everything else below is a legacy spelling (the old selects wrote 'Scheduled', 'Active', 'In Progress' …;
-- HRA-2 wrote 'in-progress' on clock-in) or a pre-SCH-1 leave row. Per tenant.
SELECT "tenantId", status, count(*) AS shifts
FROM "ScheduledShift"
GROUP BY "tenantId", status
ORDER BY "tenantId", shifts DESC;
