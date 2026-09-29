-- PROJ-SSOT-1 §1 · EXPORT CENSUS — READ ONLY, no writes, safe to run on production.
-- Question: what does the accountant export's `Project` column print today, per row?
-- timesheet-export/route.tsx:105-122 resolves names from "HrProject" ONLY:
--   projectId NULL                → 'Unattributed'
--   projectId found in HrProject  → the name
--   projectId anywhere else       → 'Unknown Project'
-- This census classifies every ClockEntry.projectId by where it ACTUALLY resolves.
-- The binding is READ from Tenant.lockedDbIds ->> 'projects' — never parsed, never defaulted.
-- Run in the Neon SQL editor. All tenants; one row per (tenant, class).

WITH entries AS (
    SELECT c.id, c."tenantId", c."projectId", c."clockInTime",
           t."lockedDbIds" ->> 'projects' AS projects_db
    FROM "ClockEntry" c
    JOIN "Tenant" t ON t.id = c."tenantId"
),
classified AS (
    SELECT e.*,
        CASE
            WHEN e."projectId" IS NULL OR btrim(e."projectId") = ''
                THEN '1 · unattributed          → prints "Unattributed"'
            WHEN EXISTS (SELECT 1 FROM "HrProject" h
                         WHERE h.id = e."projectId" AND h."tenantId" = e."tenantId")
                THEN '2 · HrProject             → prints the name'
            WHEN EXISTS (SELECT 1 FROM "GlobalPage" p
                         WHERE p.id = e."projectId" AND p."databaseId" = e.projects_db)
                THEN '3 · GlobalPage (bound db) → prints "Unknown Project"'
            WHEN EXISTS (SELECT 1 FROM "InternalProject" i
                         WHERE i.id = e."projectId" AND i."tenantId" = e."tenantId")
                THEN '4 · InternalProject       → prints "Unknown Project"'
            WHEN EXISTS (SELECT 1 FROM "GlobalPage" p
                         JOIN "GlobalDatabase" d ON d.id = p."databaseId"
                         WHERE p.id = e."projectId" AND d."tenantId" = e."tenantId")
                THEN '5 · GlobalPage, OTHER db of same tenant  (anomaly)'
            WHEN EXISTS (SELECT 1 FROM "GlobalPage" p WHERE p.id = e."projectId")
             OR  EXISTS (SELECT 1 FROM "InternalProject" i WHERE i.id = e."projectId")
             OR  EXISTS (SELECT 1 FROM "HrProject" h WHERE h.id = e."projectId")
                THEN '6 · resolves in ANOTHER TENANT  (🔴 isolation)'
            ELSE     '7 · dangling — resolves nowhere'
        END AS class
    FROM entries e
)

-- ── 1. THE HEADLINE ──────────────────────────────────────────────────────────
SELECT "tenantId",
       projects_db IS NULL                                            AS no_projects_binding,
       class,
       count(*)                                                       AS entries,
       count(*) FILTER (WHERE "clockInTime" >= date_trunc('month', now()) - interval '1 month'
                          AND "clockInTime" <  date_trunc('month', now()))   AS last_full_month,
       min("clockInTime")::date                                       AS first_seen,
       max("clockInTime")::date                                       AS last_seen
FROM classified
GROUP BY "tenantId", projects_db IS NULL, class
ORDER BY "tenantId", class;

-- ── 2. The premise itself (directive says 0) ────────────────────────────────
-- SELECT "tenantId", count(*) FROM "HrProject" GROUP BY "tenantId";

-- ── 3. Same classification for ScheduledShift.projectId (shift-brief, SCH-7 names)
--      Swap "ClockEntry" → "ScheduledShift" and "clockInTime" → "createdAt" in `entries`.

-- ── 4. Rows in classes 5–7, if section 1 shows any ──────────────────────────
-- SELECT id, "tenantId", "projectId", "clockInTime", class
-- FROM classified WHERE class LIKE '5%' OR class LIKE '6%' OR class LIKE '7%'
-- ORDER BY "tenantId", "clockInTime";
