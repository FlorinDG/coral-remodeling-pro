# CORAL — 🟥🟥 LAZY-LOAD REGRESSION — surfaces that never ask for their pages show nothing — Planner 2026-09-12

**Florin, live:** *"On desktop, in develop → tasks there are no tasks. On mobile I see them."*

Same tenant, same database, two surfaces disagreeing. **Traced: this is a `MEM-3c` regression, and tasks is only the instance he happened to open.**

---

## THE MECHANISM

```ts
// src/lib/feature-flags.ts:84
export const IS_LAZY_DATA_ENABLED = process.env.NEXT_PUBLIC_LAZY_DATA !== 'false';
```
**Lazy loading is ON unless explicitly disabled** — so it is on in every environment by default.

Under lazy loading a database's `pages` array is empty until something calls `loadDatabasePages(databaseId)`. **Exactly four files call it:**
```
src/app/[locale]/m/tasks/page.tsx          ← the new mobile page (built to the directive)
src/components/admin/database/PageModal.tsx
src/components/admin/database/DatabaseClone.tsx
src/components/admin/database/store.ts
```

**`TaskModuleShell.tsx` does not.** It reads:
```ts
const db = useDatabaseStore(state => state.getDatabase('db-tasks'));   // :34
```
…gets a database whose pages were never requested, and renders an empty list. **Plus** it uses the **bare** `'db-tasks'` id rather than `resolveDbId('db-tasks')` — a second, independent defect (the R1 fail-open seam, `TASK-X1`).

**The failure is silent.** No error, no spinner, no "not loaded" state — just an empty list, which reads as *"I have no tasks"* rather than *"this screen did not ask for them."* Silent-failure shape, in a feature whose whole job is to be trusted.

---

## 🚨 THE PART THAT MATTERS MORE THAN TASKS

**53 files read databases from the store. Four request pages.** Most of the 53 are children rendered inside `DatabaseClone`, which does request — they are fine. **The exposed set is top-level surfaces that mount independently.**

Routes that use the store **without** `DatabaseClone`:
```
app/[locale]/admin/journal/page.tsx
app/[locale]/admin/settings/databases/page.tsx
app/[locale]/admin/projects-management/bordereau/[id]/page.tsx
app/[locale]/admin/projects-management/po/[id]/page.tsx
app/[locale]/m/clients/page.tsx
app/[locale]/m/expenses/page.tsx
app/[locale]/m/invoices/new/page.tsx
app/[locale]/m/tasks/page.tsx                    ← correct; built to the directive
```
plus independently-mounted components: `TaskModuleShell`, `ProjectDetailView`, the cockpit and dashboard widgets, `CalendarView`/`GanttView`/`TimelineView` when mounted outside a grid.

**`bordereau/[id]` and `po/[id]` are client-facing project documents.** If they render from store pages and never request them, they are showing incomplete documents right now — and nobody would see an error.

---

## THE WORK

### LAZY-1 · SWEEP — find every exposed surface 🟥🟥 **first, before fixing tasks**
- [ ] For each route/component above: does it read `.pages` (directly, or via a hook that does) **without** a `loadDatabasePages` for that database? Produce the table: surface · databases it reads · requests them Y/N · **currently broken Y/N**.
- [ ] **Report before fixing.** Florin is running his business on this; he needs to know which screens are lying to him today, and that list is worth more than any individual fix.

---

## ✅ LAZY-1 RESULT (coder, 2026-09-12) + PLANNER VERIFICATION

**19 surfaces audited, 16 broken, 3 correct.** Report accepted — it is thorough, it named the client-facing cases, and it changed no code as instructed. Planner spot-checked and confirms `UniversalSearch.tsx:166-167` iterates `db.pages` across every database, so it genuinely cannot find anything not already visited.

### 🟢 THE FACT THAT CHANGES THE URGENCY — **production is NOT affected**
```
git show main:src/lib/feature-flags.ts | grep IS_LAZY_DATA_ENABLED   →  0
```
**`MEM-3` is not on `main`.** The lazy-loading flag does not exist in production; `main` is 99 commits behind `develop`. So none of these 16 surfaces is broken for Florin's live business today.

**This is a PROMOTION BLOCKER, not an outage.** It must be clean before `develop` reaches `main` — but nobody is losing work this afternoon, and that means `LAZY-2` gets done properly rather than hot-patched.

⚠️ **One accuracy note for the coder:** the report's column is headed *"Observed Live Failure Mode"*. These are **inferred from code**, not observed running. The inference looks correct, but our whole discipline is the distinction between the two — label inference as inference.

### 🔴 PLANNER CORRECTION — **roughly half of the 16 must NOT be fixed with `loadDatabasePages`**
The report treats all 16 as the same defect. They are two different defects, and conflating them would undo `MEM-3`:

| Class | Surfaces | What they actually need |
|---|---|---|
| **A · needs ROWS** — renders the records themselves | 1, 2 Tasks · 3, 4 Journal · 5, 6 bordereau/PO · 7 Gantt · 8 ProjectDetail tabs · 9 Clients · 10 Expenses · 12, 13 engines (the document being opened) | the database's pages — `LAZY-2`'s accessor |
| **B · needs LABELS ONLY** — a picker or a chip | 11 client picker · 12, 13 client/project/article pickers *inside* the engines · 14 supplier + project dropdowns · 15 TicketCapture project/supplier · 16 Cmd+K search | **the `pageIndex` that is already in memory** — `{id, databaseId, title, updatedAt}` |

**Class B must be fixed with the index, not by loading databases.** Loading `db-clients`, `db-suppliers`, `db-articles` and `db-1` to populate dropdowns re-inflates exactly the payload `MEM-3` removed — and `db-articles` is one of the larger ones. **`MEM-3a` built the index for precisely this.**

**`UniversalSearch` (16) is the clearest case and must not be "fixed" by loading everything.** Searching all databases is not a hydration problem: it searches the **index** (which carries titles), and full-text beyond titles becomes a **server query** — never "load every database so I can filter it client-side".

**The classification above is the Planner's and is GIVEN — the coder does not need to derive it and must not wait for it.** Verify it against the code as you go; if a surface is in the wrong class, **say so in the report and put it in the right one**. Only stop if a surface fits **neither** class. A class-B surface fixed as class A is a regression disguised as a fix — that is what this table prevents.

### LAZY-2 · MAKE THE FAILURE IMPOSSIBLE, NOT MERELY FIXED 🟥
Patching call sites one by one guarantees the next new surface repeats it. **The root fix:** reading pages for a database that has not been loaded must **not** silently return empty.
- [ ] **Step 0 — take the A/B table above as given.** Verify each surface against the code while implementing; correct any misclassification in the report. **Do not pause for approval of the split.**
- [ ] **Class B uses the index.** A `useLabelsOf(databaseId)` reading `pageIndex` — no network, no hydration, works offline. `UniversalSearch` searches the index; anything deeper is a server query, never a client-side scan of loaded databases.
- [ ] A store accessor — `usePagesOf(databaseId)` — for class A, that **requests the database if it is not loaded** and returns an explicit `{ pages, status: 'loading' | 'ready' | 'error' }`. Consumers render a loading state, never an empty one.
- [ ] `getDatabase(id).pages` for an unloaded database returns a value that a consumer **cannot mistake for "empty"** — and in development it warns loudly with the database id and the calling surface.
- [ ] This is the `MEM-3` half that was never built: `MEM-3c` made loading lazy, but nothing made *not-loaded* distinguishable from *empty*.

- [ ] **Cross-database surfaces must not waterfall.** `ProjectDetailView` reads **six** databases; the accessor must request them together, not sequentially, and report a single aggregate status.

### LAZY-3 · FIX THE TASK MODULE 🟧 — **fence exception, granted**
`TaskModuleShell.tsx` is inside the frozen `components/admin/tasks/` directory. **This is a live visibility regression on a surface Florin uses, which the fence's data-loss/security exception covers.** Minimal change only:
- [ ] `resolveDbId('db-tasks')` instead of the bare id — all 5 sites (`:34`, `:59`, `:102`, `:109`, `:138`).
- [ ] Request the database's pages (via `LAZY-2`'s accessor once it exists, or `loadDatabasePages` directly in the interim).
- [ ] **Nothing else in that file.** No UI changes, no refactor.

### LAZY-4 · THE FLAG DEFAULT 🟨
- [ ] `IS_LAZY_DATA_ENABLED` defaults to **on**. `coral-mem3-lazy-data.md` specified `MEM-3c` as **"behind a feature flag… old path stays one toggle away until it's proven on real data."** A flag that is on by default in every environment is not that. **Either** flip the default to off until `LAZY-1`'s sweep is clean, **or** state explicitly that it is now the permanent path and delete the flag. Not the current middle state.

## VERIFY
1. `LAZY-1`'s table exists and names every currently-broken surface.
2. Desktop `/admin/tasks` shows the same tasks as `/m/tasks`. Same count.
3. A surface reading an unloaded database shows **loading**, never a silent empty list.
4. In development, an unrequested read **warns**, naming database and caller.
5. `bordereau/[id]` and `po/[id]` render complete documents on a **cold direct visit** (new tab, no prior grid visit) — that is the failing case.
5b. Opening a quote or invoice from an emailed link in a fresh session renders the document, not "Not Found".
5c. Cmd+K finds a record in a database never opened this session — **without** that database being loaded (check the payload).
6. `npm run test:compile` · `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'`

## ROOT CAUSE, FOR THE RECORD
`MEM-3c` changed a global invariant — *"the store holds every page"* — and updated the three surfaces its author was looking at. Every other consumer still assumes the old invariant, and the new one fails **silently** rather than loudly. This is the same lesson as `R1`/`R2`: *an invariant that is not enforced mechanically will be violated by the code nobody reviewed.* `LAZY-2` is the enforcement that was missing.


---

# 🔁 COURSE CORRECTION — `LAZY-5` IS CANCELLED, ABSORBED INTO `R2-4` (Florin, 2026-09-12)

> *"We wasted time then… or am I reading this vice versa, and lazy load should be off by default, since our hybrid read/load takes over?"*

**Florin is reading it correctly, and the Planner had it backwards.**

## THE FLAG IS AN ARTEFACT OF THE OLD MODEL
`IS_LAZY_DATA_ENABLED` switches between **two configurations of the same model** — *"the store holds every database"* versus *"the store holds some databases"*. Both are the store-holds-databases model. **The hybrid decided in `R2-6(c)` replaces that model outright:**

```
INDEX          always loaded   (already unconditional at m/layout.tsx:107 — correct today)
WORKING SET    persisted, offline-complete
EVERYTHING ELSE per-view query
```

**There is no "lazy on/off" question in that world**, because there is no "holds everything" mode to fall back to. **So the flag does not get switched back on — it gets deleted when the hybrid lands.**

## WHY `LAZY-5` WAS THE WRONG ITEM
`LAZY-5` said: *migrate the remaining ~15 surfaces onto `usePagesOf`, then turn the flag back on.* That is **finishing the old model.** `R2-4` says: *move those same surfaces onto the hybrid.* **Same 15 surfaces, two different destinations — and doing `LAZY-5` first would touch every one of them twice.** Precisely the fix-it-twice failure this pass exists to stop, and it was one item away from happening.

- [x] **`LAZY-5` — CANCELLED.** Folded into `R2-4`.
- [ ] The ~15 surfaces migrate **once**, to the hybrid, as part of `R2-4`.
- [ ] **`IS_LAZY_DATA_ENABLED` is deleted in that same commit**, not re-enabled.

## WHAT WAS AND WASN'T WASTED — the honest accounting
| Work | Verdict |
|---|---|
| `LAZY-1` sweep | **Kept.** It is the discovery — 16 broken surfaces, and the client-facing ones named. |
| `LAZY-2` `usePagesOf` / `useLabelsOf` | **Kept, and load-bearing.** This is exactly the hybrid's accessor. It was the seam whichever way `R2-6` went, which is why it was built before the decision. |
| `LAZY-3` `TaskModuleShell` | **Kept.** Fixed the symptom Florin reported. |
| `LAZY-4` flag off | **Kept, and now effectively permanent** until the flag is deleted. |
| `MEM-3a` page index | **Kept.** Loaded unconditionally, used by the mobile project picker today, and it is the hybrid's INDEX layer. |
| `MEM-3b` `getDatabasePages` / schema split | **Kept.** The hybrid's per-view query needs exactly these server actions. |
| **`MEM-3c` lazy per-database loading** | **Superseded.** This is the one piece the hybrid replaces. |

**So: one piece of `MEM-3` is superseded, not the work around it.** The index, the split server actions and the accessor are all foundations the hybrid consumes.

## ⚠️ ONE INEFFICIENCY TO FIX MEANWHILE
With the flag off, `m/layout.tsx` calls **`getGlobalDatabases()` (full hydration) AND `getGlobalPageIndex()`** — both. That is heavier than either model alone: every page plus a full index. It is not breaking anything, but it is the worst of both until `R2-4` lands. **Noted, not urgent** — do not patch it separately; it disappears with the hybrid.
