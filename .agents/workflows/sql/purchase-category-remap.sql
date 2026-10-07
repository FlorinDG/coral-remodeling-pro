-- EDIT-1 · the 12 purchase invoices still carrying a category of the OLD 5-option list → the taxonomy (WRITES, one
-- statement). Planner 2026-10-07, after purchase-category-census.sql (Florin's result: cat-services 5, cat-materials 4,
-- cat-subcontractor 2, cat-equipment 1). Mapping (adjust before running if the accountant prefers otherwise):
--   cat-services       Diensten en diverse leveringen → cat-6 Algemene kosten
--   cat-materials      Aankoop materialen             → cat-3 (Handels)goederen
--   cat-subcontractor  Onderaannemers                 → cat-2 Onderaannemingen
--   cat-equipment      Gereedschap & Uitrusting       → cat-1 Investeringen
-- Only `category` changes; rows updated must be 12. Re-run purchase-category-census.sql after: no `false` left.
UPDATE "GlobalPage" p
SET properties = p.properties || jsonb_build_object('category', CASE p.properties->>'category'
        WHEN 'cat-services'      THEN 'cat-6'
        WHEN 'cat-materials'     THEN 'cat-3'
        WHEN 'cat-subcontractor' THEN 'cat-2'
        WHEN 'cat-equipment'     THEN 'cat-1'
    END)
FROM "GlobalDatabase" d
WHERE d.id = p."databaseId"
  AND d."logicalKey" = 'expenses'
  AND p.properties->>'category' IN ('cat-services', 'cat-materials', 'cat-subcontractor', 'cat-equipment');
