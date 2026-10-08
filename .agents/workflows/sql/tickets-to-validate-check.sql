-- SYNC-STUCK-1 · are the scanned tickets in "Te valideren" empty ON THE SERVER, or only on screen? (READ ONLY)
-- Planner 2026-10-08. Florin: "second time that updates reset scanned items in to validate. some tickets lost vat
-- category and price". Lists the tickets waiting for validation, newest first, with what the SERVER holds.
-- amount / category filled here but empty on screen → the screen showed a stale browser copy (fixed: SYNC-STUCK-1).
-- Empty here too → something overwrote them; updatedAt / lastEditedBy say when and by whom.
SELECT p.id,
       p.properties->>'title'            AS merchant,
       p.properties->>'date'             AS date,
       p.properties->>'amount'           AS amount,
       p.properties->>'category'         AS category,
       p.properties->>'vatDeductiblePct' AS vat_deductible_pct,
       p.properties->>'reviewStatus'     AS review_status,
       p.properties->>'source'           AS source,
       p."createdAt", p."updatedAt", p."lastEditedBy"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
WHERE d."logicalKey" = 'tickets'
  AND coalesce(p.properties->>'reviewStatus', '') NOT IN ('', 'Goedgekeurd')
ORDER BY p."createdAt" DESC
LIMIT 50;
