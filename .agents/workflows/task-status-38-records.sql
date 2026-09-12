-- ⛔⛔ STEPS 3 AND 4 ARE RETRACTED — DO NOT RUN. Planner, 2026-09-12.
-- Step 1 (read-only) was correct and produced the finding:
--     t-todo 22 · t-prog 11 · t-done 5 — ALL 38 carry a project.
-- They are NOT legacy. `t-*` is the LIVE convention of the project subsystem,
-- actively written by ProjectDetailView:422/439, ClientQuotationEngine:734,
-- quote-service:128, and read by the project progress automation at
-- store.ts:1699-1715 (project marked Done only when every task is `t-done`).
-- Migrating these 5 to `opt-done` would silently break project completion.
-- See coral-task-status-two-subsystems.md. Fix is a mobile READ tolerance (TS-1).
--
-- TASK-STATUS-38 · the 38 live `t-*` task records — READ FIRST, THEN MIGRATE
-- Context: coder-directive-tasks-part-a.md gate 0.2 · PROJ-2 carve-out
-- Florin runs this. Neon SQL editor. Take a snapshot first (pd.md DATA-SAFETY).

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1 · READ-ONLY — the breakdown. Run this and paste the result.
--          We need to know WHICH values, not just how many.
-- ─────────────────────────────────────────────────────────────────────
SELECT
    p.properties ->> 'prop-task-status' AS status_value,
    count(*)                            AS records,
    count(*) FILTER (
        WHERE p.properties ->> 'prop-task-project' IS NOT NULL
    )                                   AS with_project
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId"
WHERE d.id LIKE 'db-tasks%'
  AND p.properties ->> 'prop-task-status' LIKE 't-%'
GROUP BY 1
ORDER BY 2 DESC;

-- Expected shape: t-todo / t-prog / t-done, summing to 38.
-- 🚨 The ones that matter most are `t-done`: with the legacy read removed,
--    a t-done task is NOT recognised as done and therefore appears as an
--    OPEN task in the mobile list. Those are the visibly-wrong records.


-- ─────────────────────────────────────────────────────────────────────
-- STEP 2 · READ-ONLY — see them, before changing anything.
-- ─────────────────────────────────────────────────────────────────────
-- SELECT p.id,
--        p.properties ->> 'title'            AS title,
--        p.properties ->> 'prop-task-status' AS status_value,
--        p."updatedAt"
-- FROM "GlobalPage" p
-- JOIN "GlobalDatabase" d ON d.id = p."databaseId"
-- WHERE d.id LIKE 'db-tasks%'
--   AND p.properties ->> 'prop-task-status' LIKE 't-%'
-- ORDER BY p."updatedAt" DESC;


-- ─────────────────────────────────────────────────────────────────────
-- STEP 3 · THE MIGRATION — only after Steps 1 and 2, and a snapshot.
--          Mapping is 1:1 and fully reversible (see Step 4).
--            t-todo → opt-todo
--            t-prog → opt-doing
--            t-done → opt-done
-- ─────────────────────────────────────────────────────────────────────
-- BEGIN;
--
-- UPDATE "GlobalPage" p
-- SET properties = jsonb_set(
--         p.properties::jsonb,
--         '{prop-task-status}',
--         to_jsonb(
--             CASE p.properties ->> 'prop-task-status'
--                 WHEN 't-todo' THEN 'opt-todo'
--                 WHEN 't-prog' THEN 'opt-doing'
--                 WHEN 't-done' THEN 'opt-done'
--             END
--         )
--     )
-- FROM "GlobalDatabase" d
-- WHERE d.id = p."databaseId"
--   AND d.id LIKE 'db-tasks%'
--   AND p.properties ->> 'prop-task-status' IN ('t-todo', 't-prog', 't-done');
--
-- -- Verify INSIDE the transaction before committing: must return 0 rows.
-- SELECT count(*) FROM "GlobalPage" p
-- JOIN "GlobalDatabase" d ON d.id = p."databaseId"
-- WHERE d.id LIKE 'db-tasks%' AND p.properties ->> 'prop-task-status' LIKE 't-%';
--
-- COMMIT;   -- or ROLLBACK; if the count is not 0


-- ─────────────────────────────────────────────────────────────────────
-- STEP 4 · REVERSE, if ever needed. The mapping is lossless.
-- ─────────────────────────────────────────────────────────────────────
-- opt-todo → t-todo · opt-doing → t-prog · opt-done → t-done
-- ⚠️ BUT: after the app has been used, new tasks will also be opt-*, and
--    they have no `t-*` original. So a blanket reverse would rewrite records
--    that were never legacy. If reversal is ever needed, restore from the
--    Neon snapshot instead — that is what the snapshot is for.


-- ─────────────────────────────────────────────────────────────────────
-- WHY THIS IS WORTH DOING RATHER THAN TOLERATING IN CODE
-- ─────────────────────────────────────────────────────────────────────
-- The alternative is a read-side hedge (`status === 'opt-done' || 't-done'`)
-- in every consumer, forever. That is two representations of one concept —
-- the defect shape this whole pass exists to remove — and it would have to
-- be remembered by every future surface. 38 rows and one reversible UPDATE
-- ends it permanently. This is the PROJ-2 carve-out for db-tasks; the wider
-- PROJ-2 audit stays parked.
