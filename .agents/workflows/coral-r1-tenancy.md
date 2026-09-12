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

## THE WORK

### R1-0 · DELETE THE SCRATCH ROUTE 🟥🟥 — first commit, no dependencies
- [ ] Delete `src/app/api/test-payment-plan/route.ts`. Unauthenticated `GET`, no guard, `findFirst` across all tenants, then **writes**. Delete it; do not repair it.

### R1-1 · SEPARATE THE TWO FACTS 🟥 — *the enabling change*
- [ ] A database is identified by **`logicalKey`** (`db-invoices` — what kind) **and** its **id** (this tenant's instance). Type questions ask `logicalKey`; identity questions use the id. Never one string for both.
- [ ] Add `logicalKey` to `GlobalDatabase` (additive, backfilled from `lockedDbIds` — **no data moves**, no risk to `GlobalPage`).
- [ ] Every `startsWith('db-…')` type test migrates to `logicalKey` equality. **55 sites.** This is what retires `cron/vat-backfill`'s cross-tenant `LIKE` as a *class*, not as one fix.

### R1-2 · ONE CANONICAL RESOLVER, FAIL-CLOSED 🟥
- [ ] `resolveDatabaseId(logicalKey, tenant)` — a **lookup in `lockedDbIds`**, nothing else. No substring inspection, no sibling-value inference, no self-healing invention.
- [ ] **Unknown key → throw.** Delete the `(base) => base` pass-through default. A resolver that cannot resolve must fail, not hand back an unscoped id.
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
