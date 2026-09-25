# CORAL — WALK-DOWN — PROJECT IDENTITY — Planner 2026-09-24

> **Florin:** *"what belongs in the kernel? what belongs in the core? is there anything there that is the seraph's job to hold? and ONLY then go to the modules."*

Applied to *"which database is the projects database, and what is a project reference."* **The rough edge is not in HR. It is in the kernel, and it is load-bearing.**

---

# L0 · KERNEL — 🔴 THE VIOLATION IS HERE

## What the kernel SHOULD own
1. **Minting a database id.** Server-side *(`KERN-3b`, still open)*.
2. **That an id is OPAQUE** — nothing about a database is recoverable by reading its id.
3. **The system-database role vocabulary** as a closed type. `LockedDbKey` already exists and is correct: 16 roles, `projects` among them.

## 🔴 What it actually does — `src/lib/lockedDbUtils.ts`
**Tenant database ids are composites: `<base>-<tenantSuffix>`. Tenancy is encoded in the id text and recovered by parsing it.**

```ts
const anyMappedVal = Object.values(lockedDbIds).find(val => val.includes('-'));
const parts  = anyMappedVal.split('-');
const suffix = parts[parts.length - 1];       // 🔴 tenancy, recovered by string surgery
return `${base}-${suffix}`;                   // 🔴 identity, DERIVED not minted
```

**Four defects, stacked:**

| | |
|---|---|
| **① Identity is derived, not minted** | 🛑 Direct breach of the **IDENTITY DIRECTIVE** *(`pd.md`: minted below, read-only above)*. `getLockedDbId` **constructs** database ids. |
| **② It runs in the BROWSER** | The file's own header says *"CLIENT SAFE… Safe to import from client components"* — and it is, from `TenantContext.tsx` and four `m/*` pages. **Tenant database identity is computed client-side.** Same defect as `KERN-3`, which we already fixed for *creation* and missed for *resolution*. |
| **③ An id is not opaque** | `id.split('-')` yields the tenant. Any id leaked anywhere leaks a tenant discriminator, and **any code may invent a valid-looking id for another tenant by swapping the suffix.** |
| **④ 🛑 The last fallback is the ZOMBIE, in a comment** | ```return base; // Legacy FOUNDER fallback — bare IDs still work``` **The resolver's final answer is "return the bare id, which works for the founder."** For any other tenant that is a database they do not own or that does not exist. *Sample size of one, written down and shipped.* |

## 🔴 ⑤ AND THE MINT ITSELF DERIVES — `provisionTenantDbs.ts:53`
```ts
const suffix   = tenantId.slice(0, 8);      // 🔴 tenancy, sliced out of the tenant id
const scopedId = `${base}-${suffix}`;       // 🔴 the CANONICAL path derives too
```
**The composite id is not a resolver workaround — it is the minting convention.** `getLockedDbId`'s string surgery is *correct behaviour* for the ids this function creates. **The resolver is downstream of the defect, not the defect.**

---

# 🔴 THE CANONICAL RULE — one sentence, and everything follows

> ## **An id is never parsed. The binding is always read.**

**`Tenant.lockedDbIds` is the truth.** The text of an id means nothing — not `db-1`, not `db-invoices-abc12345`, nothing.

- 🟢 **This is why legacy ids need no migration and no fallback.** A bare `db-1` keeps working *because the binding names it*, not because a branch guesses at it. **The exception disappears without the data moving.**
- 🟢 **New ids are minted opaque** (`cuid`, via the kernel). Old ones stay as data. **Both are read the same way, because neither is read at all — the binding is.**
- 🛑 **`tenantId.slice(0, 8)` comes out of the mint.** A newly provisioned tenant must not carry its tenant id inside its database ids.

**This is the no-workarounds answer.** Not "keep the fallback for the founder", not "rewrite 9,226 rows". **Stop parsing, and the question of what an id looks like stops being a question.**

---

## `KERN-5` · WHAT THE KERNEL MUST BECOME
- [ ] **Database ids are opaque cuids. No suffix, no base, no parsing.** *(Existing ids are not rewritten — see `L1` below.)*
- [ ] **`getLockedDbId` is deleted, not fixed.** Every one of its four branches is a guess. **A function with four fallbacks is a function that does not know the answer.**
- [ ] 🛑 **No client module may derive a database id.** The `R1-5`-style ratchet applies: `lockedDbUtils` comes off the client-safe list and dies.
- [ ] **`'db-1'` is a name doing an identifier's job** — the exact `KERN-3` shape. **The role is `projects`. `'db-1'` is a legacy alias and must stop appearing in application code** *(54 literals today)*.

---

# SERAPH · WHAT THE GATE MUST HOLD — and this is the whole answer

**"Which database is the projects database" is a TENANT-SCOPED QUESTION.** It has no answer without a tenant, and a wrong answer is a cross-tenant read.

> 🔴 **Therefore the binding role → id belongs to the scope, and nowhere else.**

```ts
// on TenantScopedClient — TSC-0 D3: the tenant is NEVER a parameter
scope.systemDatabase('projects'): string     // throws if unbound. No fallback. No default.
```

- [ ] **`scope.systemDatabase(role)` is the ONLY way to obtain a system database id.**
- [ ] 🛑 **It throws when the role is unbound.** No `|| 'db-1'`, no suffix synthesis, no self-healing. *(`R1-2`: absence is a question, not an answer.)*
- [ ] 🟢 **This makes the three fail-opens unwritable rather than fixed.** There is no `lockedDbIds` object in scope to `||` against — **the expression cannot be typed.** *(Displacement rule: the primitive is done when the thing it replaces cannot be said.)*
- [ ] **Provisioning (`provisionTenantDbs.ts`) is the only writer**, and it mints opaque ids through the kernel.

**This is the seraph's job precisely because it is the one question whose answer changes per tenant and whose wrong answer crosses the boundary.** Everything above reads it; nothing above computes it.

---

# L1 · CORE — the project reference

With the seraph answering *which database*, the core owns *what a project reference is*:

- [ ] **`ProjectRef` = a page id in `scope.systemDatabase('projects')`.** One type, one meaning.
- [ ] **`D-A` lives here** — *"is this id a project page"* is `page.databaseId === scope.systemDatabase('projects')`. **Not expressible as a FK** (`GlobalPage` is polymorphic), so it is a core function called by the scoped client on every write that sets a project reference. **Written once.**
- [ ] **Legacy composite ids are not rewritten.** They stay as data; they simply stop being *parsed*. The binding in `Tenant.lockedDbIds` is the truth, whatever the id looks like.
- [ ] **`InternalProject` keeps the page's id** *(already true for quote-born projects)* and becomes an ERP-side record **about** the project, never a second identity.

---

# L2 · MODULES — what is left for HR, and it is almost nothing

> **Florin:** *"HR consults and asks for information, does not write into it."*

**That is `upwards written, downwards read-only` applied to a module, and it is the correct reading.** Every project defect in HR comes from HR holding a *writable opinion* about projects:

| HR held | Becomes |
|---|---|
| its own `HrProject` table | **deleted** |
| its own project create/update/delete (`useProjects.ts:40`, `useScheduledShifts.ts:261`) | **deleted** |
| its own resolution `locked['projects'] \|\| 'db-1'` (`route.ts:146`) | **deleted** — it asks the scope |
| its own name enrichment against `hrProject` (`route.ts:345`) | **deleted** — the core resolves |
| the `[ERP] ` prefix distinguishing two lists | **deleted** — there is one list |
| the `erp-projects` virtual merge entity | **deleted** — there is nothing to merge |

- [ ] **HR receives a `ProjectRef` and reads through it. It never resolves one and never creates a project.**
- [ ] 🟢 **Six deletions, one addition.** *(The displacement rule says this is what a correct primitive looks like from below.)*

---

# THE COUNT — what "one projects database" actually costs
| | |
|---|---|
| `resolveDbId('db-1')` call sites | **20** |
| bare `'db-1'` literals | **54** |
| fail-open `\|\| 'db-1'` | **3** — `journal/page.tsx:105` · `api/portals/route.ts:19` · `api/hr/[entity]/route.ts:146` |
| `getLockedDbId` fallback branches | **4** |

**`PROJ-0c` was never one line.** `'db-1'` is a magic string the whole ERP repeats, and every repetition is a place to be wrong.

---

# ✅ `D-B` RESOLVED — Florin's framing changes the answer
> *"project does NOT OWN them, is just deeply integrated."*

**Correct, and it overrides the Planner's `Restrict` recommendation.** If the project is an attribute of the hours rather than their owner, `Restrict` lets the child govern the parent's lifecycle — a project that ever had one clocked hour could never be deleted.

- [ ] **`onDelete: SetNull`.** The hours survive; they lose a label.
- [ ] **The P&L concern moves to the layer that owns it:** the app **asks** before unlinking, and an *Unassigned hours* report surfaces the result. **Not a database constraint that silently forbids deletion.**
- [ ] 🟢 **Same principle as `HRA`:** drop the linkage, never the work — **and tell the user.** *(Automation is good, but the user remains the ultimate authority.)*

---

# ORDER — kernel first, and it is not optional
```
KERN-5  opaque ids · delete getLockedDbId · kill the founder fallback
   ↓
SERAPH  scope.systemDatabase(role), throws — makes the 3 fail-opens unwritable
   ↓
L1      ProjectRef + D-A, written once
   ↓
D-C     Florin's manual HrProject reconciliation
   ↓
L2      HR's six deletions
```

🛑 **Doing L2 first is the trap.** Deleting `HrProject` while resolution is still a client-side string heuristic moves every HR link onto an id that four fallback branches are guessing at. **The links would point at the right table and the wrong database.**

## STILL NEEDED FROM FLORIN
- [ ] **Census query 3** — how many shifts point at `HrProject`. The cost of `D-C`.
- [x] ~~`D-B`~~ — resolved above.
