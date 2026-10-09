# EDITOR-1 — TipTap, the one rich-text primitive (Planner 2026-10-09)

Decided by Florin 2026-10-09: "go for tiptap then", and "tiptap will have to comply to the canonical legislation
governing our multi tenant erp".

TipTap is a SURFACE. It owns no rule, no storage, no tenancy. These bindings are what "comply" means.

## Bindings

**E1 · The rich-text rule lives in core: `lib/records/rich-text.ts`.** It is pure and has no DOM.
- The ONE allowlist: p, br, strong/b, em/i, u, ul, ol, li, span[style=color], plus text. Nothing else survives.
- `sanitizeRichText(html)` keeps the allowlist and strips every other tag, every attribute except a validated
  `color`, every `on*` handler, and every `javascript:` / `data:` URL.
- The editor's extensions, the PDF reader (`pdfRichText`) and the portal viewers follow this allowlist.

**E2 · The door sanitizes, whatever writes.** `applyRecordIntent` (core, the record door every block write passes
through) runs block `content` through `sanitizeRichText`. A desktop editor, the phone, a PDF import, a scan, the
API or a coder's script: none can store HTML outside the allowlist.

**E3 · Every HTML render reads sanitized text.** The client portal viewers (`/quote/[id]`, `/invoice/[id]`, public
to the tenant's customers) render `sanitizeRichText(block.content)` and never raw HTML. Rows stored before E2 are
covered at read time without a data migration (root to leaf: the door + the render, no repair job).

**E4 · No data leaves the tenant.**
- No TipTap Cloud, collaboration provider, AI or comments extension. Only the open-source packages, pinned.
- Images and links are not part of the allowlist now, because the PDF never printed them. If they come back, an
  image goes through the tenant-scoped upload door, never a free URL.

**E5 · TipTap never persists.** The editor calls `onChange(html)` on idle (about 500 ms) and on blur. The caller
writes the block through the store → sync queue → record door, as every edit does: stale-write merge, versions,
author. The editor is uncontrolled while focused, which closes VRIJETEKST-EDITOR-RESET at its root.

**E6 · One component: `components/editor/RichText.tsx`.**
- It replaces every `contentEditable` and `document.execCommand` (QuotationRow, InvoiceRow, both
  FinancialRowRenderers).
- Its toolbar labels come from i18n in en/nl/fr/ro.
- The toolbar offers only what the PDF prints: bold, italic, underline, bullet list, numbered list. Alignment,
  image and link buttons go; the PDF never printed them.

**E7 · Guards, with throw proofs.**
- The sanitizer drops script, on* handlers, javascript: URLs and foreign tags.
- The door sanitizes.
- The viewers never render unsanitized HTML.
- No `contentEditable` or `execCommand` outside the primitive.
- The PDF reader prints TipTap's list shape (`<li><p>…</p></li>`) on one line.

## Order

1. **E1 + E2 + E3 + the PDF list fix.** No package change. This is a security fix on its own, promoted as soon as it
   is green.
2. **E4–E7: TipTap.** This is a package change, so Florin pushes that range to main.
