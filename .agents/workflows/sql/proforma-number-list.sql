-- PROFORMA-2 · step 1 (READ-ONLY, one statement) — proformas without a number, and the number each will get.
-- Planner 2026-10-06. New proformas are numbered PF-YYYY-NNN by the app ("Nieuwe proforma"). The older ones carry
-- the title "Proforma" (or another text). They get the series in creation order, per business year (Brussels),
-- continuing after the highest PF number already taken that year. Step 2 writes exactly these numbers.
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
SELECT t."companyName" AS tenant, u.id, u.title AS current_title, u."createdAt",
       'PF-' || u.yr || '-' || lpad((coalesce(tk.maxseq, 0) + row_number() OVER (PARTITION BY u."databaseId", u.yr ORDER BY u."createdAt", u.id))::text, 3, '0') AS new_number
FROM unnumbered u
JOIN "GlobalDatabase" d ON d.id = u."databaseId"
JOIN "Tenant" t ON t.id = d."tenantId"
LEFT JOIN taken tk ON tk."databaseId" = u."databaseId" AND tk.yr = u.yr
ORDER BY t."companyName", u."createdAt";
