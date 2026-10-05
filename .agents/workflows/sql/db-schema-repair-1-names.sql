-- DB-SCHEMA-1 · repair 1/2 — system databases called "New Workspace" get their role's name. ONE statement.
-- Census 2026-10-05: BV Coral's crm, bobex, tasks were "New Workspace" (the schema page title Florin saw).
-- Only databases WITH a role are renamed; the orphan `db-projects-hr` (no role, referenced nowhere in code)
-- is left for Florin to decide. Expect 3 rows.
UPDATE "GlobalDatabase" d
SET name = CASE d."logicalKey"
             WHEN 'crm'   THEN 'CRM'
             WHEN 'bobex' THEN 'Bobex'
             WHEN 'tasks' THEN 'Tasks'
           END,
    "updatedAt" = now()
WHERE d.name IN ('New Workspace', 'New Database', 'Untitled Database')
  AND d."logicalKey" IN ('crm', 'bobex', 'tasks')
RETURNING d."tenantId", d.id, d."logicalKey", d.name;
