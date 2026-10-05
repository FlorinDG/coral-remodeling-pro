-- DB-SCHEMA-1 · repair 2/2 — relations pointing at a database that does NOT exist are re-pointed to the
-- tenant's own bound database for that role. ONE statement. Census 2026-10-05:
--   Murgu: invoices."Project", expenses."Project" → 'db-1-cmoa44mj' (missing) → lockedDbIds.projects
--   BV Coral: projects."Klant" → 'db-clients' (missing)                     → lockedDbIds.clients
-- Only MISSING targets whose id starts with 'db-1' or 'db-clients' are touched; every other property is kept
-- as is, in its order. Expect 3 rows (one per database changed).
UPDATE "GlobalDatabase" d
SET properties = fixed.props, "updatedAt" = now()
FROM (
  SELECT d2.id,
         jsonb_agg(
           CASE
             WHEN p->>'type' = 'relation'
              AND NOT EXISTS (SELECT 1 FROM "GlobalDatabase" x WHERE x.id = p->'config'->>'relationDatabaseId')
              AND (p->'config'->>'relationDatabaseId' = 'db-1' OR p->'config'->>'relationDatabaseId' LIKE 'db-1-%')
              AND (t."lockedDbIds"->>'projects') IS NOT NULL
               THEN jsonb_set(p, '{config,relationDatabaseId}', to_jsonb(t."lockedDbIds"->>'projects'))
             WHEN p->>'type' = 'relation'
              AND NOT EXISTS (SELECT 1 FROM "GlobalDatabase" x WHERE x.id = p->'config'->>'relationDatabaseId')
              AND (p->'config'->>'relationDatabaseId' = 'db-clients' OR p->'config'->>'relationDatabaseId' LIKE 'db-clients-%')
              AND (t."lockedDbIds"->>'clients') IS NOT NULL
               THEN jsonb_set(p, '{config,relationDatabaseId}', to_jsonb(t."lockedDbIds"->>'clients'))
             ELSE p
           END
           ORDER BY ord
         ) AS props
  FROM "GlobalDatabase" d2
  JOIN "Tenant" t ON t.id = d2."tenantId"
  CROSS JOIN LATERAL jsonb_array_elements(d2.properties) WITH ORDINALITY AS e(p, ord)
  WHERE jsonb_typeof(d2.properties) = 'array'
  GROUP BY d2.id
) fixed
WHERE fixed.id = d.id
  AND fixed.props IS DISTINCT FROM d.properties
RETURNING d."tenantId", d.id, d."logicalKey";
