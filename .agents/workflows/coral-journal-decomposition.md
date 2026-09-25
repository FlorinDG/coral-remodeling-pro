# CORAL — WORKED EXAMPLE — one line of code, five defects, five layers — Planner 2026-09-21

**Florin, 2026-09-21:** *"Reapply the logic, because I see it again in multiple layers. Differentiate what stands where in this — I think the options are a bit superficial."*

**He is right. The a/b/c options I offered were a SCHEDULING question ("now or later") asked about an ARCHITECTURAL problem.** Walked down properly, the journal case is **five defects at four layers**, and they have different owners, different fixes and different urgency.

**Kept as a worked example, because this shape will recur.**

---

## THE LINE
```js
// app/[locale]/admin/journal/page.tsx
const GENERAL_DB_ID = 'db-journal-general';                       // :62
const generalDb = databases.find(d => d.id === GENERAL_DB_ID);     // :99   unresolved
[GENERAL_DB_ID]: 'general' as Module,                              // :106  unresolved
let db = …databases.find(d => d.id === GENERAL_DB_ID);             // :341
if (!db) db = createDatabase('General Journal', '…', GENERAL_DB_ID, […]);  // :343
```

## THE DECOMPOSITION

| # | Defect | Layer | Owner | Fix |
|---|---|---|---|---|
| **1** | **A caller chooses an identity.** `specificId` lets anything name a database. | **L0 KERNEL** | `KERN-3` | `mintDatabaseId()`; delete the parameter |
| **2** | **There is no "provision this database for this tenant" capability.** | **L1 CORE** | `CUSTOM-2` | provisioning as a callable server capability |
| **3** | **A logical key is used as an instance id.** `db-journal-general` is in `BASE_TO_KEY` — it IS a key — and is used as a literal id. | **⛨ SERAPH** | `R1-1b` | `logicalKey` separate from instance id |
| **4** | **It is never resolved through the book.** The same file resolves `db-1`, `db-clients`, `db-crm` via `resolveDbId` and **not** this one. | **⛨ SERAPH** | `R1-2` | fail-closed resolver, no unresolved reads |
| **5** | **It is in `BASE_TO_KEY` but not `SYSTEM_DB_PREFIXES`.** | **⛨ SERAPH** | `R1-1a` | the three-way reconciliation |
| **6** | **A page provisions its own database.** A module doing the gate's job. | **L2 MODULE** | journal | ask for it; never create it |

**Three of the six are seraph defects on a single constant.** That is why it kept looking like "a journal problem": **the layer that should have answered the question does not exist yet, so the page answered it itself.**

---

## 🔴 THE REFRAME THAT DISSOLVES THE a/b/c QUESTION

I said *"KERN-3 breaks the journal, so: do it now, do it later, or grow the scope."* **All three accept a false premise.**

```js
if (!db) { db = createDatabase(…, GENERAL_DB_ID, …); }   // :342-343
```
**Creation only fires when the database is MISSING.**

- **Florin's tenant:** `db-journal-general` exists with **11 pages**. `db` is found. **The creation path never runs.**
- **Tenant 2:** it is missing → creation fires → `saveGlobalDatabase:351` sees the id belongs to another tenant → **`Unauthorized`** → *"Failed to save database configuration"*. **Already broken, today.**

> **So `KERN-3` breaks nothing that currently works.** It deletes a path that works for exactly one tenant by accident of history, and already fails for everyone else.

**The scheduling question was the wrong question. The real one:** *do we keep a kernel defect in order to preserve a leaf that is already broken?* **Stated that way it answers itself.**

---

## THE GENERAL RULE — worth keeping

> **When a kernel fix appears to break a leaf, first establish whether the leaf WORKS or merely APPEARS to.**
>
> A leaf that works for the founder and fails for everyone else is not working — **it is a defect with a sample size of one.** Removing the kernel flaw does not break it; it stops hiding it.

**The tell, and it is cheap:** *who does this currently work for, and why?* If the answer is *"for us, because our data predates the problem"*, **that is not a feature to protect.**

*(Same shape as the `t-*` records, inverted: there, five records made a "legacy" convention look dead when it was live. Here, one tenant makes a broken path look alive.)*

---

## WHAT TO DO — per layer, not per calendar

- [ ] **`KERN-3` proceeds unchanged.** `specificId` is deleted. `DatabaseClone:983` dies — **intended.** `journal:343` dies — **and takes nothing working with it.**
- [ ] **The journal's creation path is DELETED, not replaced.** 🛑 **No `provisionJournalDb()` helper.** That is `specificId` under another name, which the directive already prohibits.
- [ ] **Replace it with an honest state:** if the journal database is not provisioned, **say so** — *"The journal is not available for this workspace yet."* **Not a silent failure, not a toast about saving configuration.** *(ERROR-SURFACING DIRECTIVE. This is strictly better than today for tenant 2.)*
- [ ] **`journal:99` and `:106` resolve through `resolveDbId`**, like the three lines beside them. **One line each — do it in `KERN-3`, it is the same file and the same mistake.**
- [ ] **`db-journal-general` joins `SYSTEM_DB_PREFIXES`** — `R1-1a`'s reconciliation, and it is the item that makes provisioning cover it later.
- [ ] **Server-side provisioning is `CUSTOM-2`/`R1`.** **Not in `KERN-3`.** The journal stays unavailable to new tenants until then — **which is its current state, stated honestly instead of failing quietly.**

## WHAT THIS COSTS FLORIN TODAY
**Nothing.** His journal keeps working — it always took the `db` found branch.

## WHAT IT BUYS
The browser loses the ability to bring a database into existence, **in every path at once** — `DatabaseClone` and the journal were the only two, and both go with one parameter.
