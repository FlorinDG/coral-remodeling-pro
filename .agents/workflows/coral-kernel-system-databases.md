# CORAL — ARCHITECTURE — SYSTEM DATABASE IDENTITY — Planner 2026-09-24

**The kernel does not know what its own system databases are.** Three lists disagree, resolution is a client-side string heuristic with four fallbacks, and the last one is the founder zombie in a comment.

**Measured, production + staging, 2026-09-24. Nothing here is inferred.**

---

# THE CENSUS

| | |
|---|---|
| Roles `BASE_TO_KEY` knows | **16** |
| Roles `LOCKED_DB_BASES` provisions | **8** |
| Roles bound for the one non-founder tenant | **6** |
| `resolveDbId('db-1')` call sites | **20** |
| bare `'db-1'` literals | **54** |
| fail-open `\|\| 'db-1'` | **3** |
| `getLockedDbId` fallback branches | **4** |

**`projects` is in the 16 and not in the 8.** It is **never provisioned for any tenant**. `BV CORAL`'s exists because it was made by hand in the founder era — which is why it is `db-1` and not `db-projects-<suffix>`.

### What that produces today — observed, not predicted
- **`Murgu, Catalin`** (free tier) has 6 of 16 bound. Asking for `projects` returns **`db-1-cmoa44mj`** — synthesised by splitting an unrelated id. **That database has never existed.** Ten modules resolve to ghosts and return silence.
- **Broken, not leaking.** Server paths carry `database: { tenantId }`, so the guard holds. **The tenant sees empty modules, not someone else's data.**
- **`hr` → `db-hr` resolves to nothing** even for `BV CORAL`. A bound role pointing at no database.
- **`db-projects-hr`** exists, belongs to `BV CORAL`, is bound to no role. 🛑 **Decide before deleting.**
- ✅ **All 13 project-linked shifts point at pages in `db-1`.** `D-A` has never been violated. **`D-C` (manual `HrProject` reconciliation) is EMPTY WORK** — `HrProject` is deleted with nothing to map.

> ### The defect in one sentence
> **An unbound role returns a confident wrong answer instead of a refusal.**
> That is not a free-tier limitation. It is the kernel answering a question it cannot answer.

---

# THE CANONICAL RULE

> ## **An id is never parsed. The binding is always read.**

`Tenant.lockedDbIds` is the truth. The text of an id means nothing — not `db-1`, not `db-clients-cmneyas2`.

- 🟢 **Legacy ids need no migration and no fallback.** A bare `db-1` works *because the binding names it*, not because a branch guesses. **The exception disappears without the data moving.**
- 🟢 **New ids are opaque cuids**, minted by the kernel. Old ones stay. **Neither is read — the binding is.**
- 🛑 **`tenantId.slice(0, 8)` comes out of the mint.** A tenant's id must not be recoverable from its databases' ids.

---

# L0 · KERNEL — what it owns

## `K1` · ONE vocabulary, one source
```ts
// src/lib/kernel/system-databases.ts
export const SYSTEM_DATABASE_ROLES = [
  'invoices','clients','suppliers','expenses','tickets','quotations',
  'payments-in','payments-out','projects','tasks','articles','crm',
  'bobex','bestek','journal-general','hr',
] as const;
export type SystemDatabaseRole = typeof SYSTEM_DATABASE_ROLES[number];
export const SYSTEM_DATABASE_NAMES: Record<SystemDatabaseRole, string>;
```
- [ ] **`BASE_TO_KEY`, `LOCKED_DB_BASES` and `DB_NAMES` collapse into this.** 🔴 **Three lists become one or the bug returns.**
- [ ] **`LockedDbKey` is replaced by `SystemDatabaseRole`** — same values, one definition.

## `K2` · Provisioning provisions ALL of them, with opaque ids
- [ ] **`provisionLockedDatabases` iterates `SYSTEM_DATABASE_ROLES`, not an 8-item subset.** 🔴 **`projects` gets provisioned. That is the headline fix** — the free-tier-per-prospect model depends on it.
- [ ] **Ids are `cuid()`, minted through the kernel.** 🛑 **Delete `const suffix = tenantId.slice(0,8)`.**
- [ ] **Idempotent by BINDING, not by id guess:** a role already present in `lockedDbIds` is skipped. Never `findUnique` on a constructed id.
- [ ] 🟨 **Entitlement is not provisioning.** Provision all 16; `activeModules` decides what a tenant may *use*. **A free tier with no projects database is a broken tenant, not a limited one.**

## `K3` · `getLockedDbId` is DELETED, not repaired
**Four fallback branches means it never knew the answer.** All four go: the value-membership check, the suffix-match, the suffix synthesis, and `return base // Legacy FOUNDER fallback`.
- [ ] 🛑 **`src/lib/lockedDbUtils.ts` is removed from client-safe status and deleted.** No client module derives a database id. *(IDENTITY DIRECTIVE.)*

---

# SERAPH · the binding is tenant-scoped, so the gate holds it

**"Which database is the projects database" has no answer without a tenant, and a wrong answer crosses the boundary.**

```ts
scope.systemDatabase(role: SystemDatabaseRole): string   // throws if unbound
```
- [ ] **The only way to obtain a system database id.** Tenant is never a parameter *(`TSC-0 D3`)*.
- [ ] 🛑 **Throws when unbound.** No default, no synthesis, no self-healing. *(`R1-2`.)*
- [ ] 🟢 **The three fail-opens become UNTYPEABLE** — there is no `lockedDbIds` object in scope to `||` against. **Not fixed: unsayable.** *(Displacement rule.)*

### 🟨 Before `R1-4` exists — the single door, staged honestly
`R1-4` is not built. So the accessor lands **now** as the one server-side door and **becomes a method** when the client lands:
```ts
// src/lib/data/system-databases.ts — the ONLY server resolver
export async function systemDatabaseId(tenantId, role): Promise<string>;   // throws if unbound
```
- [ ] **One door today, one method tomorrow. Never two doors.**
- [ ] **The client does NOT resolve.** `TenantContext` already receives the binding map from the server; `resolveDbId(role)` becomes a **plain lookup that returns `null` on miss** — no string work, no fallback. **Server resolves, client reads.** *(upwards written, downwards read-only.)*

---

# L1 · CORE · the project reference
- [ ] **`ProjectRef` = a page id in `scope.systemDatabase('projects')`.** One type, one meaning.
- [ ] **`D-A` lives here:** *is this a project page* is `page.databaseId === scope.systemDatabase('projects')`. **Not expressible as a FK** — `GlobalPage` is polymorphic — so it is a core function the scoped client calls on **every write that sets a project reference. Written once.**
- [ ] ✅ **Currently clean:** all 13 linked shifts point into `db-1`. **Enforcing it now costs nothing; enforcing it after the second tenant schedules work costs a data repair.**
- [ ] **`InternalProject` keeps the page's id** and is a record *about* the project, never a second identity.

---

# L2 · MODULES · HR consults, never writes
> **Florin:** *"HR consults and asks for information, does not write into it."*

| Deleted | Where |
|---|---|
| the `HrProject` table | schema + model |
| the scheduler's project CRUD | `useProjects.ts:40` · `useScheduledShifts.ts:261,271,281` |
| its own resolution | `route.ts:146` |
| name enrichment against `hrProject` | `route.ts:345` · `timesheet-export:103` · `timesheet-reports:125` |
| the `[ERP] ` prefix | `useScheduledShifts.ts:119` · `route.ts:353` |
| the `erp-projects` virtual merge entity | `route.ts:137-200` |

- [ ] **HR receives a `ProjectRef` and reads through it.** Never resolves one, never creates a project.
- [ ] ✅ **`onDelete: SetNull` on every workforce-side project reference** — Florin: *"project does NOT OWN them."* The hours survive; they lose a label. The app **asks** before unlinking, and an *Unassigned hours* report surfaces the result.
- [ ] 🟢 **Six deletions, one addition.** That is what a correct primitive looks like from below.

---

# ORDER — and the trap
```
K1 vocabulary  →  K2 provisioning  →  BACKFILL (Florin)  →  K3 delete resolver
   →  seraph accessor  →  L1 ProjectRef + D-A  →  L2 HR deletions
```

🛑 **Doing L2 first is the trap.** Deleting `HrProject` while resolution is still a client-side heuristic moves every HR link onto an id four fallback branches are guessing at — **right table, wrong database.**

🛑 **`K3` cannot precede the backfill.** Delete the fallback while a tenant has unbound roles and that tenant's modules go from *silently empty* to *hard error*. **The backfill is what makes the refusal correct instead of merely loud.**

## FLORIN'S ITEMS
- [ ] **Backfill bindings** for both tenants — after `K2`, run provisioning; it is idempotent by binding.
- [ ] **Decide `db-projects-hr`** — the HR projects database `PROJ-0` retires, or junk. 🛑 Not deleted before the decision.
- [ ] **`hr` → `db-hr` resolves to nothing.** Create it, or drop the binding.
