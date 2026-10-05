# GRID-REPLACE-4 · parity checklist — the switch flips only when every line is ✅ on 2+ databases

Planner 2026-10-05. coral-r3-grid.md R3-B4: "The flag flips only when V2 matches V1 on a written checklist across
2+ databases." Florin clicks through with "Raster V2" on (database header, superadmin). ✅ = built and live ·
🟨 = built, Florin to confirm on screen · ⬜ = not built yet.

| # | Feature | V2 | Where |
|---|---|---|---|
| 1 | Filters (per view, per screen) | ✅ | toolbar → FilterToolbar (the old grid's component) + useFilteredPages |
| 2 | Sorts (per view) | ✅ | toolbar → SortToolbar; lib/records/view-sort (one rule for both grids) |
| 3 | Properties: show / hide columns, "Opmerkingen" hidden until shown | ✅ | toolbar → PropertiesDropdown; view-scope visibleColumns |
| 4 | Column order (drag a header) — per view | 🟨 ✅ by Florin; drop-target marker added 2026-10-05 | view-scope moveColumn → DB-DEF-1 view op |
| 5 | Column width (drag the edge; double-click resets) — per view | ✅ | view-scope setColumnWidth. FIXED 2026-10-05: the header's column drag started instead and cancelled the pointer — resize never worked |
| 6 | Sticky header; virtualised rows (large databases) | ✅ | TanStack Virtual |
| 7 | Edit text / number / currency / percent / url / email / phone — ONE click | 🟨 fixed 2026-10-05: € / % / Belgian decimals shown; phones written the Belgian way (lib/records/phone); bad email refused; the "two clicks on some rows" — every cell remounted on each store change (flexRender of a new function) — cells now called, not mounted | grid-cell parseCellInput |
| 8 | Edit select / multi-select / checkbox / date | 🟨 checkbox ✅ multi ✅; select reopened itself (portal clicks bubbled to the cell) — fixed; created/edited timestamps shown "05/10/2026 18:44" — Florin: which invoice column showed a date as text? | v2/cells.tsx |
| 9 | Edit relation (pick / unlink; open in place) | ✅ | RelationCell |
| 10 | Rollup / formula / comments shown; never written | 🟨 rollup ✅ comments ✅ formula: Florin tests as he goes | lib/records/rollup, formulaEngine |
| 11 | Variants | 🟨 summary works; variant values replacing the defaults (only the sale price does) = VARIANT-1 (in the record, not the grid) | — |
| 12 | Keyboard: arrows / Tab, Enter / F2, type-to-replace, Escape | ✅ | NotionGridV2 onKeyDown |
| 13 | Copy / paste (single cell, Excel blocks) | ⏳ needs a test database (Florin: not urgent) | grid-cell parseClipboardGrid / pasteValue |
| 14 | Row selection; delete (screen guard + door refusal) | ✅ (Florin deleted a row in sales) | grid-access, deleteRecord |
| 15 | New record ("Nieuw") with the screen's fixed filter | ✅ for now (placement differs per screen → DB-HEADER-1) | createPage |
| 16 | Open a record (title ⤢) — engine for invoices / quotes, side modal otherwise | ✅ | onOpenRecord / CROSS-LINK-1 |
| 17 | Export CSV (selection-aware) | ⏳ later | useExportCSV |
| 18 | Import CSV (not on locked system schemas) | ⏳ later | SpreadsheetImportModal |
| 19 | Accountant export (invoices / expenses / tickets, accountant + admins) | 🟨 | AccountantExportDialog |
| 20 | Purchase-invoice inbox: bulk approve "Klaar" records | 🟨 | grid-access bulkApproveCheck |
| 21 | VAT lookup on contacts / suppliers | 🟨 | lib/records/vat-lookup |
| 22 | Read-only: accountant; bestek below ENTERPRISE; exported records | 🟨 | grid-access gridAccess |
| 23 | "Lead source" hidden on contacts without CRM | 🟨 | grid-access licensedColumns |
| 24 | Lost edit (N1): type a name, click straight into another cell → BOTH persist after reload (10×) | ✅ | one field per commit + the record door |
| 25 | Row order while editing: an edit never moves the row under the cursor | 🟨 | view-sort holdOrder |
| 26 | Row menu (⋯ on the row number): open / duplicate / delete | 🟨 | v2 RowMenu; grid-access duplicateProperties — never a document, never the stamps (the old grid copied an invoice's status, OGM and export stamp) |
| 26b | Row drag-reorder | ✅ dropped | Florin 2026-10-05: no manual row order — views order by their sorts |
| 26c | Text wrap — "Tekst afbreken" (per view): long text wraps, the row grows | 🟨 | view `wrapText`; rows measured (TanStack Virtual measureElement). Florin: nice to have |
| 28 | View tabs, schema link and the V2 switch in the new grid's header | 🟨 | were missing with V2 on (only Projects has its own header) — fixed 2026-10-05: `renderTabs` passed like the old grid |
| 27 | Mobile / touch | ⬜ | to check |

**✅ FLIPPED 2026-10-05 (Florin: "one grid to rule them all… we only need one, and i like how it works so far").**
The new grid is the default for everyone; "Oud raster" (any user, per database, this browser) falls back for one
week — until **2026-10-12**. Open lines are checked as we go. Then GRID-REPLACE-5.

*(Original rule:)* **When every line is ✅ on 2+ databases:** GRID-REPLACE-4 flips the default (V2 for everyone; the switch becomes
"old grid" for a week), then GRID-REPLACE-5 deletes react-datasheet-grid, NotionGrid, the columns/* DSG cells, the
11 useOverlayEventShield call sites and the switch.
