-- QUOTE-FILE-1 · step 1 (READ-ONLY, one statement) — sent / accepted / rejected quotes without the `sentAt` stamp.
-- Planner 2026-10-06. Florin: "should be able to edit status on sent quotes. does not affect the document just my
-- shelving strategy". A quote now stays locked by its `sentAt` stamp (written when it is sent), so its status is
-- free. Quotes sent BEFORE the stamp existed carry only the status; until they get the stamp, the door refuses to
-- move them out of sent / accepted / rejected. This lists them; step 2 stamps them.
SELECT t."companyName" AS tenant, p.id, p.properties->>'title' AS title, p.properties->>'status' AS status, p."updatedAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
JOIN "Tenant" t ON t.id = d."tenantId"
WHERE d."logicalKey" = 'quotations'
  AND p.properties->>'status' IN ('opt-sent', 'opt-accepted', 'opt-rejected', 'SENT', 'ACCEPTED', 'REJECTED', 'DECLINED')
  AND coalesce(p.properties->>'sentAt', '') = ''
ORDER BY t."companyName", p."updatedAt" DESC;
