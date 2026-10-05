-- WO-4b · privacy cleanup — the client's signature is no longer kept as a file of its own (Florin 2026-10-05).
-- Signing used to attach "Handtekening — <name>.png" to every member shift. Code now never does; this removes
-- the attachment ROWS made before. ONE statement, DESTRUCTIVE (rows only) — run after the code is live.
-- The signature stays in the signed PDF. Expect one row per member shift of each work order signed before today.
DELETE FROM "ShiftAttachment"
WHERE name LIKE 'Handtekening — %.png'
  AND type = 'image/png'
RETURNING "shiftId", name, url;
