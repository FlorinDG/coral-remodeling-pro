-- LIB-SUB-1 · quotes / invoices whose lines carry an empty "subcomponent" (READ ONLY). Planner 2026-10-08.
-- Cause (fixed): opening a library record saved an empty paragraph into its body; inserting that article copied the
-- body into the line as children. A line with children takes its price from them — such a line may show €0.
-- Fix by hand in the editor: delete the empty subcomponent on the listed documents (or remove + re-insert the line).
SELECT d."tenantId", d."logicalKey", p.id, p.properties->>'title' AS title, p."updatedAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
WHERE d."logicalKey" IN ('quotations', 'invoices')
  AND jsonb_path_exists(p.blocks, '$.**.children[*] ? (@.type == "paragraph")')
ORDER BY d."tenantId", p."updatedAt" DESC;
