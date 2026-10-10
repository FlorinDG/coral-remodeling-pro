# SITE-VISIT-1 — the site visit is its own instance of the document engine (Planner plan, 2026-10-10)

**Florin 2026-10-10:** "not a draft quote — a separate instance of the engine, without any financial information,
that can generate a document that we can send to client for approval (like a procès-verbal) and easily CONVERT into a
quote." Free-text lines carry images and tables (TipTap, EDITOR-1 E8).

## Shape
- **Kernel:** a new system database `site-visits` (logicalKey), its schema in `system-schemas.ts`: client, project,
  address, visit date (calendar day), status (draft → sent → approved / rejected → converted), the approval
  (who, when, channel), `convertedQuoteId`. Its series (numbering) in `lib/records/series`.
- **Core:** the engine's line model with a **document kind without money**: `documentKindOf('site-visit')` declares
  no prices, no VAT, no totals. One rule decides what a kind shows; the renderers ask it (no `if (siteVisit)` in a
  screen). `convertSiteVisitToQuote(visit) → quote intent`: lines, descriptions, quantities and units copied; prices
  come from the library (`articles`) as on any new quote; the visit links to the quote and becomes `converted`.
- **Door:** `saveRecord` / `saveRecords` (one transaction: the quote is created and the visit marked converted
  together). No new door.
- **PDF:** the quote template with the kind's rule — "Proces-verbaal / Plaatsbezoek" title, signature block for the
  client's approval, no figures.
- **Portal / send:** sent like a quote (mail + portal link); the client approves in the portal (as quotes do today).
- **Mobile:** started from the mobile office on site (photos from the camera into free-text lines, E8).
- **Tests:** the kind has no money anywhere (totals, PDF, payload); conversion copies lines and nothing financial;
  the conversion is one transaction (throw proof: fail halfway, nothing written).
