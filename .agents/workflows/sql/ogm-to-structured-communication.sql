-- OGM-1 · purchase documents: the structured communication into the SCHEMA's field (WRITES, one statement).
-- Planner 2026-10-07. Florin: the import "did not import the structured communication". The kernel field is
-- `structuredCommunication`; Peppol, the scan modal and the editor wrote `ogm` (a field the schema does not have — the
-- grid column stayed empty). The code writes the schema's field now; this moves what is stored under `ogm` into it
-- (never overwriting a filled one) and removes the old key. Purchase invoices / tickets only.
-- Preview first: SELECT count(*) FROM "GlobalPage" p JOIN "GlobalDatabase" d ON d.id = p."databaseId"
--                WHERE d."logicalKey" IN ('expenses','tickets') AND coalesce(p.properties->>'ogm','') <> '';
UPDATE "GlobalPage" p
SET properties = (p.properties - 'ogm')
    || CASE WHEN coalesce(p.properties->>'structuredCommunication', '') = ''
            THEN jsonb_build_object('structuredCommunication', p.properties->>'ogm')
            ELSE '{}'::jsonb END
FROM "GlobalDatabase" d
WHERE d.id = p."databaseId"
  AND d."logicalKey" IN ('expenses', 'tickets')
  AND p.properties ? 'ogm';
