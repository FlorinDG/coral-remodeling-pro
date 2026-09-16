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

---

# 📊 AMENDMENT — 2026-09-16 · the census arrived early, and it changes four items

**Florin ran the full `GlobalDatabase` census on production while asking an unrelated question about custom grids.** Full detail in `coral-r1-census-findings.md`; the stress test of this plan is in `coral-seraph-stress-test.md`. **Florin, 2026-09-16: *"We go chase the R1 spec first. Let us not perpetuate misery."*** The spec below stands — these are additions, not corrections, except where marked.

## A1 · THE SHAPE OF THE ESTATE — measured, not estimated
**22 databases, 2 tenants.** Two populations:

| Scoped (id carries tenant suffix) | **Unscoped (bare id)** |
|---|---|
| clients · invoices · expenses · quotations · suppliers · tickets — **both tenants** · payments-in/out — tenant 1 | `db-bestek` **8,216** · `db-articles` 794 · `db-1` 72 · `db-tasks` 68 · `db-bobex` 41 · `db-crm` 24 · `db-journal-general` 11 · `db-projects-hr` 0 |

**All eight bare-id databases belong to tenant `cmneyas2b…` (Florin). 9,226 pages — the large majority of all data — in databases whose identity is global.**

**No leak is occurring today.** Tenant 2 has a populated `lockedDbIds`, so `getLockedDbId`'s suffix arithmetic sends it to `db-tasks-cmoa44mj`, which does not exist → empty screen, not Florin's data. **Isolation currently holds by string arithmetic on a suffix, not by a boundary.** `R1-2` replaces the arithmetic with a lookup.

## A2 · ✅ `R1-0` IS ALREADY DONE
`src/app/api/test-payment-plan/route.ts` **no longer exists.** Verified 2026-09-16. `R1` now starts at `R1-1a`.

## A3 · `R1-1a` IS A **THREE**-WAY RECONCILIATION, NOT TWO
The spec above describes `SYSTEM_DB_PREFIXES` (14) vs `BASE_TO_KEY` (16). The census reveals a **third population: load-bearing databases registered in NEITHER list.**

- **`db-projects-hr`** — not in `SYSTEM_DB_PREFIXES`, not in `BASE_TO_KEY`, named **"New Workspace"** (which is on `GARBAGE_NAMES`), **0 pages**.
  🛑 **`schema-cleanup/route.ts:129` classifies it as garbage and `:336` deletes garbage with zero pages. Nothing stops it.** It survives only because nobody has run the cleanup.
  - [ ] **Decide what it is** — real system database (add to both lists) or dead (delete deliberately). **It must not remain in a state where a maintenance script decides for us.**
  - [ ] **Until then: do not run `schema-cleanup`.**
- **`db-journal-general`** — in `BASE_TO_KEY`, not in `SYSTEM_DB_PREFIXES`, 11 pages. Already named in the spec; the census confirms it is live.

## A4 · 🔴 `R1-2` — THE FAIL-OPEN DEFAULT EXISTS IN **TWO** PLACES
The spec names `TenantContext.tsx:26`. The census found the server-side twin:
```ts
// lib/lockedDbUtils.ts:62 — the last line of getLockedDbId
return base; // Legacy FOUNDER fallback — bare IDs still work
```
**A tenant with an empty `lockedDbIds` resolves `db-tasks` to `db-tasks` — Florin's, 68 live rows.** The window is any tenant created but not yet provisioned, or partially provisioned, or read before the map is populated.

- [ ] **Both die in the same commit.** A fallback that silently returns another tenant's data is not a fallback; it is a leak with a comment. **Two fail-open defaults, two identical reassuring comments — that is the pattern, not the coincidence.**

## A5 · 🔴 NEW — THE CLIENT AUTO-CREATES DATABASES, AND THAT IS WHERE THE BARE IDS CAME FROM
`DatabaseClone.tsx:961-983` creates a missing database **in the browser**:
```js
let parsedName = 'New Workspace';                    // ← the default
if (databaseId === 'db-quotations') parsedName = 'Quotations';
// …a hardcoded map. NO ENTRY for db-tasks, db-journal-general, db-projects-hr
if (parsedName === 'New Workspace') { return; }      // ← SCHEMA-1a guard: creates nothing
```

**Three consequences, and the third is an onboarding blocker:**
1. **The four "New Workspace" databases are fossils** of this path, created before the name map had entries. They are now unrecreatable and protected from cleanup only by having rows in them.
2. **The `+ Add Database` button is dead.** `dynamic-db/page.tsx:26` calls `createDatabase('New Database', …)`; `store.ts:816` rejects exactly that string. **`SCHEMA-1a`'s garbage-name guard killed the feature it was protecting.**
3. 🛑 **A new tenant cannot obtain a Tasks database at all.** `db-tasks` is not in `SERVER_PROVISIONED_BASES` (8 entries) **and** has no entry in the client name map → the guard fires → nothing is created. **The free-tier tenant opens Tasks and gets "Initializing workspace…" forever.**

### 🔺 A5b · TIER ENTITLEMENT — Florin, 2026-09-16: *"tenant tiers: not all get tasks module"*
**Correct, and it sharpens A5 rather than dismissing it.** Provisioning must be **tier-aware**, so "tenant 2 has no Tasks database" may be the right outcome. But that makes the following non-negotiable:

- [ ] 🔴 **NOT ENTITLED and ENTITLED-BUT-UNPROVISIONABLE must be distinguishable.**

  **🔻 PLANNER CORRECTED — Florin, 2026-09-16:** *"Not at all. The module is not available AT ALL. Not in options, not in UI. Still thinking if partial upgrade and per-module pay is an option. But NOT now, maybe when we have a stable tenant base."*

  I proposed an in-product upgrade path. **Rejected, and the rejection is the better design:**
  - **NOT ENTITLED → the module DOES NOT EXIST for that tenant.** Not in navigation, not in settings, no route, no locked screen, no upsell. **There is no empty screen to misinterpret, because the user never arrives at one.**
  - **ENTITLED BUT UNPROVISIONABLE → a loud, named error.** The only remaining failure state.

  **This removes the ambiguity structurally rather than by wording** — which is strictly better, and the same principle as the seraph: *make the bad state unreachable instead of explaining it.*

  ⚠️ **The current implementation does the opposite.** `LockedFeature` renders **"Module Upgrade Required — contact the Superadmin or upgrade your tenant subscription"** on **7 surfaces**: `admin/tasks`, `admin/crm`, `admin/library/articles`, `admin/library/bestek`, `admin/files`, `admin/email`, `m/files`. Plus `upgradePlan` / `moduleUpgrade` / `settings_upgrade_to` strings in all four locales.

  - [ ] **Not an `R1` item — recorded, not scheduled.** `R1` must not build *on top of* the upsell pattern, but ripping it out is a separate product change. **Per-module pricing is explicitly deferred until there is a stable tenant base.**
  - [ ] **What `R1` owes it:** entitlement must be resolvable early enough to decide whether a module **exists** for a tenant — at navigation build time, not at page render. That is an `R1` requirement because it is the same reconciled list.
- [ ] **A tenant WITH the TASKS module must be provisionable today. It is not** — no server provisioning entry, no client name-map entry. **That half of A5 stands regardless of tiering.**

### 🔴 A5c · ENTITLEMENT IS ENFORCED IN TWO PLACES WITH DIFFERENT COVERAGE — a third disagreeing list
```
moduleGuard.ts  MODULE_ROUTE_MAP   11 entries — includes 'tasks': 'TASKS', 'hr', 'calendar', 'websites', 'email', 'databases'
pages.ts        DB_ID_MODULE_MAP    8 entries — db-tasks ABSENT
                requiredModuleForDb('db-tasks') → null  →  "no module gate"
```
**The route `/admin/tasks` is gated. The database `db-tasks` is not.** A tenant without the TASKS module is stopped at the page and unguarded at the data door — and `/m/tasks`, the mobile PWA, is a different route entirely.

Also absent from `DB_ID_MODULE_MAP`: `db-1` (PROJECTS), `db-crm`, `db-bobex`, `db-articles`, `db-bestek`, `db-journal-general`, `db-projects-hr`. **Seven databases with no data-layer entitlement check**, silently returning `null` — *"no module gate"* — which is a **fail-open default in a third location.**

- [ ] **One entitlement map, derived from the reconciled database list.** A database's required module is a property of the database, declared once — **not two hand-maintained arrays that already disagree.**
- [ ] **`requiredModuleForDb` returning `null` must mean "deliberately ungated", recorded explicitly** — never "not found". Same rule as `R1-2`: **absence is a question, not an answer.**
- [ ] **Entitlement is checked at the data door**, not only at the route. Routes multiply — `/admin/tasks`, `/m/tasks`, the API, a future public surface — and each one re-asks the question. **The database door asks it once.**
- [ ] **Belongs in `R1-1a`'s reconciliation**, since it is the same list read a third way.

- [ ] **`R1` removes client-side database creation entirely.** Provisioning is a server capability; a browser must not be able to bring a database into existence.
- [ ] **`provisionTenantDbs` covers every key in the reconciled list**, not the current subset of 8.
- [ ] **`R1` must verify provisioning completeness per tenant** rather than assume it — a missing database is a loud, named error, never an empty screen. *(`LAZY-2`'s not-loaded-vs-empty rule, one level up.)*
- [ ] **This unblocks the custom-grid request** (`dynamic-db`), which is otherwise a day's work sitting behind this gate. Do not build it first — it would manufacture more of exactly what `R1` is cleaning up.

## A6 · FOUR BYPASSES THE SCOPED CLIENT DOES NOT CLOSE BY ITSELF
From `coral-seraph-stress-test.md` — each needs an explicit line in `R1-4/5`:
- [ ] **`$queryRaw` is not intercepted by a Prisma extension.** 3 sites today, **all correctly scoped**, but nothing stops a fourth. **The scoped client must not expose `$queryRaw`/`$executeRaw` at all.**
- [ ] **`GlobalPage` has no `tenantId`** — scope is transitive via `databaseId`. A per-model scoped client **cannot** secure it. **This is why `R1-3` (never trust a supplied id) is load-bearing and not hygiene:** the gate sits at id resolution, not at query time.
- [ ] **Warm-lambda module caches** serve tenant B from tenant A's fetch with no query running — invisible to every test we have. **No cross-request cache may be keyed by anything but a tenant-qualified key.** *(None found today; `lib/prisma.ts`'s `globalThis` singleton caches connections, not rows, and is correct.)*
- [ ] **Impersonation is the one legitimate door.** All 11 functions in `superadmin.ts` call `verifySuperadmin()` — **verified, no gaps.** `impersonateTenant` needs: audit log (who, which tenant, when), a **visible** session indicator, and an expiry.

## A7 · 🔴 THE CLOSURE CONDITION — `R1` IS NOT DONE WHEN CALL SITES ARE MIGRATED
**Every verification in this spec is a grep.** Greps prove a pattern is absent from *code*; they prove nothing about *data*. That is the same error as the retracted `C1` blocker and the 38 `t-*` records, one level up.

- [ ] **`tests/tenant-isolation.test.ts` — a NEGATIVE suite.** Seed two tenants with overlapping-looking data. For **every** read path — page index, search, grid, documents, exports, files, jobs — run as tenant A and **assert zero rows belonging to B**. Assert on the **query**, not only the result, so an empty database cannot produce a false pass.
- [ ] **First concrete case, straight from the census:** *a tenant with empty `lockedDbIds` must resolve nothing, rather than resolve to the founder's databases.*
- [ ] **The gate closes when all five hold** (`coral-seraph-stress-test.md` §4): no unscoped client constructible below the gate · resolver fails closed · server never trusts a supplied id · the four bypasses shut · **this suite green.**

## A8 · MEASUREMENTS REFRESHED 2026-09-16
`startsWith('db-` → **43** sites *(spec said 55)* · `prisma.globalPage` → **95** *(said 93)* · `prisma.globalDatabase` → **34** ✓ · full suite **125 tests** *(said 70)*.
**`R1-1b`'s backfill now has a measured cost: 8 bare-id databases carrying 9,226 pages.** `db-bestek` alone is 8,216 — **rehearse the migration on the Neon `staging` branch first.**

---

## THE WORK

### ~~R1-0 · DELETE THE SCRATCH ROUTE~~ ✅ **ALREADY DONE** — route no longer exists (verified 2026-09-16)

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
