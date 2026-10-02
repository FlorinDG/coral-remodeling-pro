-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ART-DISC-1 · articles: "Discount" becomes a REAL discount (Florin 2026-10-02)
-- Today the live NettoKost formula treats Discount as "the share you pay" (80 = 20 % off); the quote and
-- invoice engines treat it as the discount (20 = 20 % off). Fix: flip each stored value (v → 100 − v) and
-- set the formula to  BruttoKost * (1 - Discount / 100)  IN ONE TRANSACTION — every NettoKost stays the
-- same number. Values written back from a quote/invoice ("Save/Update Library") are ALREADY real
-- discounts and must NOT be flipped — the preview shows them so you can decide.
-- Run in the Neon SQL editor. Step 1 changes nothing.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- STEP 1 · PREVIEW — the live formula, and every article with a Discount, with its net cost today and
-- after the flip (identical for inverted values — that is the point).
SELECT d."tenantId",
       (SELECT e->'config'->>'formulaExpression' FROM jsonb_array_elements(d.properties::jsonb) e WHERE e->>'id' = 'prop-art-netto') AS netto_formula_now
FROM "GlobalDatabase" d
WHERE d."logicalKey" = 'articles';

SELECT p.id,
       p.properties->>'title'                                    AS article,
       (p.properties->>'prop-art-bruto')::numeric                AS bruto,
       (p.properties->>'prop-art-remise')::numeric               AS discount_now,
       100 - (p.properties->>'prop-art-remise')::numeric         AS discount_after,
       round((p.properties->>'prop-art-bruto')::numeric * (p.properties->>'prop-art-remise')::numeric / 100, 2) AS netto_now,
       p."lastEditedBy",
       p."updatedAt"
FROM "GlobalPage" p
JOIN "GlobalDatabase" d ON d.id = p."databaseId" AND d."logicalKey" = 'articles'
WHERE jsonb_typeof(p.properties::jsonb -> 'prop-art-remise') = 'number'
  AND (p.properties->>'prop-art-remise')::numeric > 0
ORDER BY discount_now, article;
-- Read the list. Inverted values are usually HIGH (60–95: "pay 80 %"). A LOW value (say < 50) whose
-- netto_now looks absurdly cheap was probably written from a quote as a real discount → do NOT flip it.
-- Set the threshold in STEP 2 (default 50) or list ids to skip.

-- STEP 2 · APPLY — one transaction. Only runs while the formula is still the inverted one.
BEGIN;

UPDATE "GlobalPage" p
SET properties = jsonb_set(p.properties::jsonb, '{prop-art-remise}', to_jsonb(100 - (p.properties->>'prop-art-remise')::numeric)),
    "updatedAt" = now(),
    "lastEditedBy" = 'system:art-disc-1'
FROM "GlobalDatabase" d
WHERE d.id = p."databaseId" AND d."logicalKey" = 'articles'
  AND jsonb_typeof(p.properties::jsonb -> 'prop-art-remise') = 'number'
  AND (p.properties->>'prop-art-remise')::numeric >= 50          -- ← threshold from STEP 1 (0 = "no discount": never touched)
  -- AND p.id NOT IN ('…', '…')                                  -- ← ids to keep as they are
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(d.properties::jsonb) e
              WHERE e->>'id' = 'prop-art-netto' AND e->'config'->>'formulaExpression' NOT LIKE '%(1 -%');

UPDATE "GlobalDatabase" d
SET properties = (
        SELECT jsonb_agg(CASE WHEN e->>'id' = 'prop-art-netto'
                              THEN jsonb_set(e, '{config,formulaExpression}', to_jsonb('if(empty(Discount), BruttoKost, BruttoKost * (1 - Discount / 100))'::text))
                              ELSE e END ORDER BY ord)
        FROM jsonb_array_elements(d.properties::jsonb) WITH ORDINALITY t(e, ord)),
    "updatedAt" = now()
WHERE d."logicalKey" = 'articles'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(d.properties::jsonb) e
              WHERE e->>'id' = 'prop-art-netto' AND e->'config'->>'formulaExpression' NOT LIKE '%(1 -%');

-- Check before committing: the formula now contains "(1 - Discount / 100)", and the counts look right.
SELECT (SELECT e->'config'->>'formulaExpression' FROM jsonb_array_elements(d.properties::jsonb) e WHERE e->>'id' = 'prop-art-netto') AS netto_formula_after
FROM "GlobalDatabase" d WHERE d."logicalKey" = 'articles';

COMMIT;   -- or ROLLBACK; if anything looks wrong
-- Then: reload the app (the browser keeps a cached copy of the schema until the next load).
