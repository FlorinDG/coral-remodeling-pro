-- VALIDATE-1 · remove the old purchase-invoice "Inbox / Te verwerken" VIEW (WRITES, one statement). Planner 2026-10-06.
-- The "Te valideren" SCREEN (Financiën → TE VALIDEREN) replaced it: scans wait there, the purchase-invoice screens
-- show only what counts. The old view, seeded by the browser on every page load (that seeding is deleted), now
-- shows only Peppol / manual records under a misleading name. Only the view leaves — no record is touched; the
-- other views keep their order. Before: SELECT id, name FROM "GlobalDatabase" WHERE views @> '[{"id":"vw-expenses-inbox"}]';
UPDATE "GlobalDatabase" d
SET views = (
    SELECT coalesce(jsonb_agg(v.elem ORDER BY v.pos), '[]'::jsonb)
    FROM jsonb_array_elements(d.views) WITH ORDINALITY AS v(elem, pos)
    WHERE v.elem->>'id' <> 'vw-expenses-inbox'
)
WHERE d."logicalKey" = 'expenses'
  AND d.views @> '[{"id": "vw-expenses-inbox"}]';
