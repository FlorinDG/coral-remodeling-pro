# CORAL — R3 · THE RECORD SURFACE (the grid) — root spec (Planner 2026-09-12)

Governed by `coral-systems-pass.md`. **Third. Depends on R2** — see the correction below before scheduling it.

> **INVARIANT:** *A cell edit commits its own field and nothing else. A view's state is where the user last put it.*

---

## N1 — THE MECHANISM, TRACED

`components/admin/database/NotionGrid.tsx:1127` — the grid's `onChange`:
```js
onChange={(newRows) => {
    newRows.forEach((newRow) => {
        const oldRow = rowData.find(r => r.id === newRow.id);      // ← a SNAPSHOT
        database.properties.forEach(prop => {
            const newVal = newRow[prop.id];
            const oldVal = oldRow.properties[prop.id];
            if (newVal !== undefined && isDifferent) {
                updatePageProperty(database.id, oldRow.id, prop.id, newVal);
            }
        });
    });
}}
```

**A correction to what I told Florin earlier, for accuracy:** the grid does **not** do a whole-row write — it already calls the field-level `updatePageProperty`. The race is one level up. Each change is derived by **diffing the whole row against `rowData`**, a snapshot of store state captured at render. So it is still a read-modify-write, but of the *diff*, not the write.

**How the name is lost.** `TitleColumn` holds the typed text in local React state (`inputValue`) and commits only on **blur** (`TitleColumn.tsx:44`). Click from the name cell to the date cell and two `onChange` passes fire against snapshots taken before either landed. The date pass diffs a `newRow` whose title is still the old value, the title pass diffs against a row that may already have been replaced — and one of the two fields is computed as "not different" and dropped. **The typed name is discarded without any error, because from the diff's point of view nothing changed.**

**Why this is R2's problem, not the grid's:** a field intent emitted *at the moment of the edit* cannot be lost by a later diff of a stale row. R2-2 removes the mechanism. Rebuilding the grid's commit logic before that lands means building it twice — and the last three grid fixes each became the next grid bug for exactly this reason.

---

## THE WORK

### R3-0 · THE GRID STOPS BEING A SYSTEM AND BECOMES A VIEW (Florin 2026-09-12) 🟥
The same inverted-pyramid logic as R1/R2. A cell **does not own commit logic** — it emits an intent to the core, exactly like the engine, the record detail and the portal do. Every rule currently living inside the grid's `onChange` that is really a *record* rule (computed-field skip, the `accountantExportedAt` edit lock) **moves down** to the core, where every surface inherits it — today those locks exist only in the grid, so the same edit through the record detail is unprotected. What stays in the grid is presentation: selection, keyboard, rendering, row insert/delete.

### R3-1 · CELL EDITS EMIT INTENTS 🟥 — *after R2-2*
- [ ] Each column component emits `{ pageId, field, value }` **when the edit is made**, not on a whole-row diff. `onChange` keeps only what it is genuinely for: **row insert and row delete**.
- [ ] Cell-local state (`TitleColumn.inputValue` and every editor that mirrors it) commits on change or on blur **to the intent stream** — never by mutating a row object the grid will later diff.
- [ ] Delete the snapshot diff loop. It is the defect, not the mechanism to repair.
- [ ] The rules in that loop **move down to the core** (R3-0), they do not move to another grid file: skip `rollup`/`formula` · skip engine-computed totals (`totalExVat`/`totalVat`/`totalIncVat`) · the `accountantExportedAt` edit lock. **Verify each against the record-detail path too** — if the lock only ever existed in the grid, the record detail has been able to edit exported documents all along. **The lock currently `return`s silently** — per the ERROR-SURFACING DIRECTIVE it must tell the user why the cell is read-only.

### R3-2 · VIEW STATE PERSISTS 🟧 — `DB-VIEW-PROPSTATE-NOT-STICKING`
- [ ] Column show/hide set in the database header does not survive. Root already traced: the **every-mount default-seeding effect** at `DatabaseClone.tsx:727-738` re-seeds property state over the user's choice. *Absence of state ≠ never configured* — seed once, explicitly, and record that seeding happened.
- [ ] `DB-SCHEMA-VISIBILITY-BTN` (a show/hide toggle beside the trash icon in the schema editor) is the same state; do it in this pass.

### R3-3 · RELATION LINK-THROUGH 🟧 — `N2`
- [ ] The link-back icon on relation fields does not route on many surfaces. **Not yet investigated** — first commit is a traced root cause, not a fix. Suspected: `ROUTER-DEFAULT-NO-DEADEND` (the router `default:` dumps any unmapped database id onto `/admin/dynamic-db`, which ignores `?open`).
- [ ] Fix the router default at the same time: any unmapped id must dead-end **loudly**, not silently render a mock.

### R3-4 · PASTE LANDS WHERE THE CURSOR IS 🟧 — `RECORD-DETAIL-PASTE-FOCUS`
- [ ] Paste always lands in the NAME/title property regardless of the focused field.

### R3-5 · TENANT-READY BY DESIGN 🟧
- [ ] Every grid read goes through R1's accessor; **no client-built id maps used as a scope filter**. *(`WORKHUB-SHIFTS-FILTERED-BY-EMPLOYEE-MAP` was exactly that, fed by a `.catch(() => [])` — it hid 37 shifts.)*
- [ ] View/filter/sort state is keyed per tenant **and** per database, and cleared on tenant switch.

## VERIFY
1. Type a name, click straight to the date cell, then elsewhere → **both** values persist. Repeat 10×, and with three cells.
2. Same across a row-delete and a sort in between.
3. Hide two columns, reload, switch database and back → still hidden.
4. Relation link icon routes to the right record on grid, record detail, engine and portal.
5. Paste into a non-title field lands in that field.
6. An `accountantExportedAt`-locked cell **says** it is locked.
7. All tests green.

## ORDER
**R2-2 must be merged first.** Then R3-1 → R3-2 → R3-5 → R3-3 → R3-4.
R3-2/3/4 are independent of R2 and can be done any time if Florin wants visible progress sooner; **R3-1 cannot.**
