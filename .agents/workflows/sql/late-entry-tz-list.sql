-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- LATE-TZ-1 · manual ("late") hour entries made before 1 Oct 2026 18:40 landed 2 h late (Florin 2026-10-03: "yes")
-- The phone sent "2026-09-28T09:00" with no zone; the UTC server stored 09:00 UTC = 11:00 in Belgium.
-- Every such entry kept the phone's ORIGINAL TEXT in its approval request (HrApprovalRequest.requestData),
-- so the list is exact: a request whose clockInTime has no zone (no Z, no +hh:mm) is an affected entry.
-- The fix re-reads that typed text as Brussels time (named zone, no offset arithmetic).
-- Run in the Neon SQL editor: ONE statement, read-only. The correction is in late-entry-tz-repair.sql.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- STEP 1 · THE LIST — one row per affected entry. Decide per row; note the ids you want corrected.
--   shown_now_*  : what the app shows today (Brussels)        typed_*   : what the worker typed
--   untouched    : the entry still holds exactly what was stored (false = someone edited it since → leave it)
--   approved / invoiced / exported : already used downstream — correcting changes those numbers
WITH req AS (
    SELECT r."tenantId", r."requestData"->>'id' AS entry_id,
           r."requestData"->>'clockInTime'  AS typed_in,
           r."requestData"->>'clockOutTime' AS typed_out
    FROM "HrApprovalRequest" r
    WHERE r."entityType" = 'clock_entry'
      AND r."requestType" IN ('manual_hours', 'late_entry')
      AND r."requestData"->>'clockInTime' !~ '([zZ]|[+-][0-9]{2}:?[0-9]{2})$'
)
SELECT e.id,
       t."companyName"                                                AS tenant,
       u.name                                                         AS worker,
       req.typed_in, req.typed_out,
       to_char((e."clockInTime"  AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI') AS shown_now_in,
       to_char((e."clockOutTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI') AS shown_now_out,
       (e."clockInTime" = req.typed_in::timestamp AND e."clockOutTime" IS NOT DISTINCT FROM req.typed_out::timestamp) AS untouched,
       e."approvalStatus"                                             AS approved,
       e."invoicedAt" IS NOT NULL                                     AS invoiced,
       e."accountantExportedAt" IS NOT NULL                           AS exported,
       e."shiftId",
       s."shiftDate" || ' ' || s."shiftStart" || '–' || s."shiftEnd"   AS shift_text
FROM req
JOIN "ClockEntry" e ON e.id = req.entry_id AND e."tenantId" = req."tenantId"
JOIN "Tenant" t     ON t.id = e."tenantId"
LEFT JOIN "User" u  ON u.id = e."userId"
LEFT JOIN "ScheduledShift" s ON s.id = e."shiftId"
ORDER BY t."companyName", e."clockInTime";
-- Expect: every untouched row shows the typed time + 2 h (summer). An entry whose out is before its in
-- (night work typed on one date) is listed too — correct it by hand in the app, not here.
