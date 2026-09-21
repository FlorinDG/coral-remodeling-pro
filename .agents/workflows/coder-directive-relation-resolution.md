# CORAL — CODER DIRECTIVE — `PANEL-1` · one relation resolver — Planner 2026-09-21

**Florin, 2026-09-21:** *"In the quote/invoice engine there is a side panel that has more power over the document than the grid view… does not show a connected client unless manually set while the grid does… we just need to reconcile the two input surfaces… and should be wider."*

**Not scheduled — queued behind `R1`.** Read the whole directive before touching anything: **most of what looks wrong is right.**

---

## 🟢 WHAT IS NOT BROKEN — do not "fix" this
`ClientInvoiceEngine:1823` uses the **generic, schema-driven** `DbPropertiesPanel`. **The original intent was implemented correctly.**

| Surface | Shows |
|---|---|
| **Panel** | **every property in the schema** |
| **Grid** | only the **active view's visible columns** (`PropertiesDropdown`) |

So `structuredComm` and the document title being editable in the panel but not the grid is **correct** — they are in the schema and hidden from that view. **This asymmetry is the feature Florin values. Preserve it.**

- 🛑 **Do not move fields between the panel and the grid.**
- 🛑 **Do not make the panel show only the visible columns.**

---

## 🔴 WHAT IS BROKEN — three consumers, three resolutions, none complete

```js
// 1. GRID — RelationColumn:74, 107-108
const targetDatabase = getDatabase(relationDatabaseId);                       // ❌ no resolveDbId
const indexEntries = Object.values(pageIndex).filter(e => e.databaseId === relationDatabaseId);  // ✅ fallback

// 2. PANEL — DbPropertiesPanel:429-431
const targetDb = databases.find(db => db.id === relationDatabaseId);          // ❌ no resolveDbId
const unselected = targetDb ? targetDb.pages.filter(...) : [];                // ❌ no fallback — SILENTLY EMPTY

// 3. LinkedRecords:78
const resolvedTargetDbId = resolveDbId(targetDbId);                           // ✅ resolves
const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);         // ❌ no fallback
```

| | resolves tenant id | falls back when not hydrated |
|---|---|---|
| `RelationColumn` | ❌ | ✅ |
| `DbPropertiesPanel` | ❌ | ❌ |
| `LinkedRecords` | ✅ | ❌ |

**Nobody does both.** Each surface implements a different half, so each fails in a different situation — which is why the same record looks different depending on where you look at it.

### Why it matters that the id can be either form
`relationDatabaseId` is seeded **inconsistently**:
- `mockData.ts` — **14** bare (`'db-clients'`)
- `DatabaseClone.tsx` — **27** resolved (`resolveDbId('db-clients')`)

**So a stored `relationDatabaseId` may be bare or tenant-scoped depending on which seed wrote that schema.** A reader that does not resolve will miss every bare one for a tenant whose instance is suffixed — **which is Florin's client field, exactly.** *(An `R1` instance: identity carried by an id that may or may not be scoped.)*

### And the state collapse
```
no relation value  ·  target DB not loaded  ·  target DB genuinely empty
```
**All three render as an empty box.** `LAZY-2`'s rule — *not-loaded must be impossible to mistake for empty* — unfixed one level down, in relations.

---

---

# 📐 WALKED DOWN THE STACK — and it corrected this spec (2026-09-21)

**Florin applied the method to the directive itself:** *"Anything belongs in the kernel? Anything in the core? Is it all just module code? Leaves to shake and clean?"*

| Layer | What belongs here |
|---|---|
| **L0 KERNEL** | **Nothing.** No new I/O, no new computation, no new primitive. It consumes what exists. |
| **⛨ SERAPH** | 🔴 **Relations store a `logicalKey`, resolved to an instance through the book.** See below — this is `R1-1b`, not new work. |
| **L1 CORE** | **One item:** `resolveRelationTarget` belongs in the **read model**, beside `usePagesOf` and `pageIndex`. *"What does this relation point to"* is a read-path question in the same family. **Not a module concern — every module with a relation needs it.** |
| **⛨ MODULE GATE** | **Nothing.** Relations are not entitlement-gated. |
| **L3 / L4 LEAVES** | Three consumers calling the resolver · loading state · named error · panel width. **Most of the visible work, and the shallowest.** |

## 🔻 PLANNER CORRECTION — "accepts both forms" was wrong
Step 2 below originally said the resolver must **accept both forms** of `relationDatabaseId`, bare or scoped. **That is tolerating two representations of one fact** — the defect we remove everywhere else, written into the fix.

**A relation points at a KIND of database, not at this tenant's instance.** *"This invoice's client lives in the clients database"* is true for every tenant. So:

- [ ] 🔴 **`relationDatabaseId` holds a `logicalKey`** (`db-clients`), and the tenant's instance is resolved **through the book at read time**.
- [ ] **Then bare-vs-scoped stops being a case to handle** — it is always a key, always resolved. **The 14 bare seeds in `mockData` become correct; the 27 resolved ones in `DatabaseClone` become the migration.**
- [ ] **This is `R1-1b` applied to relations**, not a new decision: *type questions ask `logicalKey`; identity questions use the id.* A relation target is a **type** question.
- [ ] **Custom databases have no `logicalKey`** (`coral-custom-databases.md`) — so a relation targeting one stores its **id**, and the resolver must handle that case explicitly. **One rule with a named exception beats two rules.**

## 🔁 WHAT THIS CHANGES ABOUT SEQUENCING
`PANEL-1` was queued **behind** `R1`. Walked down, **part of it IS `R1`** — the `logicalKey` on relations — and the rest is a consumer of it.

**Same finding as the custom-database walk: the feature is mostly not a feature.** Build it leaf-first and you get a fourth hand-rolled resolution path plus a tolerance for two id forms that would then need unpicking.

- [ ] **Step 1 (report) can run any time** — it is read-only and its answer informs `R1-1b`.
- [ ] **Step 2's resolver lands with `R1-1b`**, reading the book.
- [ ] **Step 3's leaves follow.**

---

## `PANEL-1` · THE WORK

### Step 1 — report, do not fix 🛑
- [ ] For a purchase invoice where Florin sees the client in the grid and not in the panel, report: the stored `relationDatabaseId` (bare or scoped), whether the target database is hydrated in the store, and whether `pageIndex` holds its entries.
- [ ] **Name which of the two causes is real.** Both are plausible; **do not fix speculatively.**

### Step 2 — one resolver
- [ ] **`lib/relations/resolve.ts`** — the only way any surface resolves a relation:
  ```ts
  resolveRelationTarget(relationDatabaseId): {
      status: 'ready' | 'not-loaded' | 'unknown-database';
      databaseId: string;            // always the tenant-scoped id
      options: RelationOption[];     // from the store, or pageIndex when not hydrated
  }
  ```
- [ ] It **resolves a `logicalKey` through the book** to this tenant's instance. 🛑 **It does NOT "accept both forms"** — see the correction above. *(Until `R1-1b` lands, a scoped id already stored is passed through unchanged and **reported**, never silently normalised.)*
- [ ] It **always** falls back to `pageIndex` — the `RelationColumn` behaviour, made universal.
- [ ] It **returns a status**, never a bare array. 🛑 **A caller must not be able to confuse `not-loaded` with `empty`.**
- [ ] **All three consumers call it**: `RelationColumn`, `DbPropertiesPanel`, `LinkedRecords`. **Grep gate:** `grep -rn "relationDatabaseId" src/components` → reads only inside `lib/relations/` and the property editor that *sets* it.
- [ ] `settings/databases/[id]` **writes** `relationDatabaseId` — leave it, but 🔴 **it must write the resolved id**, never bare. *(Identity directive: the seraph's book, not a label.)*

### Step 3 — the panel
- [ ] **Widen it.** `ClientInvoiceEngine:1823` is `w-80 lg:w-96`. Make it resizable and remember the width via `useUserPreferences` — **Florin uses it daily on purchase invoices.**
- [ ] `not-loaded` renders a **loading state**, not an empty picker.
- [ ] `unknown-database` renders a **named error** — *"Relation target db-clients not found for this tenant"* — never silence. ERROR-SURFACING DIRECTIVE.

## VERIFY
1. Open a purchase invoice **cold** (fresh window, clients database never opened) → **the panel shows the client**, same as the grid.
2. A record with genuinely no client → panel and grid **both** show empty, and it reads as *"none selected"*, not as a failure.
3. A relation whose target database does not exist → **a named error in both**.
4. Change a relation in the panel → the grid reflects it, and the reverse.
5. `grep -rn "relationDatabaseId" src/components` → no consumer resolves it on its own.
6. Panel width persists across sessions.
7. `npm run test:compile` · full suite green.

## PROHIBITIONS
- **No second resolution path.** One module, three callers.
- **No bare `relationDatabaseId`** written anywhere new.
- **No empty array returned for a database that is not loaded.**
- **No change to which fields the panel or the grid shows.** The split is correct.
- **No files beyond** `lib/relations/`, `RelationColumn.tsx`, `DbPropertiesPanel.tsx`, `LinkedRecords.tsx`, `ClientInvoiceEngine.tsx` *(width only)*, `settings/databases/[id]/page.tsx` *(write-resolved only)*.
