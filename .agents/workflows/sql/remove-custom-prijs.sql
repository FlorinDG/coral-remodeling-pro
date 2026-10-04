-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Remove the "Custom prijs" column from the articles database (Florin 2026-10-03: "remove. has no purpose").
-- A column the tenant added — not in the canonical schema, read by no engine. Nothing in the code to change first.
-- Two queries, run ONE AT A TIME in the Neon editor (select one, run it). Query 1 changes nothing.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- QUERY 1 · PREVIEW — the column, in which tenant, and how many articles hold a value in it.
SELECT d."tenantId", d.id AS database_id, e->>'id' AS property_id, e->>'name' AS name, e->>'type' AS type,
       (SELECT count(*) FROM "GlobalPage" p
         WHERE p."databaseId" = d.id
           AND p.properties ? (e->>'id')
           AND p.properties->>(e->>'id') IS NOT NULL
           AND p.properties->>(e->>'id') NOT IN ('', '0')) AS articles_with_a_value
FROM "GlobalDatabase" d, jsonb_array_elements(d.properties::jsonb) e
WHERE d."logicalKey" = 'articles' AND lower(trim(e->>'name')) = 'custom prijs';
-- Expect one row per tenant that has it. If articles_with_a_value is not 0, look before removing.


-- QUERY 2 · REMOVE — one statement (all or nothing): the column from the schema, and its value from every article.
WITH col AS (
    SELECT d.id AS database_id, e->>'id' AS property_id
    FROM "GlobalDatabase" d, jsonb_array_elements(d.properties::jsonb) e
    WHERE d."logicalKey" = 'articles' AND lower(trim(e->>'name')) = 'custom prijs'
),
schema AS (
    UPDATE "GlobalDatabase" d
    SET properties = (SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb)
                      FROM jsonb_array_elements(d.properties::jsonb) WITH ORDINALITY t(e, ord)
                      WHERE e->>'id' NOT IN (SELECT property_id FROM col WHERE database_id = d.id)),
        "updatedAt" = now()
    WHERE d.id IN (SELECT database_id FROM col)
    RETURNING d.id
),
pages AS (
    UPDATE "GlobalPage" p
    SET properties = p.properties::jsonb - col.property_id
    FROM col
    WHERE p."databaseId" = col.database_id AND p.properties ? col.property_id
    RETURNING p.id
)
SELECT (SELECT count(*) FROM schema) AS databases_changed, (SELECT count(*) FROM pages) AS articles_cleaned;
-- Then reload the app (the browser keeps the old schema until the next load).
