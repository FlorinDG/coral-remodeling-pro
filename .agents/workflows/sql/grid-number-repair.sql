-- GRID-NUM-1 · repair number / currency / percent values the old grid cell stored as an OBJECT
-- ({ "prop-art-remise": 20 } instead of 20 → "[object Object]" in the detail pane). Any database.
-- Run in the Neon SQL editor. STEP 1 changes nothing.

-- STEP 1 · PREVIEW — every damaged field, with the value it should hold
SELECT p.id, p.properties->>'title' AS record, e.k AS field, e.v AS stored_now, e.v -> e.k AS repaired
FROM "GlobalPage" p, jsonb_each(p.properties::jsonb) AS e(k, v)
WHERE jsonb_typeof(e.v) = 'object' AND e.v ? e.k AND (SELECT count(*) FROM jsonb_object_keys(e.v)) = 1;

-- STEP 2 · REPAIR — replace each such object by the value inside it
BEGIN;
UPDATE "GlobalPage" p
SET properties = (SELECT jsonb_object_agg(k, CASE WHEN jsonb_typeof(v) = 'object' AND v ? k AND (SELECT count(*) FROM jsonb_object_keys(v)) = 1
                                                   THEN CASE WHEN jsonb_typeof(v -> k) = 'string' AND (v ->> k) ~ '^\s*-?[0-9]+([.,][0-9]+)?\s*$'
                                                             THEN to_jsonb(replace(trim(v ->> k), ',', '.')::numeric)   -- "500" → 500
                                                             ELSE v -> k END
                                                   ELSE v END)
                  FROM jsonb_each(p.properties::jsonb) AS e(k, v)),
    "updatedAt" = now()
WHERE EXISTS (SELECT 1 FROM jsonb_each(p.properties::jsonb) AS e(k, v)
              WHERE jsonb_typeof(e.v) = 'object' AND e.v ? e.k AND (SELECT count(*) FROM jsonb_object_keys(e.v)) = 1);
-- check: STEP 1 again must return no rows
COMMIT;   -- or ROLLBACK;
