-- SCAN-1 · records saved from an EMPTY reading (READ-ONLY, one statement). Planner 2026-10-06.
-- Florin: "all the receipts that are named expense and there is just a simple blob link". When the reader's answer
-- could not be parsed, the scan saved the record anyway: title "Expense", amount 0, and the SCAN day as its date
-- (not the receipt's). Fixed in code (an empty reading is now a failed reading). This lists the records it left:
-- their date and amount were never read. The file (receipt_url) is intact — it is what must be read again.
SELECT
  t."companyName"                          AS tenant,
  d."logicalKey"                           AS db_role,
  p.id                                     AS page_id,
  p.properties->>'title'                   AS title,
  p.properties->>'date'                    AS date_written_by_scan,
  p.properties->>'amount'                  AS amount,
  p.properties->>'reviewStatus'            AS review,
  p.properties->>'receiptUrl'              AS receipt_url,
  lower(substring(p.properties->>'receiptUrl' from '\.([A-Za-z0-9]+)$')) AS file_type,
  p."createdAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
JOIN "Tenant" t ON t.id = d."tenantId"
WHERE d."logicalKey" IN ('tickets', 'expenses')
  AND p.properties->>'title' IN ('Expense', 'expense')
  AND coalesce(p.properties->>'source', '') = 'src-scan'
ORDER BY t."companyName", p."createdAt" DESC;
