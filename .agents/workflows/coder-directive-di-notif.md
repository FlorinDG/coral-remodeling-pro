# CORAL — CODER DIRECTIVE — `DI-1` · `notify()` takes `db` as a required parameter — Planner 2026-09-21

**Decision:** `coral-decision-dependency-injection.md` — **road C adopted.** `NOTIF-1` is the first module to follow it, chosen because it is **one file and seven call sites.**

**This is small work with a large reason.** Read the reason before the task.

---

## WHY — this is not about tests

`R1-4` specifies *"an accessor whose methods cannot express an unscoped query."*
**That is only true if every function RECEIVES its client.** A function that imports `prisma` itself can never be scoped — the unscoped client is always one import away, and no accessor prevents it.

**So `DI-1` is a prerequisite for the seraph, not a testing preference.**

### 🔴 AND THE CURRENT SHAPE IS THE TRAP, NOT THE FIX
```ts
// src/lib/notifications.ts:77-79 — as shipped in NOTIF-1
export async function notify(
    params: NotifyParams,
    db: NotificationDbClient = prisma as unknown as NotificationDbClient
)
```
**This reads as dependency injection and behaves as a module import:**
- `import prisma from "@/lib/prisma"` at **line 1** constructs a `PrismaClient` **at module load**, used or not.
- The signature **permits omission**, so callers keep not passing it.
- **A CI rule cannot distinguish this from an unmigrated module.**

**Proof it is not injected in practice:** `tests/notifications.test.ts` passes a `StubNotificationDb` and still requires a working Prisma engine to run — because importing the module is enough. *(It fails on any platform whose generated engine differs, and it leaks async handles: "a resource generated asynchronous activity after the test ended" — the classic intermittent-CI shape.)*

---

---

## 🔻 PLANNER CORRECTION — the first draft of this directive broke the layering
**Florin, 2026-09-21:** *"Read your file again, and make sure the logic of things that sit below the seraph is respected."*

**He is right. The draft below contradicted `R1-4`.**

`R1-4`: ***"The tenant is never a parameter — that is what makes 'pass the wrong tenant' unexpressible."***

The draft made `db` required and **left `tenantId` in the parameters**, with `notify()` resolving it from the assignee when omitted and writing it explicitly into the record. That is **L1 code performing tenancy resolution** — the one thing the layer above the gate must not do.

**What it would have cost:** the seven callers pass **raw `prisma`**, entrenching an unscoped client at every site. Then `R1-4` lands and all seven change **again**, plus the signature. **The wiring moves twice and never gains the property it was moved for.**

### 🔴 THE SEAM MUST BE DESIGNED FOR THE SWAP
```ts
// ❌ draft — tenantId is a parameter, db is a raw client
notify({ userId, tenantId?, topic, … }, db: NotificationDbClient)

// ✅ corrected — one scope argument; the tenant is INSIDE it, never passed
notify({ userId, topic, title, body, entity, href }, scope: NotificationScope)
```
- [ ] **`NotificationScope` is the seam.** Today it carries the client and the resolved tenant; after `R1-4` **it IS the scoped client.** 🔴 **The signature must not change when that happens** — that is the whole point of naming it now.
- [ ] 🛑 **`tenantId` leaves `NotifyParams` entirely.** Not optional, not defaulted — **absent.** A caller cannot pass a tenant because there is nowhere to put one.
- [ ] 🛑 **Delete the assignee→tenant lookup from `notifications.ts`.** That is tenancy resolution and it belongs **at the gate**. If a caller has a `userId` and no scope, **that is the caller's problem to solve at its own entry point**, not L1's to paper over.
- [ ] **The record write stops setting `tenantId` from a parameter.** It comes from the scope. *(Until `R1-4`, the scope object supplies it — **but the parameter list never does.**)*
- [ ] **Entry points construct the scope**: server actions and route handlers from the session; cron jobs from the tenant they are iterating (`R5`'s `runForEachTenant` will hand one over directly).

**This is the difference between a wiring change and an architectural one. Same effort, and only one of them survives `R1`.**

---

## `DI-1` · THE WORK

- [ ] **`scope` becomes a REQUIRED second argument.** 🛑 **Remove the default.** `notify(params, scope)` — **not `db`**, see the correction above.
- [ ] 🔴 **Delete `import prisma from "@/lib/prisma"` from `src/lib/notifications.ts`.** After this change the module **must not reference `prisma` at all.** *(The type import from `@prisma/client` is fine — it is types, not a runtime client.)*
- [ ] **Same for the legacy shim** `createNotification` — it takes `db` too, and passes it through. **No hidden fallback inside it.**
- [ ] **The seven callers pass their client explicitly:**
  `actions/notifications.ts` · `ClientInvoiceEngine.tsx` · `api/peppol/inbox/route.ts` · `api/cron/reminders/route.ts` · `api/cron/invoice-overdue/route.ts` · `actions/accept-quote.ts` · `actions/pages.ts`
  **Each already imports `prisma` for its own work** — so this is passing what it already holds, not adding an import.
- [ ] ⚠️ **`ClientInvoiceEngine.tsx` is a client component.** Check how it reaches `notify()` today — **if it calls a server action, the action passes the client and the component passes nothing.** 🛑 **If a client component would end up importing `prisma`, STOP AND REPORT** — that is a finding, not a plumbing problem.
- [ ] **Cron routes** resolve their client at the top of the handler and pass it down. **One resolution per entry point.**

## WHAT THIS BUYS IMMEDIATELY
- [ ] **`tests/notifications.test.ts` stops requiring a Prisma engine.** After the change it must pass with **no generated client at all** — that is the check that proves the import is gone.
- [ ] The suite goes back to being pure, fast and infrastructure-free — **which is what makes 170 green tests worth trusting.**

## VERIFY
1. `grep -n "lib/prisma" src/lib/notifications.ts` → **zero.**
2. `grep -n "db:.*=.*prisma\|db = prisma" src` → **zero.** *(No road-B defaults anywhere.)*
2b. 🔴 `grep -n "tenantId" src/lib/notifications.ts` → **only where it is read OFF THE SCOPE.** Never a parameter, never resolved, never looked up from a user.
3. `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/notifications.test.ts'` passes. 🔴 **Then move `node_modules/.prisma` aside and run it again — it must still pass.** That is the real proof; everything else is a code reading.
4. Full suite green · `npm run test:compile` clean.
5. Send an invoice on staging → the notification is still written. **The behaviour is unchanged; only the wiring moved.**

## PROHIBITIONS
- 🛑 **No default parameter for `db`.** Not `= prisma`, not `?? prisma`, not a lazy `await import()` fallback inside the function. **All three are road B wearing different clothes.**
- 🛑 **No `prisma` import in `lib/notifications.ts`** after this change.
- **No context object.** `{ db, session, tenant, logger }` is a second global with extra steps.
- **No behaviour change.** Same topics, same in-app-first guarantee, same outcome fields.
- **No files beyond** `src/lib/notifications.ts`, `tests/notifications.test.ts`, and the seven call sites.

---

## 📌 THE STANDING RULE THIS ESTABLISHES
**From now on, new L1 code takes its data client as a required parameter.** Existing code converts during `R1-7`, module by module, as already planned. **The gate — `no-restricted-imports` on `@/lib/prisma` outside `lib/data/**` — lands with `R1-5`.**

**The single number that says whether the road is being taken:**
```bash
# DI metric — read the GRANDFATHERED array in eslint.config.mjs, do NOT grep (quote-naive)
awk '/GRANDFATHERED/,/^    \],/' eslint.config.mjs | grep -c '"src/'   # 121 today
```
🔴 **Report it at the end of every run from here on.** Until it falls, the decision is theoretical.
