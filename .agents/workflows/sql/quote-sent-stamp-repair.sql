-- QUOTE-FILE-1 · step 2 (WRITES, one statement) — stamp `sentAt` on the quotes step 1 listed.
-- Planner 2026-10-06. Run step 1 first; the number of rows updated must equal step 1's row count.
-- The exact sending moment was never recorded: the stamp takes the record's last change (`updatedAt`) — for a sent
-- quote that is the sending or a later acceptance; it only has to EXIST (it keeps the quote locked), and it is
-- marked approximate (`sentAtApprox: true`) so nobody reads it as the sending time.
UPDATE "GlobalPage" p
SET properties = p.properties
    || jsonb_build_object('sentAt', to_char(p."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'sentAtApprox', true)
FROM "GlobalDatabase" d
WHERE d.id = p."databaseId"
  AND d."logicalKey" = 'quotations'
  AND p.properties->>'status' IN ('opt-sent', 'opt-accepted', 'opt-rejected', 'SENT', 'ACCEPTED', 'REJECTED', 'DECLINED')
  AND coalesce(p.properties->>'sentAt', '') = '';
