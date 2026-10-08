-- SYNC-BLIND-1 · the ticket values BEFORE they were overwritten (READ ONLY — run on a Neon BRANCH, not on production).
-- Planner 2026-10-09. 25 tickets created on 2026-10-05 were rewritten 2026-10-08 20:59–21:29 UTC to amount 0 /
-- category '' by a stale browser copy (fixed in code: SYNC-BLIND-1). Nothing in the app keeps old values; Neon's
-- point-in-time history does, if its retention reaches back that far.
-- 1. Neon console → Branches → Create branch → "Point in time": 2026-10-08 20:58:00 UTC (22:58 Brussels).
-- 2. Run THIS on that branch. Paste the result to the Planner → an UPDATE for production is written from it.
SELECT p.id,
       p.properties->>'title'            AS merchant,
       p.properties->>'date'             AS date,
       p.properties->>'amount'           AS amount,
       p.properties->>'category'         AS category,
       p.properties->>'vatDeductiblePct' AS vat_deductible_pct,
       p.properties->>'paymentMethod'    AS payment_method,
       p."updatedAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
WHERE d."logicalKey" = 'tickets'
  AND p."createdAt" >= '2026-10-05' AND p."createdAt" < '2026-10-06'
ORDER BY p."createdAt";
