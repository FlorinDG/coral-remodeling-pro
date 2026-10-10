# EDITOR-1 E8 — images (and tables) inside document lines; the tenant's file store (Planner plan, 2026-10-10)

**Florin 2026-10-10:** "add the image capability to the text editor inside the lines … add image from storage, camera
or tenant storage (blob)" — "this is where a proper blob file manager will greatly help."
**Depends on:** PR #2 (TipTap) merged.

## The file store comes first (FILES-1) — one door for every file
- **Kernel:** what a stored file is: tenant, key, name, type, size, owner record (optional), created by/at.
- **Door `lib/data/files.ts`:** `putFile` / `listFiles` / `fileUrl` / `deleteFile` on Vercel Blob, the key prefixed by
  the tenant (`t/<tenantId>/…`) and checked on every read; a signed / private URL, never a guessable public one.
  Every existing upload (document archive, attachments, logos, shift attachments) moves onto it.
- **Screen:** the Files module (`/admin/files`) becomes the tenant's browser of that store.
- **Schema (Florin pushes):** `StoredFile` + scope-rules + isolation census.

## E8 · the image node
- `lib/records/rich-text.ts` allowlist: `img` with `src` restricted to the tenant's file URLs (the sanitizer drops any
  other host), `alt`, `width`; `table`/`tr`/`td`/`th`. `pdfRichText` renders both (`@react-pdf` Image / rows).
- `components/editor/RichText.tsx`: one "Image" control with three sources — this device (file picker), camera
  (`capture="environment"` on mobile), the tenant's files (picker over `listFiles`). Device and camera upload through
  `putFile` first; the editor only ever stores a tenant file URL.
- Size: images downscaled on the client before upload (max edge 2000 px, JPEG/WebP).
- **Tests:** the sanitizer drops a foreign `img src`, keeps a tenant one; the PDF renders an image and a table; a file
  from tenant B is refused for tenant A (throw proof).
