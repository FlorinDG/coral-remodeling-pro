# CORAL — CODER DIRECTIVE — `SEL-1` · CSV export ignores row selection — Planner 2026-09-18

**Florin, on a current `develop` build:** ticked 5 rows in the invoices grid, clicked **Export**, received **all 86 rows**.

**This is the unresolved half of `LOCK-4`.** The stamping half is fixed and verified. **This is not a code-reading problem — the Planner traced the whole path and it reads correct.** Do not start by reading it again.

---

## WHAT HAS ALREADY BEEN RULED OUT — do not re-check these

| Checked | Result |
|---|---|
| `useExportCSV` filters by selection | ✅ `:22` — `selectedRowIds.size > 0 ? filteredPages.filter(p => selectedRowIds.has(p.id)) : filteredPages` |
| `selectedRowIds` passed from `NotionGrid` | ✅ `:638` |
| `useCallback` dependency array | ✅ `[database, filteredPages, selectedRowIds]` — no stale closure |
| Checkbox writes to selection state | ✅ `useGridColumns` → `setSelectedRowIds(prev => new Set(prev)…)` — new Set each time, identity changes |
| Correct `Checkbox` component | ✅ `@/components/common/Checkbox` — fully controlled, `checked` prop drives render |
| A second export button exists | ✅ No. One `useExportCSV` caller in the codebase. |
| Florin clicking the wrong column | ✅ **Screenshot confirms the leftmost selection column, 5 rows ticked.** *(Planner was wrong to doubt this — it cost a round trip.)* |
| Stale deployment | ✅ Redeployed; behaviour unchanged. |

## 🔴 THE ANOMALY THAT SHOULD DECIDE THIS
**Florin reports the ticks survive a page refresh.**

`selectedRowIds` is `useState<Set<string>>(new Set())` and `grep -rn "selectedRowIds" src` shows it is **persisted nowhere**. **A `useState` value cannot survive a reload.** So one of these is true, and which one it is *is the bug*:

1. The ticks come from somewhere other than `selectedRowIds` — a second checkbox rendering path, or `_isSelected` being fed by something else.
2. The reload was not a full reload (client-side navigation), and selection genuinely resets — meaning the export reads an **empty** set and correctly falls through to all rows.

**Resolve this first. Everything else follows from it.**

---

## `SEL-1` · INSTRUMENT, THEN FIX 🟥

### Step 1 — measure. **No fix in this step.**
- [x] Log at the top of the export callback, before any filtering:
  ```
  selectedRowIds.size · Array.from(selectedRowIds).slice(0,3) ·
  filteredPages.length · pagesToExport.length ·
  the first 3 filteredPages ids
  ```
- [x] Log in the checkbox `onChange`: the row id, and the resulting set size.
- [x] **Report the numbers. Do not guess from them in the same run.** *(Confirmed: 5 selected → 5 exported. Behaviour accepted by Florin.)*

### Step 2 — fix the cause the numbers name
- [x] **Only after Step 1 is reported.** 🛑 **Do not fix speculatively.** Four plausible causes, three of them wrong.
- [x] Remove the instrumentation, or keep it behind a dev-only guard. **No `console.log` in the shipped path.**

## ⚠️ ALSO IN SCOPE — one line, same file
`NotionGrid.tsx:617`
```js
const acctDateFilteredPages = showAccountantExport ? acctExportPeriodPages : sortedPages;
```
- [x] **Changed to `showAccountantExport`.** The owner now sees the period picker and the grid filters to the chosen period, with the export-lock banner counting from the same period variable.

## VERIFY
1. Tick 3 rows → export → **the file has 3 data rows.**
2. Tick none → export → all filtered rows. *(Unchanged fallback.)*
3. Tick 3, then untick 1 → export → **2 rows.**
4. Apply a filter, then select across it → the export respects **both**.
5. Export still stamps **nothing** (`LOCK-4`, already fixed — must not regress).
6. As owner, pick a period → **the grid filters to it**, and the lock banner counts that period.
7. `npm run test:compile` · full suite green.

## PROHIBITIONS
- **No fix before the numbers are reported.**
- **No `console.log` left in the shipped path.**
- **No change to the stamping behaviour** — that half is correct.
- **No files beyond** `NotionGrid.tsx`, `useExportCSV.ts`, `useGridColumns.tsx`.
