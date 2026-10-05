-- DB-SCHEMA-1 · census of every database's schema: name, role, and where each RELATION / ROLLUP points.
-- READ-ONLY, ONE statement (the Neon editor fails on multi-statement scripts). Planner 2026-10-05.
-- Florin: "sales pipe db's schema settings don't actually belong to the db, they don't get applied" — the
-- CRM schema page is titled "New Workspace", and its "Tasks [C-SYS]" relation points at "New Workspace".
-- Flags:
--   GARBAGE_NAME    a database called "New Workspace" / "New Database" / "Untitled Database"
--   ROLE_UNBOUND    a system database (logicalKey) that is not the one the tenant's binding names for that role
--   TARGET_MISSING  a relation pointing at a database that does not exist
--   TARGET_FOREIGN  a relation pointing at ANOTHER tenant's database
--   TARGET_SELF     a relation pointing at its own database (legitimate only if meant)
--   TARGET_BASE     a relation holding a bare base id ('db-1', 'db-tasks', …) — resolved through the binding
SELECT
  t."companyName"                                        AS tenant,
  d.id                                                   AS database_id,
  d."logicalKey"                                         AS role,
  d.name                                                 AS db_name,
  p->>'name'                                             AS property,
  p->>'type'                                             AS type,
  p->'config'->>'relationDatabaseId'                     AS target_id,
  td.name                                                AS target_name,
  td."logicalKey"                                        AS target_role,
  CONCAT_WS(' ',
    CASE WHEN d.name IN ('New Workspace','New Database','Untitled Database') THEN 'GARBAGE_NAME' END,
    CASE WHEN d."logicalKey" IS NOT NULL AND (t."lockedDbIds"->>d."logicalKey") IS DISTINCT FROM d.id THEN 'ROLE_UNBOUND' END,
    CASE WHEN p->>'type' = 'relation' AND p->'config'->>'relationDatabaseId' LIKE 'db-%'
              AND p->'config'->>'relationDatabaseId' !~ '-[0-9a-f]{6,}' THEN 'TARGET_BASE' END,
    CASE WHEN p->>'type' = 'relation' AND td.id IS NULL
              AND NOT (p->'config'->>'relationDatabaseId' LIKE 'db-%' AND p->'config'->>'relationDatabaseId' !~ '-[0-9a-f]{6,}') THEN 'TARGET_MISSING' END,
    CASE WHEN td.id IS NOT NULL AND td."tenantId" <> d."tenantId" THEN 'TARGET_FOREIGN' END,
    CASE WHEN td.id = d.id THEN 'TARGET_SELF' END
  )                                                      AS flags
FROM "GlobalDatabase" d
JOIN "Tenant" t ON t.id = d."tenantId"
LEFT JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.properties) = 'array' THEN d.properties ELSE '[]'::jsonb END) p
       ON p->>'type' IN ('relation', 'rollup')
LEFT JOIN "GlobalDatabase" td ON td.id = p->'config'->>'relationDatabaseId'
ORDER BY t."companyName", d."logicalKey" NULLS LAST, d.name, p->>'name';
