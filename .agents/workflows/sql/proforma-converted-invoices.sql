-- PROFORMA-1 · invoices that were proformas converted IN PLACE (the old type switch) — READ-ONLY, ONE statement.
-- Planner 2026-10-06. Florin: "it is turned into an invoice, but not assigned a number, so the filters obfuscate it".
-- The switch only fetched a number when the title was still exactly "Proforma"; a renamed proforma became an invoice
-- without one. Lists every invoice-type record whose title is not a number of the tenant's invoice series
-- (no digit at all, or "Proforma"), and every record still carrying "Proforma" in its title with another type.
-- Nothing is changed: per row, Florin decides (give it a number by hand, or set it back to a proforma).
SELECT
  t."companyName"                         AS tenant,
  p.id                                    AS page_id,
  p.properties->>'title'                  AS title,
  p.properties->>'docType'                AS doc_type,
  p.properties->>'status'                 AS status,
  p.properties->>'totalIncVat'            AS total_inc_vat,
  p."updatedAt"                           AS updated_at,
  CASE
    WHEN coalesce(p.properties->>'title', '') = ''                      THEN 'NO_TITLE'
    WHEN p.properties->>'title' ILIKE '%proforma%'
     AND coalesce(p.properties->>'docType', 'opt-invoice') <> 'opt-proforma' THEN 'PROFORMA_TITLE_ON_' || coalesce(p.properties->>'docType', 'opt-invoice')
    WHEN p.properties->>'title' !~ '[0-9]'                              THEN 'NO_NUMBER'
  END                                     AS flag
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
JOIN "Tenant" t ON t.id = d."tenantId"
WHERE d."logicalKey" = 'invoices'
  AND coalesce(p.properties->>'docType', 'opt-invoice') IN ('opt-invoice', 'opt-credit-note')
  AND (
        coalesce(p.properties->>'title', '') = ''
     OR p.properties->>'title' ILIKE '%proforma%'
     OR p.properties->>'title' !~ '[0-9]'
  )
ORDER BY t."companyName", p."updatedAt" DESC;
