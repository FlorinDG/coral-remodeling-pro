# CORAL — R1 · TENANCY BOUNDARY — root spec (Planner 2026-09-12, **revised after Florin's review**)

Governed by `coral-systems-pass.md`. **First root of the systems pass.**

> **INVARIANT:** *A query against tenant data cannot be written without a tenant scope. The tenant is derived from the session — never accepted as an argument, never read from an identifier the client supplied.*

---

## ⚠️ REVISION — the denormalised-column plan is WITHDRAWN

The first draft proposed adding a `tenantId` column to `GlobalPage`. **Florin rejected it, correctly, and for the right reason.** A denormalised column creates a **second representation of tenancy** that can disagree with the first (`GlobalDatabase.tenantId`). That is defect shape #1 — *two representations of one concept* — the shape this entire pass exists to eliminate. Proposing it in the R1 spec was a contradiction of the method in `coral-systems-pass.md`.

**Corrected principle: derive, never duplicate. Tenancy has exactly one home.**

And the mechanism Florin described — *"name the database with the tenant, and the code enforces gating at the point the tenant is created"* — **already exists in the codebase**. It is simply not canonical, not fail-closed, and not used by four of the five write doors.

---

## WHAT IS ALREADY THERE

**`Tenant.lockedDbIds` (`schema.prisma:68`, `Json @default("{}")`)** — the authoritative per-tenant map from a *logical key* (`db-invoices`) to that tenant's *real* database id. This is exactly the namespacing Florin proposed, created with the tenant profile.

**`createPageServerFirst` already does it correctly** (`app/actions/pages.ts:66-80`): resolves the client-supplied `databaseId` through **the session tenant's own** `lockedDbIds`, then checks the parent database's `tenantId`. One door out of five gets this right.

### So the risk is not the absence of a column. It is three fail-open seams.

**1 · The client-side resolver defaults to a pass-through.**
```js
resolveDbId: (base) => base,   // context/TenantContext.tsx:26 — "safe default — falls back to bare ID"
```
A default that returns an unscoped id is **fail-open**. It is only "safe" because there is one tenant.

**2 · Resolution is string archaeology, not a lookup.** `lib/lockedDbUtils.ts:39-46`:
```js
const existingMappedVal = Object.values(lockedDbIds).find(val => val.includes('-'));
const suffix = existingMappedVal.split('-').pop();      // guess the tenant suffix from a sibling value
if (base.endsWith(`-${suffix}`)) return base;           // assume already resolved
```
Plus a *"self-healing fallback for new system databases not yet in legacy tenant's lockedDbIds"*. Identity inferred by guessing at substrings, with a fallback that invents a mapping.

**3 · One identifier carries two facts.** `databaseId` encodes both *which logical database* and *which tenant*. 55 sites do `startsWith('db-…')` to ask a **type** question, and 67 hardcode bare logical ids. Type-matching and identity therefore parse the same string — and a type query written as a prefix match (`databaseId LIKE 'db-invoices%'`, as in `cron/vat-backfill`) **spans every tenant by construction**.

**The honest summary: Florin's model is right and is already the design. It leaks because resolution is optional, heuristic, and fail-open — not because tenancy lives in the wrong place.**

---

## 📎 PASTED FACTS — everything below is copied from the repo, not recalled
*(Per `coder-profile.md` rule 1: an API that is not pasted will be invented. Rule 2: our stack post-dates the model's March-2026 knowledge — read the installed types, do not write from memory.)*

**Installed:** Next 16.1.6 · React 19.2.3 · Prisma **6.19.2** · zustand 5.0.11 · next-intl 4.8.2

```ts
// src/auth.ts:34 — the ONLY source of tenant identity
export const { handlers, auth, signIn, signOut } = NextAuth({ … });
// usage, 86 sites: const session = await auth(); const tenantId = session?.user?.tenantId;
```
```prisma
// prisma/schema.prisma:707 — note: NO logicalKey field yet; R1-1 adds it
model GlobalDatabase {
  id String @id @default(cuid())
  tenantId String
  name String
  properties Json @default("[]")
  views Json @default("[]")
  …
}
// :68 on model Tenant
lockedDbIds Json @default("{}")
```
```ts
// src/lib/lockedDbUtils.ts — CLIENT SAFE, no Prisma
export type LockedDbKey = 'invoices' | 'clients' | 'suppliers' | 'expenses' | 'tickets'
  | 'quotations' | 'payments-in' | 'payments-out' | 'projects' | 'tasks' | 'articles'
  | 'crm' | 'bobex' | 'bestek' | 'journal-general' | 'hr';              // 16 keys
export type LockedDbIds = Partial<Record<LockedDbKey, string>>;
export const BASE_TO_KEY: Record<string, LockedDbKey>;                  // 16 entries
export function getLockedDbId(base: string, lockedDbIds: Record<string, string>): string;
//                            ↑ takes the MAP, not a tenant. Returns the bare base on failure.
```
```ts
// src/lib/systemDatabases.ts
export const SYSTEM_DB_PREFIXES: readonly string[];   // 14 entries
export const SERVER_PROVISIONED_BASES: Set<string>;   // 8 entries
export function isSystemDatabase(id: string): boolean;   // id === prefix || id.startsWith(prefix + '-')
export function getBaseDbId(id: string): string;         // 'db-clients-abc123' → 'db-clients'
```
**Id format, confirmed:** `<base>-<tenantSuffix>`, e.g. `db-invoices-abc12345`. `getBaseDbId` strips the suffix by prefix match.

**Prisma extension API — VERIFY BEFORE WRITING.** `node_modules/@prisma/client/extension.d.ts` exists and exports `defineExtension`. **Read the installed types first.** Do **not** reach for `prisma.$use()` middleware from memory — `$extends` is the supported path on 6.x and `$use` is legacy. Confirm against the installed `.d.ts`, not against recollection.

---

## 🔴 NEW FINDING WHILE HARDENING THIS SPEC — two disagreeing lists of "system database"

`SYSTEM_DB_PREFIXES` has **14** entries. `BASE_TO_KEY` has **16** — it additionally knows `db-journal-general` and `db-hr`. So:

```ts
isSystemDatabase('db-hr-abc12345')             // → FALSE   (not in SYSTEM_DB_PREFIXES)
BASE_TO_KEY['db-hr']                           // → 'hr'    (it IS a locked, tenant-scoped DB)
```

And `createPageServerFirst` resolves the tenant's real database id **only when `isSystemDatabase()` is true** (`app/actions/pages.ts:66-77`). Therefore **pages created in `db-hr` and `db-journal-general` skip tenant resolution entirely** and use the client-supplied id as given.

Defect shape #1 — *two representations of one concept* — in the tenancy layer itself. **R1-1 must reconcile these into one list before anything is built on top of them.**

---

## THE WORK

### R1-0 · DELETE THE SCRATCH ROUTE 🟥🟥 — first commit, no dependencies
- [ ] Delete `src/app/api/test-payment-plan/route.ts`. Unauthenticated `GET`, no guard, `findFirst` across all tenants, then **writes**. Delete it; do not repair it.

### R1-1a · RECONCILE THE TWO LISTS 🟥 — *first, it is a prerequisite for everything else*
- [ ] `SYSTEM_DB_PREFIXES` (14) and `BASE_TO_KEY` (16) must become **one** list with one derivation. Decide explicitly whether `db-hr` and `db-journal-general` are system databases — they are in `lockedDbIds`, so the answer is almost certainly yes, and `isSystemDatabase()` has been wrong about them.
- [ ] **Report, do not silently fix:** count existing `GlobalPage` rows whose `databaseId` resolves to `db-hr*` or `db-journal-general*` and whose parent `GlobalDatabase.tenantId` is not the expected tenant. This is read-only and tells Florin whether the gap has already produced mis-scoped rows.
- [ ] `SERVER_PROVISIONED_BASES` (8) is a deliberate **subset** and stays separate — do not merge it in.

### R1-1b · SEPARATE THE TWO FACTS 🟥 — *the enabling change*
- [ ] A database is identified by **`logicalKey`** (`db-invoices` — what kind) **and** its **id** (this tenant's instance). Type questions ask `logicalKey`; identity questions use the id. Never one string for both.
- [ ] Add `logicalKey String?` to `GlobalDatabase` (additive; **nothing on `GlobalPage`**, no data movement).
- [ ] **Backfill source already exists and is exact:** `getBaseDbId(db.id)` (`systemDatabases.ts:61`) returns the base prefix. Backfill `logicalKey = getBaseDbId(id)` for every row, then verify no NULLs on rows whose id matches a known prefix.
- [ ] Every `startsWith('db-…')` type test migrates to `logicalKey` equality. **55 sites.** This retires `cron/vat-backfill`'s cross-tenant `LIKE 'db-invoices%'` as a **class**, not as one fix.
- [ ] `getBaseDbId` then has exactly one remaining legitimate caller: the backfill. Everything else reads the column.

### R1-2 · ONE CANONICAL RESOLVER, FAIL-CLOSED 🟥
**Replaces `getLockedDbId(base, lockedDbIds)` entirely.** The three constructs to delete from `lib/lockedDbUtils.ts` — each is identity inferred by guessing:
```ts
const existingMappedVal = Object.values(lockedDbIds).find(val => val.includes('-'));  // (1) any sibling with a dash
const suffix = existingMappedVal.split('-').pop();                                     // (2) …assume that's the tenant
if (anyMappedVal) return `${base}-${suffix}`;                                          // (3) self-healing INVENTION
return base;                                                                           // (4) fail-open
```
- [ ] New signature — a **lookup, nothing else**:
  ```ts
  export function resolveDatabaseId(logicalKey: string, lockedDbIds: LockedDbIds): string;  // throws if unresolvable
  ```
- [ ] **Unknown key → throw.** Also delete the client-side pass-through default:
  ```ts
  // src/context/TenantContext.tsx:26 — DELETE
  resolveDbId: (base) => base, // safe default — falls back to bare ID
  ```
  It is not a safe default; it is a fail-open one. The context default must throw or the provider must not render until the tenant is loaded.
- [ ] Provisioning a tenant is the **only** writer of `lockedDbIds`. If a logical key is missing at read time, that is a provisioning defect and must surface as one — a loud error naming the key, per the ERROR-SURFACING DIRECTIVE. (The current "self-healing fallback" hides exactly this.)
- [ ] Audit tenant provisioning: every system database a tenant can reach is registered at creation, so the fallback has nothing left to do.

### R1-3 · THE SERVER NEVER TRUSTS A SUPPLIED ID 🟥 — *the security answer*
**This is the part that namespacing alone does not solve, and it is worth being explicit about:** a client can *send* another tenant's database id. Whether tenancy lives in a column or in the name, the server must still verify. Encoding it in the name makes the check cheap and local — it does not remove it.
- [ ] Every entry point resolves from **`session.user.tenantId`** and either (a) ignores the client's id in favour of `resolveDatabaseId(logicalKey, tenant)`, or (b) verifies the supplied id appears in **this tenant's** `lockedDbIds` / `GlobalDatabase.tenantId`. `createPageServerFirst:66-80` is the reference; the other four doors adopt it (R2-1 makes that one door).
- [ ] Page reads scope as `databaseId IN (this tenant's ids)` — one cheap lookup of the tenant's databases, then no join and no column on `GlobalPage`. **Tenancy stays in one place and stays queryable.**

### R1-4 · THE ONLY DOOR 🟥
- [ ] `lib/data/tenant-scope.ts`: resolves the tenant from the session and returns an accessor whose methods cannot express an unscoped query. **The tenant is never a parameter** — that is what makes "pass the wrong tenant" unexpressible.
- [ ] Prisma client extension injects the scope and **fails closed** on any model it cannot scope.

### R1-5 · CLOSE THE DOOR 🟥 — *without this, R1-4 is a suggestion*
- [ ] Direct `prisma.<tenantModel>.*` outside `lib/data/**` fails CI, with a visible allowlist. Same mechanism that just worked for BLOB-3.
- [ ] **Prove it:** add a violation, watch CI go red, remove it. An untested gate is not a gate.

### R1-6 · SYSTEM WRITERS GET A NAMED DOOR, NOT AN EXEMPTION 🟥
- [ ] `systemScope(tenantId, reason)` for cron/webhooks/services — still tenant-bound, and it stamps the system-write tag structurally (OCC-2 stops depending on memory).
- [ ] **`cron/vat-backfill`** iterates tenants explicitly. Its `LIKE 'db-invoices%'` dies with R1-1.
- [ ] Same audit: `cron/invoice-overdue`, `stripe/webhook`, `admin/backfill-peppol`, `admin/schema-cleanup`, `peppol/inbox`, `scan`.
- [ ] `accept-invoice.ts`, `payment-plan-service.ts` are **token/id-scoped capabilities** — defensible, but state it at the call site and verify the token's own scope.

### R1-7 · MIGRATE THE CALL SITES 🟧
- [ ] 93 `GlobalPage` + 34 `GlobalDatabase` sites onto the accessor, module by module, smallest first. One commit per module, `tsc --noEmit` clean each time.

## VERIFY
1. R1-5's gate goes **red** on a deliberate violation.
2. `resolveDatabaseId` with an unregistered key **throws**; no path returns a bare id.
3. A session for tenant A supplying tenant B's `databaseId` is **refused** — tested explicitly, both read and write.
4. `grep -rn "startsWith('db-" src` → **0**.
5. Two-tenant fixture: `vat-backfill` touches only the tenant it was invoked for.
6. `grep -rn "prisma.globalPage" src | grep -v lib/data` → **0**.
7. 70 tests green; `tsc --noEmit` clean.

## COST NOTE
This revision **removes a data migration on the largest table** (9,776 rows) and replaces it with an additive column on `GlobalDatabase` (tens of rows). Cheaper, lower-risk, and one representation of tenancy instead of two. Florin's objection improved the plan.

## ORDER
**R1-0 → R1-1 → R1-2 → R1-3 → R1-4 + R1-5 (together) → R1-6 → R1-7.**
