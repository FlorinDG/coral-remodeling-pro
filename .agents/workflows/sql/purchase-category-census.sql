-- EDIT-1 · which CATEGORY values purchase invoices and tickets carry, and whether their own schema knows them
-- (READ-ONLY, one statement). Planner 2026-10-07. Florin: "conciliate between the db properties and the modal options".
-- Until today the editor offered the 12-category taxonomy (cat-1 … cat-12) while the purchase-invoice SCHEMA listed 5
-- other categories (cat-materials, cat-services, …), and the ticket capture offered the purchase taxonomy to tickets
-- (whose schema lists cat-fuel, cat-restaurant, …). The schema now carries the taxonomy (upgrade U2) and every screen
-- reads the record's own schema. This shows the values already stored: `known_in_schema = false` rows need a decision
-- (map to which category) — paste the result to the Planner; nothing is changed here.
SELECT
  d."logicalKey"                                   AS db_role,
  p.properties->>'category'                        AS category_value,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(d.properties) prop, jsonb_array_elements(prop->'config'->'options') opt
    WHERE prop->>'id' = 'category' AND opt->>'id' = p.properties->>'category'
  )                                                AS known_in_schema,
  count(*)                                         AS records
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
WHERE d."logicalKey" IN ('expenses', 'tickets')
  AND coalesce(p.properties->>'category', '') <> ''
GROUP BY 1, 2, 3
ORDER BY 1, 3, 4 DESC;
