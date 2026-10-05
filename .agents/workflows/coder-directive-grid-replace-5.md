# CODER DIRECTIVE — GRID-REPLACE-5 · removing the old grid — PLAN REQUEST

**Planner 2026-10-05. Gate 1 only: write the PLAN `.agents/plans/GRID-REPLACE-5.md` per `coder-report-protocol.md`
§0, push, STOP. Change NOTHING in `src/` at this stage.** §3a / §3b binding.

## Why
The new grid (`src/components/admin/database/v2/`, TanStack) replaces `NotionGrid.tsx` + react-datasheet-grid
(coral-r3-grid.md; checklist `.agents/plans/GRID-REPLACE-4-parity.md`). After GRID-REPLACE-4 flips the default and a
quiet week passes, the old grid and everything that exists only for it is deleted. This plan makes that deletion
mechanical and safe — written now, executed only when the Planner says GO.

## Your plan must contain (file:line for everything)
1. **Inventory of what goes:** `NotionGrid.tsx`; every `columns/*` file and which are DSG-only vs also used by
   others (e.g. `numberCell.ts`, `CommentsColumn.tsx`'s `LatestCommentCell`, `DateColumn` helpers — anything the
   new grid, the record modal or other screens import STAYS or MOVES); `NotionGrid.css`; the
   `react-datasheet-grid` dependency; the 11 `useOverlayEventShield` call sites + the hook (which exist only to fight
   DSG's document listeners — prove each one, by reading, before listing it); the "Raster V2" switch
   (`v2/grid-v2-flag.ts`, its button in `DatabaseClone.tsx`); the `gridV2` branch in `DatabaseClone.tsx`.
2. **Importers:** for every file that goes, every importer (grep output pasted). Nothing is deleted while
   imported.
3. **What moves instead of going** (a shared helper living in a DSG column file) — where to, and who imports it.
4. **Milestones**, smallest first, each leaving the app building: (a) moves, (b) the switch + branch, (c) the old
   grid + columns, (d) the shield sites + hook, (e) the dependency (package.json + lockfile — **Florin pushes that
   commit himself**: say so in the plan).
5. Measurements before/after: lines removed, bundle entries, eslint allowlist entries freed.
6. Open questions (anything the old grid does that the checklist does not list — search for behaviour, not names).

## 🛑 FENCE (plan stage)
Read everything; write only `.agents/plans/GRID-REPLACE-5.md`.
