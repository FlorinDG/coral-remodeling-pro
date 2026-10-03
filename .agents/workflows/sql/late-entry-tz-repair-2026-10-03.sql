-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- LATE-TZ-1 · manual ("late") hour entries made before 1 Oct 2026 18:40 landed 2 h late (Florin 2026-10-03: "yes")
-- The phone sent "2026-09-28T09:00" with no zone; the UTC server stored 09:00 UTC = 11:00 in Belgium.
-- Every such entry kept the phone's ORIGINAL TEXT in its approval request (HrApprovalRequest.requestData),
-- so the list is exact: a request whose clockInTime has no zone (no Z, no +hh:mm) is an affected entry.
-- The fix re-reads that typed text as Brussels time (named zone, no offset arithmetic).
-- Run AFTER late-entry-tz-list.sql, with the ids you chose pasted in.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- STEP 2 · CORRECT — filled 2026-10-03 from Florin's list: 11 entries + 1 shift. Skipped: cmrm3n2rd… (out before in — fix by hand), cmuczfbem… (already edited) — one transaction. Paste the ids from late-entry-tz-list.sql.
-- Only untouched entries are changed (an edited one keeps the edit), and a signed work order is never touched.
BEGIN;

WITH req AS (
    SELECT r."tenantId", r."requestData"->>'id' AS entry_id,
           r."requestData"->>'clockInTime'  AS typed_in,
           r."requestData"->>'clockOutTime' AS typed_out
    FROM "HrApprovalRequest" r
    WHERE r."entityType" = 'clock_entry'
      AND r."requestType" IN ('manual_hours', 'late_entry')
      AND r."requestData"->>'clockInTime' !~ '([zZ]|[+-][0-9]{2}:?[0-9]{2})$'
)
UPDATE "ClockEntry" e
SET "clockInTime"  = (req.typed_in::timestamp  AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'UTC',
    "clockOutTime" = (req.typed_out::timestamp AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'UTC',
    "notes"        = concat_ws(E'\n', e."notes", 'LATE-TZ-1: time corrected to what was typed (was 2 h late)'),
    "updatedAt"    = now()
FROM req
WHERE e.id = req.entry_id AND e."tenantId" = req."tenantId"
  AND e.id IN ('cmrm3lx2a0001l4050y9bmp7f','cmrl5u29c0005l4056fp2djg4','cmrm3oblw0001ju04f9tvo7kn','cmrl5sr1g0001l405jqn84b4s','cmrm3przp0005ju04v2eubpdu','cmrnnee4e0005l904knrkbr7t','cmrnne15b0001l9045z5j5smd','cmrtkkyh50001le04reopj6f1','cms6dmi4i0001l1044fq1t6bb','cmulgt4ro0001lc04peg3muq4','cmup68qrx0004jm047fdrlab6')                                              -- ← the ids you chose
  AND e."clockInTime" = req.typed_in::timestamp                       -- untouched only
  AND e."clockOutTime" IS NOT DISTINCT FROM req.typed_out::timestamp
  AND NOT EXISTS (SELECT 1 FROM "AuditLog" a                          -- signed work order = locked
                  WHERE a."entityType" = 'shift' AND a."action" = 'sign' AND a."entityId" = e."shiftId");

-- The shift that the 1 Oct entry created carries the same 2 h shift in its text (10:00–10:45 → 08:00–08:45).
UPDATE "ScheduledShift" SET "shiftStart" = '08:00', "shiftEnd" = '08:45', "updatedAt" = now()
WHERE id = 'cmup68qmk0002jm04kpo56o2y' AND "shiftStart" = '10:00' AND "shiftEnd" = '10:45'
  AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."entityType" = 'shift' AND a."action" = 'sign' AND a."entityId" = 'cmup68qmk0002jm04kpo56o2y');

-- Check before committing: the corrected rows now show the typed time.
SELECT e.id,
       to_char((e."clockInTime"  AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI') AS shown_in,
       to_char((e."clockOutTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI') AS shown_out
FROM "ClockEntry" e WHERE e.id IN ('cmrm3lx2a0001l4050y9bmp7f','cmrl5u29c0005l4056fp2djg4','cmrm3oblw0001ju04f9tvo7kn','cmrl5sr1g0001l405jqn84b4s','cmrm3przp0005ju04v2eubpdu','cmrnnee4e0005l904knrkbr7t','cmrnne15b0001l9045z5j5smd','cmrtkkyh50001le04reopj6f1','cms6dmi4i0001l1044fq1t6bb','cmulgt4ro0001lc04peg3muq4','cmup68qrx0004jm047fdrlab6');

COMMIT;   -- or ROLLBACK; if anything looks wrong
