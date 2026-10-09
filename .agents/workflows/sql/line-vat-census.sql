-- DOC-LINES-2 · quotes / invoices whose lines already carry their own VAT rate (READ ONLY). Planner 2026-10-09.
-- Up to now a line's rate was ignored: the document's regime counted for every line. With mixed rates (Florin
-- 2026-10-09) a line's own rate COUNTS. A document listed here with a line rate that differs from its regime would
-- change its VAT. Set by: PDF import, the mobile quick invoice.
-- line_rates = the distinct rates on its lines; regime = the document's rate.
SELECT d."tenantId", d."logicalKey", p.id, p.properties->>'title' AS title,
       COALESCE(p.properties->>'vatRegime', '21') AS regime,
       (SELECT string_agg(DISTINCT r::text, ', ') FROM jsonb_path_query(p.blocks, 'lax $.**.vatRate') AS r) AS line_rates,
       jsonb_path_exists(p.blocks, 'lax $.** ? (@.vatMedecontractant == true)') AS line_reverse_charge,
       p."updatedAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
WHERE d."logicalKey" IN ('quotations', 'invoices')
  AND (jsonb_path_exists(p.blocks, 'lax $.**.vatRate') OR jsonb_path_exists(p.blocks, 'lax $.** ? (@.vatMedecontractant == true)'))
ORDER BY d."tenantId", p."updatedAt" DESC;
