# GRID-REPLACE-4 · parity checklist — the switch flips only when every line is ✅ on 2+ databases

Planner 2026-10-05. coral-r3-grid.md R3-B4: "The flag flips only when V2 matches V1 on a written checklist across
2+ databases." Florin clicks through with "Raster V2" on (database header, superadmin). ✅ = built and live ·
🟨 = built, Florin to confirm on screen · ⬜ = not built yet.

| # | Feature | V2 | Where |
|---|---|---|---|
| 1 | Filters (per view, per screen) | 🟨 | toolbar → FilterToolbar (the old grid's component) + useFilteredPages |
| 2 | Sorts (per view) | 🟨 | toolbar → SortToolbar; lib/records/view-sort (one rule for both grids) |
| 3 | Properties: show / hide columns, "Opmerkingen" hidden until shown | 🟨 | toolbar → PropertiesDropdown; view-scope visibleColumns |
| 4 | Column order (drag a header) — per view | 🟨 | view-scope moveColumn → DB-DEF-1 view op |
| 5 | Column width (drag the edge) — per view | 🟨 | view-scope setColumnWidth |
| 6 | Sticky header; virtualised rows (large databases) | 🟨 | TanStack Virtual |
| 7 | Edit text / number / currency / percent / url / email / phone — ONE click | 🟨 | grid-cell parseCellInput |
| 8 | Edit select / multi-select / checkbox / date | 🟨 | v2/cells.tsx |
| 9 | Edit relation (pick / unlink; open in place) | 🟨 | RelationCell |
| 10 | Rollup / formula / comments shown; never written | 🟨 | lib/records/rollup, formulaEngine |
| 11 | Variants | 🟨 summary only — edited in the record | — |
| 12 | Keyboard: arrows / Tab, Enter / F2, type-to-replace, Escape | 🟨 | NotionGridV2 onKeyDown |
| 13 | Copy / paste (single cell, Excel blocks) | 🟨 | grid-cell parseClipboardGrid / pasteValue |
| 14 | Row selection; delete (screen guard + door refusal) | 🟨 | grid-access, deleteRecord |
| 15 | New record ("Nieuw") with the screen's fixed filter | 🟨 | createPage |
| 16 | Open a record (title ⤢) — engine for invoices / quotes, side modal otherwise | 🟨 | onOpenRecord / CROSS-LINK-1 |
| 17 | Export CSV (selection-aware) | 🟨 | useExportCSV |
| 18 | Import CSV (not on locked system schemas) | 🟨 | SpreadsheetImportModal |
| 19 | Accountant export (invoices / expenses / tickets, accountant + admins) | 🟨 | AccountantExportDialog |
| 20 | Purchase-invoice inbox: bulk approve "Klaar" records | 🟨 | grid-access bulkApproveCheck |
| 21 | VAT lookup on contacts / suppliers | 🟨 | lib/records/vat-lookup |
| 22 | Read-only: accountant; bestek below ENTERPRISE; exported records | 🟨 | grid-access gridAccess |
| 23 | "Lead source" hidden on contacts without CRM | 🟨 | grid-access licensedColumns |
| 24 | Lost edit (N1): type a name, click straight into another cell → BOTH persist after reload (10×) | 🟨 | one field per commit + the record door |
| 25 | Row order while editing: an edit never moves the row under the cursor | 🟨 | view-sort holdOrder |
| 26 | Row menu (⋯ on the row number): open / duplicate / delete | 🟨 | v2 RowMenu; grid-access duplicateProperties — never a document, never the stamps (the old grid copied an invoice's status, OGM and export stamp) |
| 26b | Row drag-reorder | ❓ Florin | NOT ported: the old grid's drag changed the order in the browser only (never saved) and views order by their sorts — decide whether a MANUAL order is wanted (it would be a saved per-view order) |
| 27 | Mobile / touch | ⬜ | to check |

**When every line is ✅ on 2+ databases:** GRID-REPLACE-4 flips the default (V2 for everyone; the switch becomes
"old grid" for a week), then GRID-REPLACE-5 deletes react-datasheet-grid, NotionGrid, the columns/* DSG cells, the
11 useOverlayEventShield call sites and the switch.
