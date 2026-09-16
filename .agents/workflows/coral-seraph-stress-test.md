# CORAL — THE SERAPH — design, stress test, and three corrections to my own plan — Planner 2026-09-13

**Florin:** *"The seraph is that condition that will only allow ONE WAY data flow, and will also guard the horizontal structure and protect the tenant data, which rave as we might, is real life consequences."*

**This document tries to break the plan rather than restate it.** Where it succeeds, the plan changes.

---

## 0 · TWO GUARANTEES, NOT ONE — and they need different enforcement

Florin named both in one sentence. They are **different problems** and conflating them is how one gets quietly dropped.

| | **VERTICAL — one-way flow** | **HORIZONTAL — tenant isolation** |
|---|---|---|
| Claim | A layer never calls upward. L0 knows nothing of L1. | Tenant A's data never reaches tenant B. |
| Enforced by | **Import-boundary linting.** Static, cheap, total. | **Capability, not permission** — code below the gate never holds an unscoped handle. |
| Failure mode | Architectural rot. Slow, visible, survivable. | **A notifiable personal-data breach.** Fast, invisible, not survivable in the same way. |
| Detectable by tests? | Yes, trivially. | **Only by negative tests that try to leak.** A passing feature test proves nothing. |

**The vertical guarantee is the cheap one. The horizontal guarantee is the one with legal weight**, and it is the one my plan was weakest on.

> **Real-life consequences, stated soberly.** Under the GDPR a cross-tenant data exposure is a personal-data breach: in Belgium that means notifying the **APD/GBA within 72 hours** of becoming aware, and notifying affected individuals where the risk is high. Client names, addresses, VAT numbers, invoices, worker timesheets are all personal data. **I am not your lawyer and the specifics of your obligations are worth confirming with one** — but the engineering conclusion does not depend on the legal detail: *a leak is not a bug you patch on Monday.*
>
> **The argument for doing this NOW is that you have one tenant.** The blast radius today is you. Every month of delay raises the cost of the same work and the consequence of the same mistake. **This is the cheapest this will ever be.**

---

## 1 · THE STRESS TEST — ten ways past the gate

Each attack assumes the seraph is built as specced: a scoped client handed down, `prisma` unavailable below the gate.

### ✅ SURVIVES

**A1 · A module queries the wrong tenant directly.** Blocked — it has no client that can express the query.

**A2 · A leaf calls a kernel internal.** Blocked by import-boundary lint.

**A3 · Blob reads.** Already defended: `/api/files/[...key]` asserts `key.startsWith('t_' + tenantId)` and fails closed. **This is the model to copy** — a prefix assert at one door, not a check at each caller.

### ⚠️ SURVIVES ONLY IF EXPLICITLY HANDLED

**A4 · Raw SQL. 🔴 THE `$extends` BYPASS.**
Three sites today — `global-databases.ts:295`, `expense-dedup.ts:53,70`. **All three are currently scoped correctly** (the page-index query joins `GlobalDatabase` and filters `d."tenantId" = ${tenantId}` — genuinely good code).
**But a Prisma client extension does not intercept `$queryRaw`.** So the seraph's guarantee has a hole exactly the width of a template literal, and nothing today stops a fourth raw query being written unscoped.
→ **The scoped client must not expose `$queryRaw`/`$executeRaw` at all.** Raw SQL lives above the gate, in named, reviewed functions.

**A5 · `GlobalPage` has no `tenantId`. 🔴 THE STRUCTURAL HOLE — this is the big one.**
Scope is **transitive**: `GlobalPage → databaseId → GlobalDatabase.tenantId`. So `where: { databaseId: X }` is safe **only if `X` was itself resolved under scope.** A scoped client that filters per-model cannot secure `GlobalPage` — there is no column to filter on.
→ **The gate must be at ID RESOLUTION, not at query time.** A database id that did not come from the seraph is not a valid input. This is precisely what `R1-3` ("the server never trusts a supplied id") means, and it is **load-bearing, not hygiene.**
→ Alternative: denormalise `tenantId` onto `GlobalPage`. Cheap to filter, but **two representations of one fact** — defect shape #1, and it can drift. **Prefer resolution-time scoping; revisit only if measurement demands it.**

**A6 · Warm-lambda caching. 🔴 THE SILENT ONE.**
Serverless functions are reused. A module-level `const cache = new Map()` keyed by database id **serves tenant B from tenant A's fetch** — no query runs, so no scoping applies, and nothing in the query layer can see it.
Today: `lib/prisma.ts` uses a `globalThis` singleton (correct and normal — it caches *connections*, not rows). **No row-level module caches found.** But nothing prevents one, and it would be invisible to every test we have.
→ **Rule: no cross-request cache may be keyed by anything but a tenant-qualified key.** CI-checkable; `React.cache` (per-request) is fine.

**A7 · Background jobs — no session, therefore no scope. 🔴 HIGHEST BLAST RADIUS.**
This is `R5`, and it is where the seraph matters most: a user-facing leak exposes one tenant's data to one other party; **a job-layer leak exposes every tenant at once, on a schedule, with nobody watching.**

**A8 · The client store / IndexedDB.** Scope on the server does not scope the browser. A tenant switch that leaves the previous tenant's pages in IndexedDB is a leak on a shared device. There is a `mobile-last-tenant-id` guard today.
→ **The seraph has a client-side twin, and it must be specced explicitly, not assumed.**

**A9 · Logs and error messages.** A thrown error carrying a record's contents into Sentry or a Vercel log is an export of personal data into a third-party system.
→ **Errors name the *field* and the *id*, never the value.** Ties into the ERROR-SURFACING DIRECTIVE, which as written optimises for the opposite.

### 🚪 THE ONE LEGITIMATE DOOR

**A10 · Superadmin and impersonation.**
All **11** functions in `superadmin.ts` call `verifySuperadmin()` — **checked, all guarded, no gaps.** Credit where due: this is the most disciplined file in the codebase.
But `impersonateTenant()` deliberately changes the acting tenant. **That is a legitimate door through the seraph, and every gate needs exactly one, documented.**
→ **Requirements:** it is the **only** such door · every use is **audit-logged** (who, which tenant, when, how long) · it is **visibly indicated in the UI** for the whole session · it **expires**. An impersonation you can forget you are inside is how a support action becomes a write to a customer's books.

---

## 2 · THREE CORRECTIONS TO MY OWN PLAN

Florin asked for a stress test. The honest output is that **my own recommendation from earlier today fails it.**

### 🔻 C1 · I recommended `R5` option (b). **I withdraw it.**
I proposed building the `R5` kernel before `R1`, with the scoped client "initially wrapping today's resolver and tightening when `R1-2` lands."

**Under stress that is the worst of the three options.** Today's resolver is `TenantContext.tsx:26`'s `(base) => base` — **fail-open**. A job running on it would be *unscoped in fact while scoped in appearance*, and every job written against it inherits false confidence. **That is precisely "one job scars 100 tenants", shipped with a certificate saying it cannot happen.**
**A primitive that claims a guarantee it does not deliver is worse than no primitive**, because the next person stops checking.
→ **Revised: `R1-2` (fail-closed resolver) is a HARD PREREQUISITE of `R5`.** If reminders must come sooner, the answer is to pull `R1-2` forward — **not to weaken the kernel.**

### 🔻 C2 · My plan has **no proof of isolation** — only greps.
Every verification I have written is a grep or a manual check. **Greps prove a pattern is absent from code; they prove nothing about data.** This is the same error as the retracted `C1` blocker and the `t-*` records, one level up: **inferring a property of the system from the shape of the source.**
→ **New requirement: `tests/tenant-isolation.test.ts`, a NEGATIVE suite.** Seed two tenants with overlapping-looking data. For **every** read path — page index, search, grid, documents, exports, files, jobs — run as tenant A and **assert zero rows belonging to B**. Assert on the **query**, not only the result, so an empty database cannot produce a false pass.
**This suite is the gate's closure condition.** `R1` is not "done when call sites are migrated"; it is **done when this suite exists, is comprehensive, and is green.**

### 🔻 C3 · "100 jobs scanning their gated tenant" has a cost model I did not price.
288 sweeps/day × 100 tenants = **28,800 invocations/day**, on a plan you pay for.
Also worth being precise: **the guarantee comes from the scoped client, not from process separation.** One invocation looping tenants with a fresh scope per iteration gives the same *capability* isolation — what it does not give is *failure* isolation (one OOM kills the run).
→ **Two-phase sweep.** Phase 1: one cheap indexed query — *"which tenants have work due right now?"* — almost always returns **zero**. Phase 2: fan out scoped runs **only to those tenants**. Cost tracks actual work, not tenant count, and failure isolation lands where it matters.

---

## 3 · THE REVISED PLAN

```
PROMOTION                 ← in flight, unchanged
  ↓
R1 · THE SERAPH           ← the gate itself
  1a/1b  reconcile system-db lists · logicalKey + backfill      [Florin runs the migration]
  2      FAIL-CLOSED RESOLVER — delete (base) => base
  3      server never trusts a supplied id        ← A5 depends on this
  4/5    scoped accessor + CI gate — SHIP TOGETHER OR NOT AT ALL
  6/7    system writers · migrate call sites (70 files import prisma today)
  +      scoped client exposes NO $queryRaw                     [A4]
  +      no cross-request cache keyed without tenant            [A6]
  +      impersonation: audited, visible, expiring              [A10]
  +      tests/tenant-isolation.test.ts — THE CLOSURE CONDITION [C2]
  ↓
R5 · SCHEDULED WORK       ← now strictly after R1-2 [C1]
  two-phase sweep [C3] · no job body imports prisma
  ↓
REM · REMINDERS           ← first consumer, rides both
  ↓
R2 write path · R3 grid · R4 documents · leaves
```

**Not in this chain, and needs its own owner:** the **client-side seraph** (`A8`) — IndexedDB and store isolation across tenant switch. It is a separate gate on a separate machine and it will not be fixed by anything above.

---

## 4 · WHAT "CLOSED" MEANS — the seraph's five conditions

The gate closes when **all five** hold. Not four.

1. **No code below the gate can construct an unscoped client.** CI-enforced, like the `@vercel/blob` rule that made L0 the one floor that holds.
2. **The resolver fails closed.** No tenant, no id → an error. Never a bare fallback.
3. **The server never trusts a supplied id.** Scope is derived from the session, never accepted from the caller.
4. **No raw SQL, no cross-request cache, and no job body below the gate.** The four known bypasses (`A4`–`A7`) are each explicitly shut.
5. **`tests/tenant-isolation.test.ts` is comprehensive and green.**

**Then we do not return to it** — only to upgrade deliberately, or because something failed fatally at that depth.

---

## 5 · THE ONE THING I CANNOT STRESS-TEST FROM HERE

Everything above reasons about **code**. The question I cannot answer by reading the repository is whether **production data is already clean** — whether any `GlobalPage` today sits under a `GlobalDatabase` belonging to a different tenant than its content implies, or whether any orphaned rows exist with no tenant at all.

**That is a census, and it is Florin's to run** — read-only SQL in the Neon editor, before `R1-1b`'s migration, not after. **Building the gate on top of data that is already crossed would lock the leak in rather than close it.**

I will write that census when `R1` starts. **It goes first, before any schema change** — and this time I will state it as a question, not a prediction.
