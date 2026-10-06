-- PROFORMA-2 · step 3 (WRITES, one statement) — the invoice ledger row of each proforma carries its new number.
-- Planner 2026-10-06. Run after step 2. A proforma's ledger row has the same id as its record.
UPDATE "Invoice" i
SET "invoiceNumber" = p.properties->>'title'
FROM "GlobalPage" p
WHERE p.id = i.id
  AND p.properties->>'docType' = 'opt-proforma'
  AND p.properties->>'title' ~ '^PF-[0-9]{4}-[0-9]+$'
  AND i."invoiceNumber" IS DISTINCT FROM p.properties->>'title';
