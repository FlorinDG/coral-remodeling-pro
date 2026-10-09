-- PEPPOL-CN-1 · credit notes that went to Peppol (READ ONLY). Planner 2026-10-09.
-- Cause (fixed): the send read a property 'isCreditNote' that nothing writes, so a credit note (docType opt-credit-note)
-- was sent with document_type INVOICE. Every row here reached the customer as an INVOICE, not a credit note.
-- What to do per row is an accounting decision (Florin / the accountant), not a repair feature.
SELECT p.id, d."tenantId", p.properties->>'title' AS title, i."peppolDocumentId", i."peppolState", p."updatedAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
JOIN "Invoice" i ON i.id = p.id
WHERE d."logicalKey" = 'invoices'
  AND p.properties->>'docType' = 'opt-credit-note'
  AND i."peppolDocumentId" IS NOT NULL
ORDER BY p."updatedAt" DESC;
