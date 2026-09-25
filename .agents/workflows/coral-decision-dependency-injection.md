# CORAL — DECISION RECORD — how a function gets its database client — Planner 2026-09-21

**Florin, 2026-09-21:** *"And the stricter option — because I'm afraid we will get back to it when we hit another dead end, and it might not be a path of investigation directly taken — what are the constraints and risks of taking this road?"*

**Written down precisely because the dead end would be hard to recognise later.** The symptom would be *"the scoped client doesn't actually scope anything"*, and the cause would be three months of code that imports `prisma` directly.

---

## 🔴 THE HEADLINE — THIS IS NOT A TESTING PREFERENCE. `R1-4` REQUIRES IT.

`R1-4` specifies *"an accessor whose methods cannot express an unscoped query"* and *"the tenant is never a parameter."*

**For that to be true, every function that touches data must RECEIVE its client. A function that imports `prisma` itself can never be scoped** — the unscoped client is always one import away, and no accessor can prevent it.

> **So the question is not "should we adopt DI." It is "when, and how do we avoid doing it halfway."**

---

## THE THREE OPTIONS, AND ONLY ONE IS STABLE

| | Shape | Reality |
|---|---|---|
| **A · module import** | `import prisma from '@/lib/prisma'` | Honest. Untestable without infrastructure. **Unscopeable.** |
| **B · default parameter** | `notify(params, db = prisma)` | 🔴 **The trap. Looks like DI, behaves like A.** The module still constructs the client at import; the signature still permits omission; **a CI rule cannot tell B from A.** *This is what `NOTIF-1` shipped.* |
| **C · required parameter** | `notify(params, db)` | **Enforceable.** The signature declares the dependency; the gate can forbid the import; the scoped client can be substituted. |

**B is the dangerous one because it satisfies a code review and nothing else.** It gave us a test that needs a Prisma engine to run a test that never queries.

---

## CONSTRAINTS AND RISKS OF TAKING ROAD C — honestly

### 🔴 R1 · A half-applied DI is worse than either extreme
If some functions take `db` and others import it, there are **two conventions for one thing** — defect shape #1 — and **the CI rule becomes unwritable**, because every violation has a plausible excuse. **The gate is what makes this real; a rule with exceptions is a convention.**
- **Mitigation:** apply it **per layer, completely**, not per file. L1 first, all of it, and the gate goes on the same day.

### 🟧 R2 · The plumbing tax, and how people escape it
The client threads through every call. A helper five levels deep needs it, signatures get noisy — and **the natural escape is to import `prisma` right there**, which quietly restores road A.
- **Mitigation:** the gate catches it. **Without the gate this risk is certain, not possible.**
- **Do NOT mitigate with a context god-object.** `{ db, session, tenant, logger, … }` starts convenient and becomes a second global with extra steps.

### 🟧 R3 · React Server Components are invoked by the framework, not by you
Server actions and route handlers are natural entry points — construct the scoped client from the session, pass it down. **RSCs are called by Next.js**, so there is no caller to thread from.
- **Mitigation:** RSCs are **entry points too.** They resolve the scope themselves, at the top, and pass it down. **One resolution per request boundary — never a mid-tree import.**
- ⚠️ **This is the part most likely to be fudged.** Worth naming in the spec so it is a decision rather than a drift.

### 🟨 R4 · Retrofit cost, measured
**95 `prisma.globalPage` sites · 34 `prisma.globalDatabase` · 121 files importing prisma.** That work is `R1-7` regardless — but C makes each site *a signature change*, not just a swap.
- **Mitigation:** `R1-7` is already "module by module, smallest first, `tsc` clean each time." **C does not add a phase; it adds width to an existing one.**

### 🟢 R5 · A benefit that is easy to miss — transactions stop leaking
```ts
await prisma.$transaction(async (tx) => {
    await doTheThing();       // road A: uses the GLOBAL client — OUTSIDE the transaction
});
```
**Under road A this compiles, looks right, and silently escapes the transaction.** Under C, `doTheThing(tx)` is the only way to call it, so **transaction membership is visible in the signature.**
**This is a correctness class, not a style point** — and it matters most on the money paths, which are exactly where `$transaction` is used.

### 🟨 R6 · It does not make things testable on its own
C removes the *infrastructure* requirement. It does not remove the need for a credible stub, and **a stub that drifts from Prisma's real behaviour produces tests that pass against a fiction.**
- **Mitigation:** stubs implement a **narrow interface we define** (`NotificationDbClient` is a good example), not a mock of Prisma. **The narrower the interface, the less there is to get wrong.**

---

## THE DECISION

- [ ] **Road C is adopted, and the layer boundary is the unit.**
- [ ] 🔴 **NEW L1 CODE TAKES `db` AS A REQUIRED PARAMETER, STARTING NOW.** Cheap, stops the surface growing while we wait, and means `R1-7` has less to convert. **`NOTIF-1` is the first candidate — it is one file and seven call sites.**
- [ ] **Existing code converts in `R1-7`**, module by module, as already planned.
- [ ] 🛑 **The gate lands with the conversion, not after:** `no-restricted-imports` on `@/lib/prisma` outside `lib/data/**`. **That is `R1-5`, already specified** — this decision just makes it load-bearing rather than tidy.
- [ ] **Road B is prohibited.** 🛑 **No `db = prisma` default parameters.** They read as compliance and provide none.
- [ ] **Entry points** — server actions, route handlers, RSCs, cron jobs — **resolve the scope once, at the boundary, and pass it down.** Nothing below a boundary resolves its own.

## HOW WE WOULD KNOW WE TOOK THE WRONG ROAD
**The dead end Florin is anticipating looks like this:** `R1-4` ships, the scoped accessor exists, the isolation tests are green — **and a leak happens anyway**, because some module three levels down imported `prisma` directly and no signature ever said so.

**The tell, maintained by the build, not by memory:** the length of the `GRANDFATHERED` array in `eslint.config.mjs` (`PRE-1d.2`) → **121.** **Until that number is falling, the road has not actually been taken.** 🔴 *The old manual figure of 70 was wrong: the grep matched single quotes only, and 51 further files import prisma with double quotes. Never re-derive this by grep — read the allowlist.*
