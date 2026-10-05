-- DB-SCHEMA-1 · repair 3/3 — delete the orphan database `db-projects-hr` (BV Coral): no role, named
-- "New Workspace", referenced nowhere in code (Florin 2026-10-05: "orphan db — delete"). ONE statement,
-- DESTRUCTIVE. Guarded: it deletes NOTHING if the database still holds a page or any database relates to it.
-- Expect 1 row; 0 rows = the guard held (then tell the Planner).
DELETE FROM "GlobalDatabase" d
WHERE d.id = 'db-projects-hr'
  AND d."logicalKey" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "GlobalPage" p WHERE p."databaseId" = d.id)
  AND NOT EXISTS (
    SELECT 1 FROM "GlobalDatabase" o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.properties) = 'array' THEN o.properties ELSE '[]'::jsonb END) e(p)
    WHERE p->'config'->>'relationDatabaseId' = d.id)
RETURNING d.id, d.name, d."tenantId";
