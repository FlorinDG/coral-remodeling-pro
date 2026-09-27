# CORAL — CODER DIRECTIVE — `KERN-7b` · convert the 74 parse sites — Planner 2026-09-27

Governed by `coral-id-parsing-decomposition.md`. **`KERN-7a` (the ratchet) lands first. `R1-1b`/`R1-1c` are applied — `logicalKey` is populated for all 32 role-bound databases.**

> ## **An id is never parsed. The binding is always read.**

---

# 0 · THE PROBLEM THIS DIRECTIVE SOLVES FIRST

`roleOfDatabase(tenantId, id)` is **async and server-side**. **Most parse sites are in client components** — `DatabaseClone`, `NotionGrid`, `PageModal`, `useGridColumns`, `RecordDetailPage`. They cannot await it, which is *why* they parse.

🟢 **But the data is already there and being thrown away:**
```ts
// actions/global-databases.ts:40 — no `select`, so Prisma returns logicalKey
const dbs = await prisma.globalDatabase.findMany({ where: { tenantId }, include: { pages: true } });

// …then a field-by-field mapper drops it
return dbs.map(db => ({ id, name, description, isTemplate, folderId, properties, views, ownerId /* no logicalKey */ }));
```

## `7b.0` · CARRY IT ACROSS THE BOUNDARY — do this before any conversion
- [ ] **Add to the client `Database` interface** (`components/admin/database/types.ts`):
  ```ts
  logicalKey?: SystemDatabaseRole | null;   // the reverse binding. NEVER parse the id.
  ```
- [ ] **Add `logicalKey: db.logicalKey` to every mapper.** 🔴 **There are at least two `findMany` sites — `:40` and `:145`.** Find them all; a mapper that forgets it produces `undefined`, which reads as "custom database" and is **silently wrong**.
- [ ] **Hydrate it into the store** so it survives a page's lifetime.
- [ ] 🟢 **Every client-side parse then becomes a property read.** No async, no server call, no round trip.

🔴 **VERIFY `7b.0` ALONE BEFORE CONVERTING ANYTHING:** log `logicalKey` for all 16 system databases in the browser. **Sixteen roles, no `undefined`.** *(If one is undefined, a mapper was missed — and every conversion built on it would be wrong.)*

---

# 1 · 🛑 THE TRAP — THE VALUES ARE NOT THE SAME

`getBaseDbId` returns a **base id**. `logicalKey` returns a **role**. **They are different strings.**

```ts
getBaseDbId(id) === 'db-1'         →   db.logicalKey === 'projects'      // NOT 'db-1'
getBaseDbId(id) === 'db-clients'   →   db.logicalKey === 'clients'
getBaseDbId(id) === 'db-journal-general' → db.logicalKey === 'journal-general'
```

🔴 **A mechanical swap that keeps the comparison string compiles, type-checks, and is always false.** `SYSTEM_DATABASES[role].legacyBase` holds the mapping — **use it to translate each comparison, one at a time, by reading it.**

🛑 **No find-and-replace. Not one.** *(The `full_name` lesson: a rename that compiles and renders blank.)*

## The two substitutions
| From | Client-side | Server-side |
|---|---|---|
| `isSystemDatabase(id)` | `db.logicalKey != null` | `await roleOfDatabase(tenantId, id) !== null` |
| `getBaseDbId(id)` | `db.logicalKey` | `await roleOfDatabase(tenantId, id)` |
| `id.startsWith('db-x')` | `db.logicalKey === '<role>'` | same via `roleOfDatabase` |

---

# 2 · THE BATCHES — by risk, not by size

```
7b.0  carry logicalKey to the client                          ← gates everything
7b.1  lib/databaseRoute.ts (5) · lib/systemDatabases.ts (2)    the primitives others call
7b.2  🛑 app/actions/pages.ts (6)                              ENTITLEMENT + THE WRITE PATH
7b.3  admin/database/[databaseId]/[pageId]/page.tsx (10)        routing
7b.4  PageModal (6) · useGridColumns (4) · DatabaseClone (4)
      NotionGrid (3) · RecordDetailPage (3)                     the grid surfaces
7b.5  🛑 api/admin/schema-cleanup/route.ts (5)                  A DESTRUCTIVE TOOL
7b.6  the tail — api/scan (3) and the 2s and 1s
```

## 🛑 `7b.2` — `app/actions/pages.ts` — slow down here
Two different dangers in one file:
- **`requiredModuleForDb(databaseId)` decides MODULE ENTITLEMENT by prefix-matching.** Converting it **changes a permission decision**. 🔴 **Over-gate and Florin is locked out of his own module; under-gate and a free tier gets something it did not buy.** *(Measured: a FREE tenant can currently create records in 14 of 16 databases — `ENT-6`. Do not make that worse while fixing this.)*
  - [ ] **Use `SYSTEM_DATABASES[role].module`** — the table `KERN-6` built. Not a new map.
  - [ ] **Exercise every gated database before and after, on both tenants.** BV CORAL is ENTERPRISE with 9 modules; Murgu is FREE with INVOICING only. **Record which databases each can create in, before and after. The two lists must be identical.**
- **`createPageServerFirst` resolves on the WRITE path** (`:68-75`). A wrong conversion does not fail loudly — **it writes a row into the wrong database.**
  - [ ] **The resolve is server-side with a session: use `roleOfDatabase` and `systemDatabaseId`.**
  - [ ] 🔴 **Verify by creating a record in each of the 16 and confirming where it landed.**

## 🛑 `7b.5` — `api/admin/schema-cleanup/route.ts`
**It deletes and re-provisions.** `GARBAGE_NAMES = ['New Workspace', 'New Database']` is in there, and three of BV CORAL's real databases are named *"New Workspace"*.
- [ ] **Read what it does before changing a line.** 🔴 **Report what it would delete on BV CORAL today.**
- [ ] 🛑 **Do not run it. Convert it and leave it unrun.**

## `7b.3` — the routing file
`[databaseId]/[pageId]/page.tsx` has **10 sites**, all `startsWith('db-x')` special-casing to pick a detail view.
- [ ] **A wrong conversion sends a user to the wrong screen** — visible, not silent, so this batch is safer than it looks.
- [ ] **Walk every record type afterwards:** invoice, quote, purchase invoice, ticket, payment, client, supplier, project, task, journal entry.

---

# 3 · THE METRIC — report it after every batch
```
KERN-7 allowlist:  28 → N        (files still parsing)
parse sites:       74 → M        startsWith('db- + isSystemDatabase + getBaseDbId
```
- [ ] **A file leaves the allowlist in the same commit that converts it.** 🛑 **Never widen the allowlist** *(a file that newly matches was already carrying the shape — that is a `7a` correction, not a `7b` one)*.
- [ ] **`eslint src --quiet` exit 0 after every batch.** Verify the **true** exit code, not a pipe's.

---

# 4 · VERIFY — per batch
1. `npm run test:compile` exit 0 · `npm run test:lint` exit 0 · suite exit 0, `fail 0`.
2. **Both metrics reported**, both lower than the previous batch.
3. **The surface still works — walked, not just loaded.**
4. 🔴 **`7b.2` only:** the entitlement before/after lists for both tenants, identical; and a record created in each of the 16 databases, landing in the right one.
5. 🟢 **`@ts-nocheck` count unchanged at 21** — this pass converts id parsing, not the Supabase shape.
6. **`SUPA-2` allowlist unchanged at 37.** 🛑 **If a file appears on both allowlists, convert only its id parsing.** *(`SUPA-2` 2.2–2.6 are parked pending `WH-2`.)*

## PROHIBITIONS
- 🛑 **No find-and-replace.** The base-id → role values differ; a swap that keeps the string is always false.
- 🛑 **`split('-')` stays untouched** — 7 of its 9 sites parse dates, project codes and payment terms.
- 🛑 **Do not delete `getLockedDbId`, `BASE_TO_KEY` or `lockedDbUtils.ts`.** That is `KERN-8`, after this allowlist reaches zero.
- 🛑 **No pattern matching for "is this a database id."** `db-` occurs inside random UUIDs — verified in production *(`KERN-9`)*.
- 🛑 **One batch per commit.** A batch spanning two of the groups above cannot be reverted cleanly.

---

## 🟢 WHAT THIS FINISHES
**After `7b`, no code reads meaning out of a database id.** The forward binding answers *which database is this role*, the reverse answers *which role is this database*, and both are reads.

**Then `KERN-8` deletes `getLockedDbId` and its four fallback branches — including `return base // Legacy FOUNDER fallback`, the zombie that worked for Florin and broke for everyone else.** That line is the reason this whole chain exists.
