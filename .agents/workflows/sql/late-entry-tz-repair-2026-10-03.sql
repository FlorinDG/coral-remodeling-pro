-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- LATE-TZ-1 · repair, filled 2026-10-03 from Florin's list: 11 entries + 1 shift.
-- ONE statement (the Neon editor fails on BEGIN/COMMIT scripts). One statement is atomic on its own:
-- all of it applies, or none of it. Safe to run twice: the second run finds nothing to change
-- (only entries still holding the 2 h late value are touched).
-- Skipped: cmrm3n2rd… (out before in — fix by hand), cmuczfbem… (already edited).
-- The result lists what changed, as the app will now show it (Brussels).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
WITH req AS (
    SELECT r."tenantId", r."requestData"->>'id' AS entry_id,
           r."requestData"->>'clockInTime'  AS typed_in,
           r."requestData"->>'clockOutTime' AS typed_out
    FROM "HrApprovalRequest" r
    WHERE r."entityType" = 'clock_entry'
      AND r."requestType" IN ('manual_hours', 'late_entry')
      AND r."requestData"->>'clockInTime' !~ '([zZ]|[+-][0-9]{2}:?[0-9]{2})$'
),
fixed AS (
    UPDATE "ClockEntry" e
    SET "clockInTime"  = (req.typed_in::timestamp  AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'UTC',
        "clockOutTime" = (req.typed_out::timestamp AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'UTC',
        "notes"        = concat_ws(E'\n', e."notes", 'LATE-TZ-1: time corrected to what was typed (was 2 h late)'),
        "updatedAt"    = now()
    FROM req
    WHERE e.id = req.entry_id AND e."tenantId" = req."tenantId"
      AND e.id IN ('cmrm3lx2a0001l4050y9bmp7f','cmrl5u29c0005l4056fp2djg4','cmrm3oblw0001ju04f9tvo7kn',
                   'cmrl5sr1g0001l405jqn84b4s','cmrm3przp0005ju04v2eubpdu','cmrnnee4e0005l904knrkbr7t',
                   'cmrnne15b0001l9045z5j5smd','cmrtkkyh50001le04reopj6f1','cms6dmi4i0001l1044fq1t6bb',
                   'cmulgt4ro0001lc04peg3muq4','cmup68qrx0004jm047fdrlab6')
      AND e."clockInTime" = req.typed_in::timestamp                       -- untouched only
      AND e."clockOutTime" IS NOT DISTINCT FROM req.typed_out::timestamp
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" a                          -- signed work order = locked
                      WHERE a."entityType" = 'shift' AND a."action" = 'sign' AND a."entityId" = e."shiftId")
    RETURNING e.id, e."clockInTime", e."clockOutTime"
),
shift AS (
    -- the shift the 1 Oct entry created carries the same 2 h in its text: 10:00–10:45 → 08:00–08:45
    UPDATE "ScheduledShift" s SET "shiftStart" = '08:00', "shiftEnd" = '08:45', "updatedAt" = now()
    WHERE s.id = 'cmup68qmk0002jm04kpo56o2y' AND s."shiftStart" = '10:00' AND s."shiftEnd" = '10:45'
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" a
                      WHERE a."entityType" = 'shift' AND a."action" = 'sign' AND a."entityId" = s.id)
    RETURNING s.id, s."shiftDate", s."shiftStart", s."shiftEnd"
)
SELECT 'entry' AS what, id,
       to_char((("clockInTime"  AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels'), 'DD/MM/YYYY HH24:MI') AS now_in,
       to_char((("clockOutTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels'), 'DD/MM/YYYY HH24:MI') AS now_out
FROM fixed
UNION ALL
SELECT 'shift', id, "shiftDate" || ' ' || "shiftStart", "shiftDate" || ' ' || "shiftEnd" FROM shift
ORDER BY what, now_in;
