-- R1-2 · BINDING CENSUS — READ ONLY, safe on production. Run in the Neon SQL editor.
-- Question: when getLockedDbId's guessing is replaced by a FAIL-CLOSED lookup, which tenant reads
-- a system database whose key is MISSING from Tenant.lockedDbIds? Every such row would start
-- throwing (loudly, by design) instead of silently guessing. This must be ZERO before R1-2 ships,
-- or each row gets a provisioning repair first.
--
-- For every tenant × system role (kernel/system-databases.ts SYSTEM_DATABASE_ROLES):
--   bound_id      what lockedDbIds says (forward binding)
--   reverse_id    which GlobalDatabase of this tenant carries logicalKey = role (reverse binding)
--   verdict       OK · MISSING_BINDING · MISMATCH · DANGLING (bound id is not a db of this tenant)

WITH roles(role, legacy_base) AS (
  VALUES ('invoices','db-invoices'),('clients','db-clients'),('suppliers','db-suppliers'),
         ('expenses','db-expenses'),('tickets','db-tickets'),('quotations','db-quotations'),
         ('payments-in','db-payments-in'),('payments-out','db-payments-out'),('projects','db-1'),
         ('tasks','db-tasks'),('articles','db-articles'),('crm','db-crm'),('bobex','db-bobex'),
         ('bestek','db-bestek'),('journal-general','db-journal-general'),('hr','db-hr')
),
grid AS (
  SELECT t.id AS tenant_id, t."companyName" AS tenant, r.role, r.legacy_base,
         t."lockedDbIds" ->> r.role AS bound_id,
         (SELECT d.id FROM "GlobalDatabase" d WHERE d."tenantId" = t.id AND d."logicalKey" = r.role) AS reverse_id,
         EXISTS (SELECT 1 FROM "GlobalDatabase" d WHERE d."tenantId" = t.id AND d.id = (t."lockedDbIds" ->> r.role)) AS bound_is_ours,
         EXISTS (SELECT 1 FROM "GlobalDatabase" d WHERE d.id = r.legacy_base AND d."tenantId" = t.id) AS owns_bare_legacy_id
  FROM "Tenant" t CROSS JOIN roles r
)
SELECT tenant, tenant_id, role, bound_id, reverse_id, owns_bare_legacy_id,
       CASE
         WHEN bound_id IS NULL AND reverse_id IS NULL AND NOT owns_bare_legacy_id THEN 'NOT PROVISIONED (never had it)'
         WHEN bound_id IS NULL                      THEN '🔴 MISSING_BINDING (would throw)'
         WHEN NOT bound_is_ours                     THEN '🔴 DANGLING (bound id not a db of this tenant)'
         WHEN reverse_id IS DISTINCT FROM bound_id  THEN '🟨 MISMATCH (forward ≠ reverse)'
         ELSE 'OK'
       END AS verdict
FROM grid
ORDER BY tenant, verdict DESC, role;

-- Headline only:
-- SELECT verdict, count(*) FROM (…the query above…) x GROUP BY verdict;
