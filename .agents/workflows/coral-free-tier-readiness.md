# CORAL — FREE TIER READINESS — what exists, what overlaps, what must mend — Planner 2026-09-18

**Florin:** *"Revive the free tier roadmap. How does this overlap, and what gaps need mending to get there?"*

Read against `feature_matrix.md` (product-owner approved, last confirmed 2026-04-21) and the architecture map.

---

## 0 · FIRST, A CORRECTION TO MY OWN `A5` FINDING

I wrote that *"a new tenant cannot obtain a Tasks database at all"* and called it an onboarding blocker. **Against the matrix, that is correct behaviour for FREE.**

```ts
PLAN_MODULES.FREE = ['INVOICING']            // stripe.ts:18
feature_matrix: Task manager → 🔒 on FREE
```
Tenant `cmoa44mj` has exactly **clients · invoices · expenses · quotations · suppliers · tickets** — **precisely the INVOICING module's database set.** Provisioning is not broken for FREE; **it is right.**

**🔴 The gap is on UPGRADE, not on signup.** `PLAN_MODULES.PRO` adds `CRM · PROJECTS · CALENDAR · DATABASES · TASKS`, but `SERVER_PROVISIONED_BASES` holds **8 bases** and includes **none of** `db-tasks`, `db-1`, `db-crm`, `db-bobex`, `db-articles`, `db-bestek`. And the client-side auto-creator has no name-map entry for `db-tasks`, so the browser fallback cannot make one either.

> **A FREE tenant who pays for PRO gets the modules unlocked and the databases missing.** *That* is the blocker — and it is worse than the one I described, because it happens at the moment money changes hands.

---

## 1 · THE OVERLAP — free tier is mostly BUILT, and it sits on layers that are mostly DONE

| Free-tier need | Map layer | State |
|---|---|---|
| Invoices · quotations · purchase invoices · expense tickets | L2/L3 | ✅ built, in daily use |
| Contacts · suppliers | L3 | ✅ |
| Peppol send/receive + quotas | L2 / L1 | ✅ `PLAN_LIMITS` enforces 5/10 |
| PDF generation | L1 document engine | ✅ |
| **"Powered by CoralOS" watermark** | L1 | ✅ **gated correctly** — `showWatermark = !canAccess('WHITELABEL', plan)`, ENTERPRISE+ only |
| Email dispatch (Resend) | L1 | ✅ + `DOC-ARCH-1` archive-before-send |
| Tier flags | L1 | ✅ `FEATURE_FLAGS` with `minTier`, 17 flags |
| Roles | L1 | ✅ `TENANT_FREE` in `roles.ts`, enforced in 3 write doors |
| Signup + verification + trial start | L2 | ✅ `api/auth/signup` → `startTrial` → `PLAN_MODULES` |
| Billing | L2 | ✅ Stripe checkout · portal · webhook · `PLAN_PRICING` (PRO €29 + €19/extra user) |

**This is the good news and it is substantial: the free tier is not a build, it is a finishing job.** Almost everything it needs lives at L1–L3 in blocks already marked ✓ on the map.

---

## 2 · THE GAPS — six, and only two are large

### 🟥 G1 · The upgrade path does not provision the modules it sells — `GATE` / L1
As §0. **A tenant paying for PRO receives no `db-tasks`, `db-1`, `db-crm`, `db-articles`, `db-bestek`.**
- [ ] `provisionTenantDbs` covers **every base in the reconciled list**, driven by `PLAN_MODULES`.
- [ ] Provisioning is **callable on upgrade**, idempotent, server-side. *(Same requirement as `coral-module-entitlement-model.md` `E2` — the trial model needs exactly this.)*
- [ ] **Remove client-side database creation** — a browser must not be able to bring a database into existence (`R1` A5).
- **Belongs to `R1`.** It is the reconciled-list work, applied.

### 🟥 G2 · The 5/month invoice and quotation caps are NOT enforced — L1
The matrix says **5 invoices/mo and 5 quotations/mo on FREE**. `PLAN_LIMITS` (`plan-limits.ts:18`) contains **only** `peppolSent` and `peppolReceived`.
- [ ] **There is no counter, no check, no reset.** A FREE tenant can issue unlimited invoices today.
- [ ] Add monthly caps with the **same shape** as the Peppol quotas — counter, 1st-of-month UTC reset, named refusal. **Do not invent a second mechanism.**
- [ ] 🛑 **Decide what "5/month" blocks:** creating a draft, or *sending*? Peppol's precedent — *"received invoices are NEVER blocked; bookkeeping is never interrupted"* — suggests **never block recording work, only outbound actions.** **Florin's call.**
- **This is the one gap that costs money directly.** Everything else is friction; this is the meter not running.

### 🟧 G3 · Entitlement is not checked at the data layer — `MODULE GATE`
`DB_ID_MODULE_MAP` (8 entries) vs `MODULE_ROUTE_MAP` (11) vs `PLAN_MODULES` (per tier). **Three lists, three answers.** Seven databases return `null` from `requiredModuleForDb` — read as *"no module gate"*, which is a fail-open default.
- [ ] One entitlement map, derived from the reconciled database list. Checked **at the data door**, not only the route. `R1-1a`.

### 🟧 G4 · Locked features are shown, not hidden — L4 / product
`LockedFeature` renders *"Module Upgrade Required"* on **7 surfaces**. Florin, 2026-09-16: **not in options, not in UI, at all** for tiers that do not include it.
- [ ] Entitlement resolvable at **navigation-build time**, so an unavailable module is absent rather than blocked at render (`R1` owes this).
- [ ] Replacement UX — discreet opt-in trial — is `coral-module-entitlement-model.md`. **Parked until there is a tenant base.**

### 🟨 G5 · The single-user limit is stated but unproven — L1
FREE = **1 user (TENANT_FREE)**. `WORKSPACE_USER_MANAGEMENT` is `minTier: PRO`, and `api/tenant/employees` lists `TENANT_FREE` among allowed roles.
- [ ] **Verify** a FREE tenant cannot invite a second user — via the UI *and* by calling the endpoint directly. **Untested, not necessarily broken.**

### 🟨 G6 · Nobody has walked the flow end to end — ⟂
Tenant 2 exists, but as a manual test.
- [ ] **One full pass:** sign up → verify email → land in the workspace → create an invoice → send it → receive it → hit a locked feature → upgrade → confirm the new modules actually work.
- [ ] **G1 and G3 will both surface here**, which is the cheapest place to find them.

---

## 3 · WHAT THIS MEANS FOR THE ORDER

**Nothing here displaces the sequence.** Promotion → `R1` → `R5` → `R2`. But it sharpens *why* `R1` is next:

**`G1` and `G3` are both `R1` work.** They are not free-tier features; they are the reconciled list applied to provisioning and entitlement. **Closing the seraph closes most of the free tier's real blockers as a side effect** — which is the argument the map was built to make.

**`G2` is the only free-tier item that is genuinely its own work**, it is small, and it is the one that decides whether the tier earns anything.

**Sequence:** promotion → `R1` *(closes G1, G3, and unblocks G4)* → `G2` caps → `G6` end-to-end walk → open the door.

## 4 · ✅ CHECKED 2026-09-18 — and all three answers change the picture

### 🔴 F1 · NOBODY EVER LANDS ON FREE. EVERY SIGNUP IS A 3-MONTH PRO TRIAL.
```ts
// api/auth/signup/route.ts
:66   planType: 'FREE',
:68   activeModules: PLAN_MODULES['FREE'],      // ['INVOICING']
:92   await startTrial(newTenant.id, 'PRO');    // ← immediately overwrites both
```
`startTrial` → `syncPlanToTenant(id, 'PRO', {status:'TRIAL'})` → `planType: 'PRO'`, `activeModules: [INVOICING, CRM, PROJECTS, CALENDAR, DATABASES, TASKS]`, **3 months** (`PLAN_PRICING.PRO.trialMonths`).

**The FREE assignment at `:66` is dead code — overwritten six lines later.** FREE is not an entry point; it is only reachable by a trial lapsing. **So "shipping the free tier" is really "shipping what happens after a PRO trial ends"** — a different product question, and the matrix does not describe it that way.

### 🔴 F2 · `G1` IS NOT AN UPGRADE BUG. IT FIRES ON EVERY SIGNUP.
`syncPlanToTenant` writes `planType`, `activeModules`, `scanQuota` on the **Tenant row** — **and provisions nothing.**

So every new tenant has **TASKS, CRM, PROJECTS, DATABASES active** and **no `db-tasks`, `db-crm`, `db-1`, `db-articles`, `db-bestek` to put anything in.** **Tenant `cmoa44mj` is the proof**: 6 INVOICING databases, PRO-trial modules enabled.

**This is worse than §0 stated.** It does not wait for money to change hands — **it is the state of every account from the first minute.** A new tenant opens Tasks and sits on *"Initializing workspace…"* forever, during the trial that is meant to sell them the product.

### 🔴 F3 · THE TRIAL NEVER ACTUALLY ENDS
`trial.ts` header: *"Auto-downgrade to FREE on expiry."* **The code does not do that.** On grace expiry (`:160`):
```ts
data: { subscriptionStatus: 'INACTIVE' }      // planType stays 'PRO'
```
So a lapsed tenant is **PRO + INACTIVE**, never FREE. And:

> **`grep -rn "INACTIVE|PAST_DUE" src` returns ONLY superadmin display components.** No middleware check, no `moduleGuard` check, no auth check. **Nothing enforces either status.**

**A tenant whose trial expires keeps full PRO access indefinitely.** The cron runs, the emails send, the status flips, and **no door closes.**

Three separate things disagree: the **matrix** (FREE tier), the **file header** (downgrade to FREE), and the **code** (set INACTIVE) — and the code's own intent is unenforced. *Defect shape #1 at the commercial layer: three representations of "what happens when you stop paying", and none of them is what happens.*

### ✅ F4 · The 5/month caps are confirmed absent
`PLAN_LIMITS` holds `peppolSent`/`peppolReceived` only. No invoice or quotation counter exists. `G2` stands as written.

---

## 5 · WHAT THIS DOES TO THE PLAN

**`G1` is promoted from "upgrade gap" to the single most urgent item outside `R1`** — it degrades every trial from minute one, which is precisely the window meant to convert.

**And `F3` reframes `coral-module-entitlement-model.md`.** That file asks *"what happens to the data when a trial lapses?"* and I recommended read-only + exportable. **The answer today is: nothing happens, they keep everything.** So that decision is not a future refinement — **it is a hole in the revenue path that is open right now.** Still Florin's call, still not urgent while there is one real tenant, but it should be recorded as *unbuilt*, not as *deferred*.

**Order is unchanged.** `G1` rides `R1`'s provisioning work; `F3` is a product decision; `G2` is small and independent.

## 6 · WHAT I HAVE NOT CHECKED
- Whether `startTrial` puts a new tenant on FREE or on a PRO trial — **that changes what a signup actually receives on day one**, and it is worth reading before anything is built on it.
- Whether the Stripe webhook's plan change triggers re-provisioning (it almost certainly does not — `G1`).
- Whether the 5/month caps were ever *intended* to be live, or are aspirational in the matrix. **The matrix says "last confirmed 2026-04-21" — five months ago. Worth re-confirming as product truth before implementing against it.**
