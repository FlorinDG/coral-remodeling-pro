-- PROFORMA-2 · step 2 (WRITES, one statement) — number the proformas step 1 listed, exactly as listed.
-- Planner 2026-10-06. Run step 1 first: the rows updated must equal step 1's row count. Only the title changes.
WITH unnumbered AS (
  SELECT p.id, p."databaseId", p.properties->>'title' AS title, p."createdAt",
         to_char(p."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Brussels', 'YYYY') AS yr
  FROM "GlobalPage" p
  JOIN "GlobalDatabase" d ON d.id = p."databaseId"
  WHERE d."logicalKey" = 'invoices'
    AND p.properties->>'docType' = 'opt-proforma'
    AND coalesce(p.properties->>'title', '') !~ '^PF-[0-9]{4}-[0-9]+$'
), taken AS (
  SELECT p."databaseId", substring(p.properties->>'title' from 4 for 4) AS yr,
         max((substring(p.properties->>'title' from 9))::int) AS maxseq
  FROM "GlobalPage" p
  WHERE p.properties->>'title' ~ '^PF-[0-9]{4}-[0-9]+$'
  GROUP BY 1, 2
)
, numbered AS (
  SELECT u.id,
         'PF-' || u.yr || '-' || lpad((coalesce(tk.maxseq, 0) + row_number() OVER (PARTITION BY u."databaseId", u.yr ORDER BY u."createdAt", u.id))::text, 3, '0') AS new_number
  FROM unnumbered u
  LEFT JOIN taken tk ON tk."databaseId" = u."databaseId" AND tk.yr = u.yr
)
UPDATE "GlobalPage" p
SET properties = p.properties || jsonb_build_object('title', n.new_number)
FROM numbered n
WHERE p.id = n.id;
