# CORAL — R3 · THE RECORD SURFACE — re-cut (Planner 2026-09-12, **revised: GRID-REPLACE is the vehicle**)

Governed by `coral-systems-pass.md`. **Not a root — a leaf, and one that other leaves hang off.**

> **INVARIANT:** *A cell edit commits its own field and nothing else. A view's state is where the user last put it.*

---

## THE REVISION

Florin: *"I agree the grid is not a root. We have a plan, not yet implemented, to replace the current grid. But the grid is a leaf on which other, even less relevant, leaves depend."*

That plan exists: **`GRID-REPLACE`** in `ground-zero-triage.md:1190` — migrate off `react-datasheet-grid` onto **TanStack Table** (headless), five phased steps behind a flag, already measured (~78 DSG-specific call sites; the data logic separates and stays).

**This changes R3 completely. The previous draft is withdrawn.** It proposed rebuilding the cell-commit logic *inside* the DSG grid (R3-1) — work that would be deleted by `GRID-REPLACE-1`. Building the right commit model into a component that is being replaced is the "fix it twice" failure I warned about in R2, committed in R3.

**The re-cut, in one line: the grid is not repaired — it is replaced, on top of the core, and the replacement is where the invariant is built in by construction.**

### Leaf ordering (Florin's point, made operational)
A leaf can carry dependents. The grid carries several — relation link-through, view state, column visibility, the grid-side filter/sort surfaces, and every module view that renders through it. So the ordering rule inside the leaf layer is: **a leaf with dependents is done before its dependents, and none of them is done twice.** Concretely, nothing DSG-coupled gets touched again before `GRID-REPLACE`.

---

## SEQUENCE

```
R1 tenancy  →  R2 core write path  →  GRID-REPLACE (1…5)  →  grid-dependent leaves
                     ↑                        ↑
        intents exist here          V2 consumes them; never ports the diff loop
```

**Why GRID-REPLACE lands after R2, not before:** `GRID-REPLACE-1` includes *"store wiring (read/edit/persist by id)"*. If V2 is wired to today's write path and R2 then changes it, the wiring is written twice. After R2 there is one intent API and V2 simply consumes it — which is also what makes V2 correct on day one instead of inheriting the race.

---

## ⚠️ PLAN REVIEW — R3-A — CORRECTIONS BINDING ON THE CODER (Planner 2026-09-12)

**Diagnoses accepted.** R3-A1's finding is **Planner-verified by grep** and is the most valuable output of this round. `getBaseDbId` (`lib/systemDatabases.ts:61`) was read, not invented. The `DatabaseClone` line numbers were read from the current file and supersede the older ones cited in this spec. Five corrections.

### C1 🟥 The test command does not exist — `jest` is not installed
The plan runs `npx jest tests/…`. There is **no jest** in `package.json` and no `node_modules/.bin/jest`; `npx` would attempt to fetch it from the registry. The harness is Node's built-in runner, and the directory form now throws `ERR_UNSUPPORTED_DIR_IMPORT`:
```bash
npm run test:compile      # this repo's script for `tsc --noEmit`
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```
Also: the suite is **70 tests across 5 files**, not 65 across 4. The omitted file is `tests/i18n.test.ts`, which is **currently red** on ~16 missing keys — a **pre-existing** failure (`I18N-MISSING-KEYS`), not caused by this work and not to be "fixed" by deleting keys or skipping the test.

### C2 🟥 `string | null` will NOT be caught by the compiler at the call sites that matter
`getDatabaseRoute` is consumed inside **template literals**:
```js
router.push(`/${locale}${getDatabaseRoute(resolvedTargetDbId, newPage.id)}`);   // LinkedRecords.tsx:103
router.push(`/${locale}${getDatabaseRoute(lp.db.id, lp.page.id)}`);             // LinkedRecords.tsx:478, 491, 533, 545
router.push(getDatabaseRoute(db.id, pageId));                                    // TaskModuleShell.tsx:406
```
**TypeScript does not error on `null` inside a template literal.** `${null}` stringifies to `"null"`, so the change would silently route to `/nl null` instead of failing loudly — the opposite of this item's intent, and `tsc --noEmit` would stay green.
**Required:** every call site takes an **explicit null check before use** — all **6 in `LinkedRecords.tsx`** (:103, :478, :491, :533, :545 and any other) plus **`TaskModuleShell.tsx:406`**. The plan names only two files and a third, unidentified `page.tsx` — **name the exact file and line, or drop it.** Verify with `grep -rn "getDatabaseRoute" src` before and after: every call must be guarded.

### C3 🟧 R3-A2's diagnosis is probably incomplete — the mount effect is not the whole bug
The effect at `PageModal.tsx:610-624` has **`[]` deps — it runs once, on mount.** That explains focus being stolen *when the record opens*. Florin's report was *"paste always lands in the NAME/title property, **no matter where you click**"*, which suggests it also happens **mid-session**, after mount.
**Hypothesis to test before calling this fixed** — the same file already stops keydown reaching DSG's document-level listeners:
```js
e.nativeEvent.stopPropagation(); // Stop native keydown bubbling to window/document (DSG listeners)
```
There is **no equivalent guard for `paste`**. If DSG has a document-level paste handler still live while the modal is open, paste goes to **the grid's active cell** — which is typically the **title** cell. That would match the symptom exactly and the mount-focus fix would not touch it.
**Required:** reproduce **mid-session** (open a record, click a non-title field, wait, paste). If it still lands in the title, the cause is the document-level listener, not mount focus. **Do not close R3-A2 on the mount fix alone.**

### C4 🟧 `defaultPropsSeeded` does not help the views that already exist
New flag, correct idea. But **no existing view has it**, so for all of them the guard falls back to `!propertiesState || length === 0` — the same "absence of state = never configured" inference that is the bug. A view whose user hid columns has state and is safe; a view legitimately showing everything may be re-seeded once more.
**Required:** when the effect seeds **or** when it decides not to seed, write `defaultPropsSeeded: true` so every view is flagged after one pass and the inference is never consulted again.
**Also:** the seeding path calls `syncDb` — a **server write on mount**. Confirm it is skipped entirely when nothing changed (no gratuitous `updatedAt` bump — `OCC-5-CRON-NO-OP-WRITES`), and that the neighbouring every-mount `[Schema Enforcement]` effect at `DatabaseClone.tsx:729-734` is likewise a no-op when the type already matches.

### C5 🟧 R3-A1 is a live gap — it should not wait for R2
The finding is correct and it means **the record detail, the store and the server actions can all edit an accountant-exported document today**. R2-1 is weeks away. Deferring leaves a legally-relevant record unprotected for that whole window.
**Do not add the check in three places** — that is the sideways copy this pass exists to end.

**⚠️ PLANNER CORRECTION (same day):** this first said to place it in `src/app/actions/pages.ts`. **Wrong.** `updatePageServerFirst` has only 2 callers; the store's sync queue — which is what the grid, the record detail and every other surface actually write through — calls **`saveGlobalPage`** (`store.ts:476`, imported at `store.ts:6`). The rule therefore lives in **one shared module** (`src/lib/records/export-lock.ts`) invoked at each existing door: `saveGlobalPage`, `saveGlobalPagesBatch`, `updatePageServerFirst`. One implementation, three call sites — three *implementations* would be the sideways copy. `R2-1` collapses the doors later and the rule moves with them.

**APPROVED by Florin 2026-09-12.** Full instructions: `coder-directive-r3a.md`.

### Accepted, no change
Per-item commits tagged with the item id · `tabIndex={-1}` + guard ref approach on the modal container · returning `null` rather than a dead-end route (the return type is right; only the call sites need C2) · leaving DSG untouched throughout.

---

## THE WORK

### R3-A · DO NOW — independent of both the core and the grid component

- [x] **R3-A1 · Does the `accountantExportedAt` edit lock exist outside the grid?** 🟥🟥
  The lock lives inside `NotionGrid.tsx`'s `onChange`. If that is its only home, **the record detail, the engines and the API have been able to edit accountant-exported documents all along** — a legally-relevant record we have already told the accountant is final. **Check before anything else in R3.** If confirmed, it is not a grid item at all: the rule belongs in the core (R2-1) and is a P0 of its own.
  *Completed (commit `672c264`): Core enforcement implemented in `src/lib/records/export-lock.ts` and checked across `saveGlobalPage`, `saveGlobalPagesBatch`, and `updatePageServerFirst` with unit tests.*
- [x] **R3-A2 · `RECORD-DETAIL-PASTE-FOCUS`** 🟧 — paste always lands in the NAME/title property regardless of the focused field. This is the **record detail**, not the grid; unaffected by GRID-REPLACE either way.
  *Completed (commits `6e88e1b`, `f7af3ef`, `4b612f8`, `139d3dc`): Mount focus stealing fixed, and document-level DSG listener leakage shielded via `src/hooks/useOverlayEventShield.ts` across admin modal dialogs.*
- [x] **R3-A3 · `ROUTER-DEFAULT-NO-DEADEND` + relation link-through (`N2`)** 🟧 — the router `default:` dumps any unmapped database id onto `/admin/dynamic-db`, a mock that ignores `?open`. Fix the router: an unmapped id dead-ends **loudly**. Then re-test the relation icon — the routing half is not DSG-coupled and may be the whole of N2. Trace before fixing.
  *Completed (commit `756d774`): Canonical database routing in `src/lib/databaseRoute.ts` with explicit null guards and toast warnings across all 7 call sites.*
- [x] **R3-A4 · `DB-VIEW-PROPSTATE-NOT-STICKING`** 🟧 — column show/hide does not survive. Root traced: the every-mount default-seeding effect at `DatabaseClone.tsx:727-738` re-seeds over the user's choice. *Absence of state ≠ never configured.* Lives in `DatabaseClone`, **not** in DSG, so it survives the replacement. Carries `DB-SCHEMA-VISIBILITY-BTN` with it.
  *Completed (commit `a3f64a4`): Persistent `defaultPropsSeeded: true` flag in `DatabaseClone.tsx` and `types.ts` prevents re-seeding on reload.*

### R3-B · GRID-REPLACE — the vehicle (after R2)
Phases as specified in `ground-zero-triage.md:1196-1200`, with these **binding additions** from the systems pass:

- [ ] **R3-B1 · V2 consumes the core intent API. It does not port the diff loop.** 🟥
  `NotionGridV2` emits `{ pageId, field, value }` at the moment of the edit (R2-2). **The `onChange(newRows)` whole-row diff against a render-time snapshot is not reimplemented in any form** — that mechanism is N1 (traced in the appendix below) and it dies with DSG. V2's equivalent of `onChange` handles **row insert and row delete only**.
- [ ] **R3-B2 · Record rules move DOWN, they do not move across.** 🟥
  Everything in today's `onChange` that is a *record* rule belongs in the core where every surface inherits it: skip `rollup`/`formula` · skip engine-computed totals (`totalExVat`/`totalVat`/`totalIncVat`) · the `accountantExportedAt` lock. **Porting them into V2 would be a sideways copy into a brand-new file** — the exact defect shape this pass exists to end. Per the ERROR-SURFACING DIRECTIVE, a blocked edit **says why**; today it `return`s silently.
- [ ] **R3-B3 · Tenant-ready by construction.** 🟥
  Every V2 read goes through R1's accessor. **No client-built id map as a scope filter** — `WORKHUB-SHIFTS-FILTERED-BY-EMPLOYEE-MAP` was exactly that, fed by a `.catch(() => [])`, and it hid 37 shifts. View/filter/sort state keyed per tenant **and** per database, cleared on tenant switch.
- [ ] **R3-B4 · Parity is proven, not assumed.** 🟧
  The flag flips only when V2 matches V1 on a written checklist across 2+ databases: filters, sorts, column reorder, sticky header, selection, keyboard, copy/paste, VAT lookup, accountant date range, rollups, formulas, relations.
- [ ] **R3-B5 · Delete DSG and the flag.** 🟧 A retained fallback is a sideways copy with a polite name.
  *Temporary scaffolding cleanup:* Delete `src/hooks/useOverlayEventShield.ts` and remove `useOverlayEventShield` call sites from modal dialogs (`PageModal.tsx`, `TicketCaptureModal.tsx`, `QuoteSendModal.tsx`, `AiDocumentImportModal.tsx`, `FormulaEditorModal.tsx`, `CreateClientModal.tsx`, `CreateProjectModal.tsx`, `InlineDialog.tsx`, `Modal.tsx`, `VariantsPropertyEditor.tsx`). The shield exists solely because DSG registers global document listeners (`useDocumentEventListener`); TanStack Table operates strictly within its own DOM hierarchy and does not leak document listeners. Note: `ProjectDetailView.tsx` is not an overlay and was excluded. An overlay that adopts the shield must register its own document listeners in capture phase (`useCapture = true`).

### R3-C · FROZEN UNTIL GRID-REPLACE 🧊
No further work inside `NotionGrid.tsx`, `hooks/useGridColumns.tsx` or `columns/*` — including `GRID-3` (column resize) and the remaining DSG quirks. They are defects of DSG's cursor/edit model, which is the thing being removed. **Fixing them now is paying twice for something we are throwing away.** Exception: a data-loss or security defect, which gets a minimal patch and a note here.

## VERIFY
1. **R3-A1 answered in writing** — with the file and line where the lock is enforced, or the confirmation that it is not.
2. Paste into a non-title field lands in that field.
3. An unmapped database id dead-ends loudly; the relation icon routes correctly from grid, record detail, engine and portal.
4. Hide two columns → reload → switch database and back → still hidden.
5. After R3-B: type a name, click straight to the date cell, click away → **both persist**. 10×, and with three cells, and across a sort and a row delete.
6. A blocked edit **says** why it is blocked.
7. `grep` for a whole-row diff in V2 returns nothing.

---

## APPENDIX — N1, traced (kept: it is the acceptance criterion for R3-B1)

`components/admin/database/NotionGrid.tsx:1127`:
```js
onChange={(newRows) => {
    newRows.forEach((newRow) => {
        const oldRow = rowData.find(r => r.id === newRow.id);   // ← a render-time SNAPSHOT
        database.properties.forEach(prop => {
            if (newVal !== undefined && isDifferent) {
                updatePageProperty(database.id, oldRow.id, prop.id, newVal);
            }
        });
    });
}}
```
The grid already writes **field-level** — the race is one level up, in deriving the change by diffing a whole row against a snapshot. `TitleColumn` holds typed text in local state and commits on **blur** (`TitleColumn.tsx:44`); clicking from the name cell to the date cell fires two diff passes against pre-edit snapshots, and one field computes as "not different" and is dropped. **The typed name is discarded with no error, because from the diff's point of view nothing changed.**
