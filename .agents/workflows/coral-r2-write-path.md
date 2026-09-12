# CORAL — R2 · ONE WRITE PATH — root spec (Planner 2026-09-12)

Governed by `coral-systems-pass.md`. **Second root. Depends on R1-4 (the accessor is where the scope gets enforced).**

> **INVARIANT:** *There is exactly one way a record change reaches the database, and exactly one authority on what "current" means.*

---

## THE FINDING — five doors into one table

| Door | Callers (outside `actions/`) |
|---|---|
| `createPageServerFirst` | 14 files |
| `updatePageServerFirst` | 2 |
| `saveGlobalPage` | 1 |
| `saveGlobalPagesBatch` | 1 |
| **direct `prisma.globalPage.create/update`** | **17 files, 30 calls** |

Five ways to write one row, with **different** OCC behaviour, different tenant checks, and different system-write tagging. This is defect shape #1 (*two representations of one concept*) at the centre of the application — and it is why the OCC saga took five rounds: each theory was correct about *a* door.

**The client half compounds it.** `components/admin/database/store.ts` is **2,215 lines** and holds: the page cache, the page index, `syncQueue`, the undo stack, IndexedDB persistence, and the derived row data every view reads. "Current" is asserted in three places — server row, store page, and whatever a component is holding locally — and OCC-14 was precisely the server and store disagreeing about a timestamp.

---

## THE WORK

### R2-0 · LAYER RULE FIRST (Florin 2026-09-12) 🟥
The five doors are **one core plus four sideways copies** — see THE SHAPE in `coral-systems-pass.md`. The target is not "pick the best of five", it is **one kernel write plus thin adapters where the call shape genuinely differs**. Batch is the only genuine adapter (CSV import: 2,000 rows, one round-trip) and it calls the same core. Everything else is **deleted, not deprecated** — a retained alternate door is a sideways copy with a polite name.

### R2-1 · ONE SERVER WRITE FUNCTION 🟥
- [ ] A single `saveRecord(intent)` behind the R1 accessor. **Everything** else becomes a thin caller or is deleted. Behaviour it owns, in one place: tenant scope · OCC (`baseUpdatedAt` / `blocksVersion`) · system-write tag · `updatedAt` returned **from the persisted row** (OCC-14's gate — never a self-generated timestamp) · audit entry.
- [ ] `createPageServerFirst` / `updatePageServerFirst` / `saveGlobalPage` / `saveGlobalPagesBatch` keep their names as adapters during migration, then go. Batch stays a distinct entry point — it exists for a real reason (CSV import, 2,000 rows) — but it calls the same core.
- [ ] The 30 direct prisma writes are migrated or justified in writing, one by one. R1-5's gate makes this non-optional.

### R2-2 · WRITES ARE FIELD-LEVEL INTENTS, NOT ROW SNAPSHOTS 🟥 — *this is the fix for N1*
- [ ] The unit of change is `{ pageId, field, value, baseUpdatedAt }` — **not** a page object. A snapshot write makes every concurrent edit a conflict and every stale copy a data loss; a field intent makes them independent.
- [ ] Two intents for **different** fields of the same row must both land, in any order, with no conflict dialog. This is what OCC-3 (field merge) was reaching for; here it is structural rather than a merge heuristic.
- [ ] Blocks remain a whole-tree write, versioned by `blocksVersion`. That is correct and stays.

### R2-3 · ONE AUTHORITY ON "CURRENT" 🟥
- [ ] The server row is the authority. The store caches it; components never hold a third copy across a commit boundary.
- [ ] After a write, the store takes the **server's** returned row — `updatedAt`, `blocksVersion`, and merged fields — and no local reconstruction of them. *(OCC-14 was exactly this defect: the intended timestamp was returned instead of the persisted one, so `serverTime !== clientTime` was always true.)*
- [ ] Verify OCC-15's single-flight lock still holds after the refactor — `_enqueueSync` / queue processing must not allow two in-flight saves for one page. **Re-prove it; do not assume it survived.**

### R2-6 · DECIDE THE READ MODEL 🟥 — *added 2026-09-12 after Florin: "since we are rethinking the whole data flow model, is lazy loading still relevant?"*

**This item comes before `R2-4`, because it decides what `R2-4` is splitting.**

**The finding that prompted it: there are already TWO read models in this codebase, and nobody wrote that down.**
| Model | Where |
|---|---|
| Zustand store holding whole databases | `components/admin/database/store.ts` — the grid, engines, projects, journal… |
| Query-per-view (React Query `5.90.21`) | `useClockEntries`, `workhub/*`, wired in `AdminLayout` + `WorkHubProviders` |

Defect shape #1 at the architecture level. And **lazy loading (`MEM-3c`) is a mitigation of the first model, not a model** — which is exactly why it fails silently: every new surface must *remember* to request its pages, and forgetting produces an empty list rather than an error (`coral-lazy-load-regression.md`).

**Is lazy loading still relevant?** *Today, yes* — `R2` changes the **write** path and reduces nothing that the client pulls; without lazy loading we are back to 52 MB and 307 MB invocations. *As a destination, no.*

**The candidate destination — and the code is already drifting toward it:**
> **A small always-loaded index + per-view queries.** `MEM-3a` already built the index (`id`, `databaseId`, `title`, `updatedAt`, ~1–2 MB), and the index is what solves the crux `MEM-3` identified: cross-database reads want a **label**, synchronously — not a record. Everything else becomes a query for exactly what a screen renders. React Query is present and already doing this for timesheets.

### ✅ DECIDED — **(c) STATED HYBRID** (Florin, 2026-09-12)

> *"c) sounds the most encompassing. 99% will probably be under coverage, but experience shows us that the tenants will challenge the app in unbelievable ways, and we cannot and will not build an index of fringe cases now. A hybrid solution is the way, because signal to no signal while doing a site visit must not mean that the tenant all of a sudden cannot complete his work, or worse, look unprofessional in front of a client."*

**This rejects the Planner's framing of the offline requirement.** The brief offered *"capture a task in a basement"* versus *"open a quote on site and read the lines"* and guessed the first. **The real requirement is stronger than either:** a tenant standing on a site, in front of a client, losing signal, must still be able to **complete the work in front of them**. Not just capture — finish.

**The three layers, and the boundary between them:**

| Layer | Contents | Availability |
|---|---|---|
| **INDEX** | `{id, databaseId, title, updatedAt}` for everything (`MEM-3a`, ~1–2 MB) | **always, offline** — every label, chip and search resolves |
| **WORKING SET** | the records for the job at hand — the project, its tasks, its documents, the client, recent quotes/invoices | **persisted and offline-complete** |
| **EVERYTHING ELSE** | the long tail: old records, other projects, archives | **per-view query, online** |

**Two design rules fall out of Florin's reasoning, and they are binding:**

1. **Degrade gracefully, do not enumerate.** *"We cannot and will not build an index of fringe cases."* The design must behave sanely for the **unanticipated** request, not carry a list of anticipated ones. An uncached record offline shows an honest, specific state — never a blank screen, never a wrong number, never a silent empty list. This is exactly what `LAZY-2`'s `{pages, status}` contract is for, with `status` extended to cover *offline-unavailable* as a first-class value distinct from loading, error and empty.
2. **The tenant must know what they have with them BEFORE they lose signal.** Looking unprofessional in front of a client is prevented by knowing in the van, not by discovering on the scaffold. So the working set is **visible and, where it matters, chosen** — not a cache the user has to guess at. *(Consistent with the standing principle: automation is good, the user remains the ultimate authority.)*

**Consequences for the work:**
- `R2-4` is re-cut: **not** "split the store into four parts" but **"shrink the store to INDEX + WORKING SET + sync queue"**. The general page cache goes; the parts that make a site visit survivable stay.
- Dirty-page protection and the sync queue are **untouchable** — they are the write half of the same promise.
- What defines a working set (explicit pin? today's scheduled shifts? last-opened?) is a **separate design item**, `R2-7`, and it is a **Florin decision** when it comes up. Do not infer it.
- `LAZY-2` is unchanged and still first — the accessor is the seam this whole decision depends on.

- [x] **Decided: (c) stated hybrid.** Recorded above.
- [ ] **`R2-4` follows from it.** As written, `R2-4` *splits* the store (cache / sync / undo / persistence) — which **preserves** the model. Under (b) the work is different: the index and the sync queue stay, and the page cache mostly goes. **Do not start `R2-4` before this is decided.**
- [ ] **The offline trade-off is the real cost of (b), and must be decided deliberately, not discovered.** Today the store's IndexedDB copy is what makes warm-offline capture work on the phone (`TASK-M3`). A pure query model needs an explicit offline cache instead of getting one as a side effect.
- [ ] **`LAZY-2`'s accessor is the seam that makes this change affordable** — with every consumer behind one `usePagesOf(databaseId)`, the read model can be swapped without touching 53 files. **Build it regardless of which way this decision goes.**

### R2-4 · SPLIT THE STORE 🟧 — **blocked on `R2-6`**
- [ ] 2,215 lines doing six jobs. Separate along seams that already exist: **cache** (pages + `pageIndex`) · **sync** (`syncQueue`, retry, single-flight) · **undo** · **persistence** (IndexedDB, `partialize`, throttling). Same public surface for components — this is a re-seam, not a rewrite, and it must be behaviourally invisible.
- [ ] Dirty-page protection is load-bearing and must survive verbatim: **pages in `syncQueue` are never evicted** (this is what `DATA-PERSIST-INTEGRITY` protects, and what MEM-3c depends on).

### R2-5 · CHARACTERIZATION TESTS FIRST 🟥 — *written before R2-1, not after*
- [ ] Pin current **correct** behaviour before moving anything: OCC accept/reject cases · field-merge of two concurrent different-field edits · the single-flight lock · queue retry/backoff · dirty-page-not-evicted.
- [ ] These are the safety net for the whole root. The money math is already pinned (`invoice-totals` 22, `block-tree` 18) — this is the same idea for the write path.

## VERIFY
1. Two different fields of one record edited concurrently → **both persist, no conflict dialog**.
2. The same field edited concurrently → conflict raised once, with the real server value, and the resolve path works.
3. Rapid typing in an engine field → one in-flight save at a time; no "Sync Conflict Detected".
4. Offline edit → reload → the edit is still queued and still applied (dirty-page protection).
5. `grep -rn "prisma.globalPage" src | grep -v lib/data` → **0**.
6. Every test green, including the new R2-5 set.

## ORDER
**R2-5 (tests) → R2-1 → R2-2 → R2-3 → R2-4.**
R2-4 last: splitting a 2,215-line store before its behaviour is pinned is how a refactor becomes an outage.

## NOTE FOR THE CODER
Do **not** start R2 until R1-4/R1-5 are merged. R2-1 is where the tenant scope is enforced for every write in the system; building it against the old prisma calls means building it twice.
