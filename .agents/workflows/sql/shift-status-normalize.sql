-- SCHED-STATUS-1 · stored shift statuses onto the kernel's four (WRITES, one statement). Planner 2026-10-08.
-- The screens already READ legacy spellings correctly (storedStatus); this makes the stored value canonical so
-- reports and filters see one vocabulary. 'leave' rows are NOT touched here — see leave-shifts-to-time-off.sql.
-- 'Active' / 'In Progress' / 'in-progress' become 'scheduled': being in progress is now read from the open clock entry.
-- Preview first: shift-status-census.sql
UPDATE "ScheduledShift"
SET status = CASE
        WHEN lower(status) = 'completed' THEN 'completed'
        WHEN lower(status) IN ('cancelled', 'canceled') THEN 'cancelled'
        WHEN lower(status) = 'late' THEN 'late'
        ELSE 'scheduled'
    END
WHERE status NOT IN ('scheduled', 'late', 'completed', 'cancelled')
  AND lower(status) <> 'leave';
