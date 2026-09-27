# CORAL — CODER DIRECTIVE — `R1-1b` · `logicalKey`, the reverse binding — Planner 2026-09-27

**The binding is one-directional, and that is the root of all 74 id-parse sites.**

| Direction | Answered by | Cost |
|---|---|---|
| **role → id** | `Tenant.lockedDbIds` | a read ✅ |
| **id → role** | **NOTHING** | 🔴 **parse the id** |

Every reverse-lookup site has no storage to read, so it parses:
```
getBaseDbId(id)           → "which role is this?"      → prefix match
isSystemDatabase(id)      → "is this one of ours?"     → prefix match
requiredModuleForDb(id)   → "what gates this?"         → prefix match  🛑 ENTITLEMENT
relations/resolve.ts:94   → "role or id?"              → BASE_TO_KEY + 2 prefix searches
```

> ## `GlobalDatabase.logicalKey` IS the reverse binding.
> **Add it and both directions are reads. That is what turns pass 3b from a rewrite into a deletion.**

🔴 **This is why `R1-1b` moved EARLIER** — it is not a precondition to clear, it is **the storage pass 3b spends.**

---

# 1 · THE COLUMN

```prisma
model GlobalDatabase {
  logicalKey  String?     // SystemDatabaseRole, or null for a custom database
  @@unique([tenantId, logicalKey])
}
```
- [ ] **Nullable.** Custom databases legitimately have no role.
- [ ] **`@@unique([tenantId, logicalKey])`** where non-null. 🟢 **One database per role per tenant, enforced by Postgres instead of by convention** — this is what would have made `db-projects-hr` and `db-1` unable to both look like "the projects database".
- [ ] **Type it as `SystemDatabaseRole`** from `lib/kernel/system-databases.ts` at the application boundary. *(Prisma stores a string; the kernel owns the vocabulary.)*

---

# 2 · 🛑 THE BACKFILL — AND THE ONE WAY IT MUST NOT BE DONE

> ## Backfill from `Tenant.lockedDbIds`. **NEVER by parsing the id.**

`lockedDbIds` is authoritative and verified: **both tenants hold all 16 roles, every one resolving** *(measured 2026-09-26, after `KERN-5` pass 2 self-healed them)*.

🔴 **Deriving `logicalKey` from the id text would bake the defect permanently into the column built to remove it** — and it would *look* correct, because `BV CORAL`'s ids happen to be parseable (`db-1`, `db-clients-cmneyas2`). **A tenant provisioned after `KERN-5` has opaque cuids and would silently get nothing.**

- [ ] **For each tenant, for each `(role → id)` pair in `lockedDbIds`: set `logicalKey = role` on that database row.**
- [ ] **Every other `GlobalDatabase` row keeps `logicalKey = null`.**
- [ ] 🔴 **Report: rows updated, and any `lockedDbIds` entry whose id does not resolve to a row.** A non-resolving binding is a finding, not something to skip — 🛑 **stop and report it.** *(`hr → db-hr` resolved to nothing before pass 2; confirm it does now.)*
- [ ] **Idempotent** — safe to re-run, skips rows already keyed.
- [ ] **Migration generated, NOT applied.** 🛑 **Florin applies.** Additive + nullable, per `pd.md`.

---

# 3 · THE ACCESSOR — one door, both directions
```ts
// src/lib/data/system-databases.ts  (the file KERN-5 established)
export async function systemDatabaseId(tenantId, role): Promise<string>;      // forward, exists
export async function roleOfDatabase(tenantId, databaseId): Promise<SystemDatabaseRole | null>;  // NEW
```
- [ ] **`roleOfDatabase` is a `SELECT logicalKey`.** No parsing, no prefix matching, no fallback.
- [ ] **Returns `null` for a custom database** — that is an answer, not an absence.
- [ ] 🛑 **Throws for an unknown `databaseId`.** *(A database that does not exist is a question, not a `null`.)*
- [ ] 🛑 **Do NOT repoint the 74 parse sites in this pass.** That is `KERN-7` / pass 3b. **This directive lands the storage and the accessor only.**

---

# 4 · VERIFY
1. `npx prisma validate` clean. Migration contains **only** the column and the unique index.
2. **Backfill dry-run first:** a query listing every `(tenant, role, databaseId)` it will write. **Paste it. 32 rows expected — 16 roles × 2 tenants.**
3. After the backfill: **every id in every tenant's `lockedDbIds` has a matching row with the right `logicalKey`**, and no other row was touched.
4. **`roleOfDatabase(tenant, 'db-1')` → `'projects'`** for `BV CORAL`. 🟢 **That single assertion is the whole point** — a bare legacy id resolving to its role with no string surgery.
5. **`roleOfDatabase` on a custom database → `null`.** On a nonexistent id → **throws**.
6. 🔴 **The unique constraint bites:** attempt to set `logicalKey = 'projects'` on a second database for the same tenant → **rejected by Postgres.** Paste the error.
7. `eslint src --quiet` exit 0 · `npm run test:compile` exit 0 · suite 0 fail / 13 todo.
8. A test in `tests/` asserting `roleOfDatabase` is a lookup: **the word `startsWith` and the word `split` must not appear in the accessor.**

## PROHIBITIONS
- 🛑 **Never derive `logicalKey` from an id's text**, in the backfill or anywhere else.
- 🛑 **No pattern matching for "is this a database id".** `db-` occurs by chance inside random UUIDs — verified in production: property ids like `1b1dd3d1-94ee-4cdb-a8b9-…` contain `db-` *(`KERN-9`)*.
- 🛑 **Do not touch `getLockedDbId`, `BASE_TO_KEY`, `SYSTEM_DB_PREFIXES`, or the 74 parse sites.** Passes 3b and 3c.
- 🛑 **Do not apply the migration.**
