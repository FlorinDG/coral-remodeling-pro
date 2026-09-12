# CORAL — THE SYSTEMS PASS — root-to-leaf, tenant-ready by design (Planner 2026-09-12)

**Florin:** *"We start at fixing what is system now. For the last time. We go how not what from ground up. Ex: grid — still not completely done. We work from root to leaf and everything has to be tenant ready designed."*

This document is the **method**. It does not list bugs — `coral-roadmap.xlsx` has 215 of those, and listing them again is the failure mode we are leaving behind. Individual specs stay where they are; this governs how they get picked up.

---

## WHY THE PREVIOUS APPROACH KEEPS COSTING

Every defect this year has one of four shapes, and none of them is a leaf problem:

| Shape | Instances |
|---|---|
| **Two representations of one concept** | OCC hash vs `blocksVersion` · `User` vs `Employee` id (the "HR data loss") · `EXPENSE_CATEGORIES` vs `COST_TYPES` · leave-as-shift vs `TimeOffRequest` · **three ways to read a blob** |
| **Silent failure** | `.catch(() => [])` hiding shifts · dropped mail attachments · **the accountant export stamping documents it never shipped** |
| **Read-modify-write race** | sales-grid cell commit (N1) · sync queue single-flight (OCC-15) · store persist |
| **Scoping applied per-surface instead of at the boundary** | admin bypass missing in timesheet reports · `useScheduledShifts` employee map · **unscoped `GlobalPage` writes, below** |

Fixing instances of these has not reduced their rate, because the *shape* is reproduced every time a new surface is written. **A root fix is one that makes the shape unexpressible.** That is the only kind of work in this pass.

---

## THE METHOD — three rules, applied to every root

**1 · State the invariant, not the fix.**
A root is finished when a property is true of the whole system, phrased so that a violation is a factual question, not a judgement. *"Every page read is scoped to the session tenant"* — not *"add tenantId to the reports query"*.

**2 · Enforce it mechanically. Discipline is not an enforcement mechanism.**
Each invariant needs a gate that makes violation **impossible** (types, a wrapper that is the only door), **impossible to merge** (lint rule, CI grep, test), or **impossible to miss** (loud failure). If the only thing holding an invariant is that the coder remembered, it is not enforced — and it *will* regress, because `pd.md` has instructed the coder correctly all year and these four shapes still recurred.

**3 · Then, and only then, the leaves — and every leaf fix names its root.**
A leaf fix that cannot be traced to a root invariant means the root is wrong or missing. That is the signal to stop and re-cut the root, not to patch the leaf. **This is what "root to leaf" buys: the leaf list shrinks on its own.**

**Definition of done for a root:** invariant stated · enforcement merged · the *existing* violations found by that enforcement listed · characterization test pinning current correct behaviour · **and the enforcement demonstrably fails when someone violates it** (write the violation, watch it fail, delete it).

---

## THE SHAPE — the inverted pyramid (Florin, 2026-09-12)

> *"We either repair our modularity and start actually using the building blocks instead of reinventing the wheel, or we create pyramidal propagation… we should not be afraid to view the core functionality as an impenetrable monolith on which all builds — at ERP level, module level, and so on, branching logic."*

This is the architectural rule the whole pass serves. Stated so it is checkable:

```
        ┌─────────────────────────────────────────┐
L3      │  FEATURES   grid · engine · HR · portal  │   many, disposable, thin
        ├─────────────────────────────────────────┤
L2      │  MODULES    financials · projects · hr   │   few, own their domain rules
        ├─────────────────────────────────────────┤
L1      │  ERP CORE   record · document · money    │   one each, shared
        ├─────────────────────────────────────────┤
L0      │  KERNEL     tenancy · persistence · i/o  │   the monolith; nothing bypasses
        └─────────────────────────────────────────┘
```

**The three rules that make it real:**

1. **Calls go DOWN, never up or sideways.** A feature may call a module, a module the core, the core the kernel. A feature never reaches past its layer to the kernel — no component holds a `prisma` call, a `@vercel/blob` import, or its own totals arithmetic.
2. **Each capability exists exactly ONCE, at the lowest layer that needs it.** If two features need it, it moves down — it is never copied sideways. *Every* defect of shape #1 in this codebase is a sideways copy: three blob readers, five write doors, four line readers, two category systems, two leave models.
3. **The kernel is closed.** Reaching into it from outside its module is a build failure, not a review comment. BLOB-3 proved this works: `@vercel/blob` importers went 3 → 2 and are now held there by a grep gate.

**What "impenetrable" buys:** a defect in the monolith is fixed once and every branch inherits it. A defect in a sideways copy is fixed N times, and the Nth is discovered by a client. That is the entire difference between the year we had and the one we want.

**Corollary — this is why the leaf list shrinks.** `PI-LINES-1`, `PORTAL-QUOTE-LINE-TOTAL` and half the grid backlog are not independent bugs. They are the visible ends of capabilities that were copied sideways instead of pushed down. Push them down and the leaves close together.

### Answering "are all five absolute requirements?" — no.

Five server write doors is **one core plus four sideways copies**. The target is:

- **one** kernel write (tenant scope, OCC, tagging, audit) — the only thing that touches the database;
- **thin adapters** where a genuinely different *call shape* exists. Batch is the only real one: CSV import writes 2,000 rows and must not make 2,000 round-trips. That is a different shape, not different behaviour — **it calls the same core**.
- everything else **deleted**, not kept "for compatibility". A retained alternate door is a sideways copy with a polite name.

Same answer for R3: a grid cell does not get its own commit logic. It emits an intent to the core, like every other surface. **The grid stops being a system and becomes a view** — which is what "still not completely done" has been telling us.

---

## 🟥🟥 FOUND WHILE SCOPING THIS — act before the pass begins

Evidence for R1, and the reason it goes first.

**`src/app/api/test-payment-plan/route.ts` — an unauthenticated, cross-tenant WRITE endpoint in production.**
```js
export async function GET() {                       // no auth(), no CRON_SECRET, no guard
    const testQuote = await prisma.globalPage.findFirst({
        where: { database: { name: { contains: 'Quotation' } } }   // ANY tenant's quotation
    });
    …
    await updatePaymentPlanAction(testQuote.id, …)  // …and then writes to it
}
```
Anyone who can reach the URL mutates the payment plan of an arbitrary quotation. Today there is one tenant, so the blast radius is you. **Delete the route.** It is a scratch file that shipped.

**`src/app/api/cron/vat-backfill/route.ts` — correctly `CRON_SECRET`-guarded, but tenant-blind:**
```js
const invoices = await prisma.globalPage.findMany({
    where: { databaseId: { startsWith: 'db-invoices' } }   // every tenant's invoices
});
```
It then writes VAT figures. With one tenant this is invisible; on the day a second tenant exists, one cron run rewrites their financial data. **This is precisely "tenant ready designed" failing — not a bug today, a certainty later.**

**The survey:** 30 direct `prisma.globalPage.create/update` calls across **17 files**. Four mention `tenantId` **zero** times (the two above, plus `accept-invoice.ts` and `payment-plan-service.ts` — those two are id/token-scoped, which is defensible but undocumented and unenforced).

---

## THE ROOTS, IN ORDER

### R1 · TENANCY — the boundary, not a habit 🟥🟥 **first, and it blocks nothing else from starting**
**Invariant:** *A query against tenant data cannot be written without a tenant scope. The tenant is derived from the session — never accepted as an argument.*

**Enforcement — the one high-leverage move of this entire pass:** a **tenant-scoped data accessor** is the only sanctioned door to `GlobalPage` / `GlobalDatabase`. It resolves the tenant from the session itself and returns an interface whose methods cannot express an unscoped query. Direct `prisma.globalPage.*` becomes a **lint/CI failure** outside that module — the same shape as BLOB-3, which just proved the pattern works (`@vercel/blob` importers: 3 → 2, enforced by grep).

System writers (cron, webhooks, services) don't get an exemption — they get an **explicit, named** system accessor that still takes a tenant and is tagged as a system write (OCC-2's tagging becomes structural rather than remembered).

*Why first:* it is the invariant Florin named, every other root sits on top of it, and it is the only one whose absence gets **more** expensive with each day of delay — the cost is proportional to tenants, and tenants are the plan.

### R2 · ONE WRITE PATH — persistence & sync 🟥
**Invariant:** *There is exactly one way a record change reaches the database, and one authority on what "current" means.*

The OCC saga was five wrong theories against a system with two notions of current state. `server-first create + no client sync`, the unlocked sync queue, and the store's persist behaviour are the same root. **Depends on R1** (the write path is where the scope gets enforced).

### R3 · THE RECORD SURFACE — the grid 🟧 *(Florin's example)*
**Invariant:** *A cell edit commits its own field and nothing else. A view's state is where the user put it.*

Worth being precise about, because it changes the order: **the grid is not a root — it is the most-visible leaf of R2.** N1 (typing a name, clicking the date cell, losing the text) is a whole-row read-modify-write race, which is shape #3, which lives in the write path. Fixing the grid before R2 means fixing it twice. `store.ts` is **2,215 lines**; going in without the write path settled is how the last three grid fixes became the next three grid bugs. **Do R2 first, then the grid mostly falls out** — and what remains (view prop state, relation link icon, paste focus, column visibility) is genuinely grid-local and small.

### R4 · THE DOCUMENT ENGINE 🟧
**Invariant:** *The blocks are the document. Every surface renders the same tree through the same reader, and totals are derived once.*
Quote/invoice/purchase/portal currently disagree (PI-LINES-1 exists precisely because they disagree). Depends on R2.

### R5 · FILES & STORAGE ✅ **done this week — use it as the reference implementation**
Invariant: *one way to read a file; only `lib/storage` touches the provider.* Stated, enforced by grep, violations found and fixed, contract test added, and it turned out to be the cause of a live bug. **This is what a finished root looks like** — the whole pass is R5 repeated seven times.

### R6 · FAILURE IS VISIBLE 🟧 — directive written, sweep outstanding
### R7 · LOCALISATION 🟨 — directive written, ~16 missing keys outstanding (the test already fails on them)

---

## SEQUENCING

```
DELETE test-payment-plan          ← today, independent of everything
R1 tenancy boundary               ← the pass starts here
R2 one write path                 ← unblocks the grid
R3 grid            R4 engine      ← now mostly leaves
R6 · R7 sweeps                    ← can run in parallel, low risk
```

**One root at a time, finished to the definition of done.** Two half-finished roots is the state we are leaving.

## FOR FLORIN
- **Approve or re-cut the order.** The one claim to push back on if you disagree: *the grid is a leaf of the write path, not a root.* If you want the grid first anyway, say so and I will spec it standalone — but it will need revisiting after R2, and I would rather say that now than discover it in November.
- **Delete `/api/test-payment-plan`** — or tell me to spec it and the coder removes it in the first commit of the pass.
- BLOB-0 census still unrun (`blob-0-census.sql`); it is small and unrelated to this ordering.
