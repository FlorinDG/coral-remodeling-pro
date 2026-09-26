# CORAL — WALK-DOWN — ENTITLEMENT (the guestlist) — Planner 2026-09-26

> **Florin:** *"kernel into kernel, core to core and seraph the piece of paper with the guestlist… then modules fall into their shape without guesswork, without loose setters."*

**This gate was in the original framing.** Florin's first mindmap request read *"kernel → core → TENANT GATE → module → **other gates** → submodule → leaves."* **Entitlement is one of the other gates**, at the same level as tenancy — not a detail of it. The Planner treated it as a sub-problem of id parsing for two days.

---

# THE SERAPH HOLDS TWO BOOKS

| Book | Question | Today |
|---|---|---|
| **the bindings** | which databases does this tenant have? | `Tenant.lockedDbIds` — read by **4 parsers** |
| **the guestlist** | which modules may this tenant use? | `Tenant.activeModules` — read by **4 gates**, **2 freshness models** |

**Same shape, same rule, same failure mode.** Tenant-scoped, one-directional, asked through the scope, throws when absent.

---

# THE FOUR SOURCES — measured 2026-09-26

| # | List | Size | Answers | Reads from |
|---|---|---|---|---|
| 1 | `MODULES` — `settings/team/page.tsx:32` | 7 | what can be **granted** | — |
| 2 | `MODULE_GATE` — `middleware.ts:309` | 13 routes / 8 modules | what blocks a **route** | 🔴 **the JWT** |
| 3 | `MODULE_ROUTE_MAP` — `moduleGuard.ts:16` | 11 routes / 8 modules | what blocks a **server action** | the **database** |
| 4 | `DB_ID_MODULE_MAP` — kernel, via `createPageServerFirst` | 6 of 16 roles | what blocks **creating a record** | the database |

## 🔴 THE THREE CONFLICTS
- **`CRM` is in 1 and 4, absent from 2 and 3.** Grantable, gates record creation, **gates no route and no action.** A tenant without `CRM` browses the whole pipeline. *(Florin: "gate the pipeline. there's business logic behind this.")*
- **`EMAIL` and `WEBSITES` are in 2 and 3, absent from 1.** Gateable but **ungrantable** — permanently closed to every non-superadmin tenant.
- **2 and 3 are near-duplicates that drifted.** `portals→PROJECTS` and `workhub→HR` exist only in the middleware. Nothing holds them together.

## 🛑 AND THE LEAK — two freshness models for one question
`middleware.ts` reads `token.activeModules`. `moduleGuard.ts` reads the database, **deliberately** — its own comment says *"to avoid stale-token window."*

> **Revoke a module and route access survives until the token expires.**

On a free-tier-per-prospect model that is a **revenue leak**, not a cosmetic one: downgrade a tenant, they keep the UI for the rest of their session. **The file that reads the DB documents the bug in the file that reads the token, and nothing reconciles them.**

---

# L0 · KERNEL — what modules ARE
```ts
// src/lib/kernel/modules.ts
export const MODULES = [ 'INVOICING','CRM','PROJECTS','CALENDAR','DATABASES','HR','TASKS', … ] as const;
export type Module = typeof MODULES[number];
```
- [ ] **One closed vocabulary.** Tenant-independent, grant-independent. *(Exactly `SYSTEM_DATABASE_ROLES`, one gate over.)*
- [ ] 🔴 **Grantable and gateable become the same list by construction.** `EMAIL`/`WEBSITES` either join `MODULES` or come out of the gates. **A module that can be required and cannot be given is a locked door with no key.**
- [ ] **No prisma import.** Kernel.

# L0 · KERNEL — what each module MEANS
```ts
export interface ModuleSpec {
    module:    Module;
    routes:    string[];               // route segments it gates
    dbRoles:   SystemDatabaseRole[];   // database roles it gates
    grantable: true;                   // 🛑 no `false` — see above
}
export const MODULE_SPECS: Readonly<Record<Module, ModuleSpec>>;
```
- [ ] **Sources 1–4 all derive from this.** `MODULE_GATE`, `MODULE_ROUTE_MAP` and `DB_ID_MODULE_MAP` become computed.
- [ ] 🔴 **Every system database role appears in exactly one `dbRoles`, or in a declared `UNGATED` set.** **Absence must not mean ungated** — that is how 10 of 16 ended up open without a decision.
- [ ] **Every gated route appears once.** A route in two specs fails the build.

# SERAPH · the guestlist
```ts
scope.may(module: Module): boolean      // the only entitlement question
```
- [ ] **One reader, reading the database.** 🛑 **The JWT copy is a UI hint, never a gate.** *(It may stay for rendering; it may not decide.)*
- [ ] **Revocation is immediate**, because there is no second copy to go stale.
- [ ] 🔴 **`scope.may(x)` ASKS. `token.activeModules.includes(x)` ASSERTS.** *(AUTHORITY DIRECTIVE — asked for, never asserted. The same correction `DI-1` needed.)*
- [ ] **Unknown module → throws.** Fail closed. A typo'd module name must not read as "ungated".

# L1 · CORE · one enforcement primitive
```ts
requireModule(module: Module): void     // throws a typed refusal
```
- [ ] **Middleware, server actions and record creation all call this.** Three call sites, one decision.
- [ ] **The refusal is typed and visible** — not a swallowed `false`. *(`HRA-4`'s lesson: a refusal is the answer, not an error to hide.)*
- [ ] **Superadmin bypass lives HERE, once.** Today it is re-implemented in `middleware`, `moduleGuard` and `pages.ts` — **three copies of a privilege escalation.**

# L2 · MODULES · declare, never decide
- [ ] **A route declares the module it needs. A database role declares its module. Neither checks anything.**
- [ ] 🛑 **No module holds a map. No module reads `activeModules`. No loose setters.** *(Florin's words, and the operative rule.)*

---

# ORDER
```
kernel vocabulary  →  MODULE_SPECS  →  seraph scope.may()  →  core requireModule()  →  modules declare
                              ↑
              🔴 CRM's routes and the EMAIL/WEBSITES decision land here, as data
```
**`crm → CRM` stops being a line someone adds.** It becomes a cell that cannot be left empty, because the table does not compile with a role neither gated nor explicitly ungated.

## 🛑 BEFORE ANY GATING IS TURNED ON — Florin, production, read-only
```sql
SELECT "companyName", "planType", "activeModules" FROM "Tenant";
```
**If `BV CORAL` lacks `CRM`, gating the pipeline locks Florin out of his own pipeline.** 🔴 **Entitlement is the one gate whose over-tightening is indistinguishable from an outage.** Measure first.

## FLORIN'S DECISIONS
- [ ] **`EMAIL` / `WEBSITES`** — grantable, or drop the gates?
- [ ] **The 10 ungated database roles** — which module owns each, or explicitly ungated?
- [ ] **`CRM`'s routes** — which segments belong to the pipeline?
