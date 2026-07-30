# CORAL — MEMORY / FORCED-RELOAD INVESTIGATION (Planner, 2026-07-29)

**Florin:** *"A few times I had a forced reload of the app because it used too much memory. There might be some RAM leak in some scenario."*

**Finding: it is not a classic leak (closures, stray listeners, uncleaned intervals). Those are near-clean. It is architectural — the client holds the entire tenant dataset and re-serialises all of it on every store mutation.**

---

## 🟥 ROOT CAUSE — the whole database is in the browser, and it's stringified on every edit

**Three facts that compound:**

1. **The server sends every page of every database, blocks included.**
   `app/actions/global-databases.ts:20-22`
   ```js
   const dbs = await prisma.globalDatabase.findMany({
       where: { tenantId },
       include: { pages: true },     // ← ALL pages, including the `blocks` JSON tree
   });
   ```
   Production currently holds **9,776 `GlobalPage` rows**; total DB size ≈ **52.7 MB**, most of it `blocks`/`properties` JSON. All of it is hydrated into the Zustand store.

2. **The persisted slice excludes almost nothing.**
   `store.ts:1637-1642` — `partialize` drops only `undoStack` and `_hasHydrated`. So **`databases` — all pages, all blocks — is part of the persisted payload.**

3. **Zustand `persist` writes on EVERY state change, with no throttle.**
   `storage: createJSONStorage(() => idbStorage)` and `idbStorage.setItem` writes straight through (`store.ts:73-75`). Each mutation therefore performs a **full `JSON.stringify` of the entire dataset** and an IndexedDB write.

**The failure mode:** the quote/invoice engine calls `updatePageBlocks` on essentially every edit. Each call → stringify tens of MB → allocate a huge transient string → write to IDB → discard. Sustained editing produces continuous multi-megabyte allocation churn and GC pressure, which is exactly what ends as *"the app used too much memory"*. It gets worse the longer a session runs and the more the tenant's data grows.

*(Corroborating: the build already needs `--max-old-space-size=4096`.)*

---

## FIXES — ranked by payoff per unit of risk

- [ ] **MEM-1 · THROTTLE THE PERSIST WRITES** 🟥 *(cheapest real win — do this first)*
  Wrap `idbStorage.setItem` in a **trailing debounce (~1000–2000 ms)**, coalescing a burst of edits into a single serialise+write. Flush on `visibilitychange`/`beforeunload` so nothing is lost on tab close. Collapses hundreds of full-dataset serialisations into one. ~15 lines, no architectural change.

- [ ] **MEM-2 · STOP PERSISTING `blocks`** 🟧
  Blocks are the bulk of the payload and the part that changes most. Persist page **metadata** (id, databaseId, properties, order, `baseUpdatedAt`, `blocksVersion`, dirty flags) and **omit `blocks`** for pages that are not dirty; re-fetch them from the server on open. Keep blocks for **dirty** pages only — that preserves the offline/unsynced-edit protection that `DATA-PERSIST-INTEGRITY` exists for, at a fraction of the size.

- [ ] **MEM-3 · DON'T SHIP THE WHOLE TENANT TO THE CLIENT** 🟧 *(the root fix)*
  `getGlobalDatabases` should return **schemas + views + counts**, and pages only for the database actually being viewed (or a bounded page window). Today opening the app loads every invoice, quote, expense, task, article and project — including every block tree — to render one grid. This also removes the `include: { pages: true }` cost on the server.

- [ ] **MEM-4 · TWO SMALL LISTENER LEAKS** 🟨
  Listeners are otherwise well balanced (101 added / 100 removed) — only two files add without removing:
  - `app/[locale]/layout.tsx` (+3 / −0) — root layout, mounts once, so bounded; still worth cleaning.
  - `components/admin/database/views/TimelineView.tsx` (+2 / −1) — **one listener leaked per mount**; accumulates if the view is opened repeatedly.
  Timers are clean (6 `setInterval` / 7 `clearInterval`).

- [ ] **MEM-5 · UNDO STACK HOLDS FULL SNAPSHOTS** 🟨
  `UNDO_STACK_LIMIT = 50` and `deletePage` captures the **entire page** (blocks included) for undo. Bounded, but 50 large quotes is tens of MB held live. Consider storing a diff, or capping by payload size rather than entry count. *(It is correctly excluded from persistence already.)*

---

## HOW TO CONFIRM (10 minutes, in the browser)
1. DevTools → **Memory** → heap snapshot right after load; note the size.
2. Edit a quote for ~60 s, take a second snapshot. **Compare retained size of the store and look for repeated large strings.**
3. DevTools → **Application → IndexedDB → `coral-database-storage-v4`** — read the stored value's size. That is the number being stringified on every mutation.
4. **Performance** tab, record while typing in the engine: repeated long tasks with large GC sawtooth confirms MEM-1.
*(I could not measure the payload from here — Chrome disconnected mid-investigation. The numbers above come from row counts and DB size.)*

## NOTE
This is very likely also a large part of the general sluggishness — not just the crashes. MEM-1 alone should be noticeable immediately, and it carries almost no risk.
