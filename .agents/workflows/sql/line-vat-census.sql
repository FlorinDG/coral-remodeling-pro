-- DOC-LINES-2 · quotes / invoices whose lines already carry their own VAT rate (READ ONLY). Planner 2026-10-09.
-- Run 2026-10-09: 29 documents carry a legacy line `vatRate` that never counted (e.g. regime 21, lines at 6) — left
-- by old screens, imports, the mobile quick invoice and timesheet invoicing. Florin: "VAT has to have a default, and
-- it must be the set regime for the lines. and manually edited if the case presents itself". So the rate set BY HAND
-- is a new field, `vatRateOverride`; the legacy `vatRate` stays ignored and no issued document changes.
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
