-- BLOB-0 · CENSUS of receiptUrl shapes — READ ONLY, no writes, safe to run on production.
-- Purpose: how many records would now ABORT a strict accountant export (BLOB-4),
-- and how many are exposed to the percent-encoding gap (BLOB-6).
-- Run in Neon SQL editor. Replace <TENANT_ID> with the tenant cuid (without the t_ prefix).

WITH docs AS (
    SELECT
        p.id,
        d."tenantId"                        AS tenant_id,
        p."databaseId"                      AS database_id,
        p.properties ->> 'title'            AS title,
        p.properties ->> 'receiptUrl'       AS receipt_url,
        (p.properties ->> 'accountantExportedAt') AS exported_flag
    FROM "GlobalPage" p
    JOIN "GlobalDatabase" d ON d.id = p."databaseId"
    WHERE p."databaseId" LIKE 'db-invoices%'
       OR p."databaseId" LIKE 'db-expenses%'
),
classified AS (
    SELECT
        *,
        CASE
            WHEN receipt_url IS NULL OR btrim(receipt_url) = ''       THEN 'A · no document (skipped, fine)'
            WHEN receipt_url LIKE 't\_%'                              THEN 'B · key (fine)'
            WHEN receipt_url LIKE '/api/files/t\_%'                   THEN 'C · /api/files key (resolves)'
            WHEN receipt_url ~ '^https?://[^/]+/t_'                   THEN 'D · legacy URL, blob path (resolves)'
            WHEN receipt_url ~ '^https?://'                           THEN 'E · legacy URL, NOT a blob path (ABORTS EXPORT)'
            ELSE                                                           'F · unrecognised shape (ABORTS EXPORT)'
        END AS shape,
        (receipt_url LIKE '%\%2%' OR receipt_url LIKE '% %')          AS encoding_risk
    FROM docs
)

-- ── 1. THE HEADLINE: how many records would abort a strict export? ──────────
SELECT shape,
       count(*)                                            AS records,
       count(*) FILTER (WHERE encoding_risk)               AS with_space_or_encoding,
       count(*) FILTER (WHERE exported_flag = 'true')      AS already_stamped_exported
FROM classified
GROUP BY shape
ORDER BY shape;


-- ── 2. THE ACTIONABLE LIST: run this second. Every row here blocks an export. ──
-- SELECT id, database_id, title, receipt_url, exported_flag
-- FROM classified
-- WHERE shape LIKE 'E%' OR shape LIKE 'F%'
-- ORDER BY database_id, title;


-- ── 3. THE OLD DAMAGE: stamped as exported, but the document may never have shipped.
-- These are the records the pre-BLOB-4 export could have lied about. It cannot be
-- proven from SQL alone that the PDF was missing — this is the candidate set to
-- check by hand (or re-export after clearing the flag).
-- SELECT id, database_id, title, receipt_url
-- FROM classified
-- WHERE exported_flag = 'true'
--   AND (shape LIKE 'E%' OR shape LIKE 'F%' OR encoding_risk)
-- ORDER BY database_id, title;
