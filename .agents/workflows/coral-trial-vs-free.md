# CORAL — DESIGN — TRIAL AND FREE ARE DIFFERENT THINGS — Florin 2026-09-26

> **Florin:** *"the free tier is not concerned by the trial. but if a client wants to try the higher tier directly, we had a trial mode plan. bring it back. do not confuse concepts, they do not mix in the business logic, do not mix them in the code architecture."*

**The concepts are already mixed in the code, and `P10` mixed them in the plan.** `P10` (2026-05-30) framed the choice as *"retire the calendar trial **in favour of** FREE-forever + caps"* — as if they were competing conversion models. **They are not alternatives. They are different objects.**

---

# 1 · THREE THINGS, NAMED

| | What it is | Trigger | Duration | Ends by |
|---|---|---|---|---|
| **FREE tier** | a product. Permanent, capped. | signup | forever | nothing — it does not end |
| **TRIAL** | a temporary grant of a **higher tier's** entitlements | the tenant chooses it | time-boxed | reverting |
| **CAP TASTE** *(`P10b`)* | a reactive nudge when someone hits a cap | hitting a cap | short | reverting |

🛑 **FREE is not a trial outcome. A trial is not a tier. A taste is not a trial.**
- A FREE tenant may trial PRO. **A PRO tenant may trial ENTERPRISE.** One mechanism, any direction upward.
- **A trial does not create, end, or modify a FREE tenancy.** A FREE tenant who trials PRO and lets it lapse is a FREE tenant, exactly as before.

---

# 2 · 🔴 WHAT THE PARKED CODE ACTUALLY DOES

## It overwrites the tier
```ts
// src/lib/trial.ts:40 — startTrial(tenantId, 'PRO')
await syncPlanToTenant(tenantId, planType, { subscriptionStatus: 'TRIAL' });
```
**`planType` is MUTATED.** A tenant trialling PRO *becomes* PRO. **Their real tier is destroyed at the moment the trial starts**, so there is nothing left to return them to.

## So expiry cannot revert — and it does not try
`checkAndExpireTrials` (`trial.ts:121-160`), when there is no payment method:
```
trial ends  →  subscriptionStatus = 'PAST_DUE'  +  14-day grace
grace ends  →  subscriptionStatus = 'INACTIVE'   (blocked)
```
🔴 **A lapsed TRIAL is recorded as a payment FAILURE, then as a blocked account.** Nothing was ever owed and no payment ever failed. **FREE does not appear anywhere in this path.**

## And two state fields carry one fact
`planType` says PRO. `subscriptionStatus` says TRIAL. **They must agree, forever, by convention** — and `subscriptionStatus` is otherwise a *payment* field carrying `ACTIVE` / `PAST_DUE` / `INACTIVE`. *Trial state is riding on the billing field.*

🟢 **Credit where due:** `TRIAL_MONTHS` (`trial.ts:23`) *derives* from `PLAN_PRICING.trialMonths` rather than duplicating it. That one is right.

---

# 3 · THE SEPARATION — four fields, four jobs, no overlap

| Field | Answers | Changed by | 🛑 Must never |
|---|---|---|---|
| **`planType`** | what do they **pay for** | purchase · cancellation | **be touched by a trial** |
| **`entitlements`** | what may they **use** | grant · tier change · trial overlay | encode a plan name |
| **`trialGrant`** | what are they **trying, until when** | starting / expiring a trial | change `planType` |
| **`subscriptionStatus`** | **payment** state | Stripe webhooks · dunning | mean `TRIAL` |

## The trial is an OVERLAY
```ts
// Tenant.trialGrant : Json?
{ "tier": "ENTERPRISE", "entitlements": { … }, "expiresAt": "2026-12-26T00:00:00Z" }
```
- [ ] **Effective entitlements = `trialGrant.entitlements` if unexpired, else `entitlements`.** Resolved in one place — **the seraph** *(`scope.may()`)*.
- [ ] 🟢 **Expiry is the overlay lapsing. Nothing is downgraded, because nothing was upgraded.** The tenant returns to precisely what they had, whatever that was.
- [ ] 🛑 **No `PAST_DUE` on trial expiry.** No debt, no failure. `subscriptionStatus` is untouched by the whole lifecycle.
- [ ] 🛑 **No `INACTIVE`.** A lapsed trial leaves a working tenant on their own tier. **Blocking a FREE tenant because they tried PRO is the bug this design exists to prevent.**
- [ ] **A trial that converts:** the tenant buys → `planType` changes → `trialGrant` is cleared. **The only place `planType` moves is a purchase.**

## One trial per tenant per tier, and it is remembered
- [ ] **Record spent trials** (`trialHistory`) so the same tier cannot be trialled repeatedly. **Not by checking whether `trialGrant` is null** — that forgets.
- [ ] **Durations already exist:** `PLAN_PRICING.PRO.trialMonths = 3`, `ENTERPRISE = 2`. Keep deriving; do not restate them.

---

# 4 · WHAT TO UN-PARK, AND WHAT NOT TO

**Preserved intact per `P10`'s explicit instruction — nothing was deleted.**

| Asset | Action |
|---|---|
| `TRIAL_MODE_ENABLED` flag | 🟨 **keep the flag, change what it gates.** It currently gates Stripe's `trial_period_days` — that is a *payment* trial, a different thing again |
| `trial.ts` `startTrial` | 🔴 **rewrite.** It must write `trialGrant`, not `syncPlanToTenant` |
| `trial.ts` `checkAndExpireTrials` | 🔴 **rewrite.** Expiry clears `trialGrant`. No `PAST_DUE`, no grace, no `INACTIVE` |
| `isTrialActive` · `getTrialDaysRemaining` · `isTrialWarning` | ✅ **keep** — read from `trialGrant.expiresAt` instead of `subscriptionStatus === 'TRIAL'` |
| `cron/trial-check` · `cron/trial-notifications` | ✅ **keep**, repoint at `trialGrant` |
| `TrialNotificationEmail` | ✅ **keep.** 🔴 Rewrite the EXPIRED copy: *"your trial ended, you are back on <tier>"* — **not** *"grace period started"* |
| Schema `trialEndsAt` · `trialGraceEndsAt` · `trialNotifiedAt` | 🟨 `trialEndsAt` → `trialGrant.expiresAt`. **`trialGraceEndsAt` belongs to dunning, not to trials** — leave it to billing |
| `checkout/route.ts` `trial_period_days` | 🛑 **Leave parked.** A Stripe payment trial is a *billing* concept. **Do not conflate it with an entitlement trial** — that is the same mistake one layer out |

## 🔴 The distinction that decides the un-park
**There are TWO things called "trial":**
1. **An entitlement trial** — the tenant uses a higher tier for a while. **No card, no Stripe, no money.** ← *this is what Florin is bringing back*
2. **A Stripe payment trial** — a subscription exists with the first charge deferred. **Card taken, subscription created.**

**`P10` retired #2. It should never have touched #1.** They are unrelated, and the codebase currently has only #2's plumbing wired into #1's function names.

---

# 5 · VERIFY
1. A **FREE** tenant starts a PRO trial → `planType` **still `FREE`**, `subscriptionStatus` **unchanged**, PRO surfaces reachable.
2. The trial expires → **FREE surfaces only**, `planType` still `FREE`, `subscriptionStatus` still whatever it was. 🛑 **`PAST_DUE` or `INACTIVE` here is a fail.**
3. A **PRO** tenant starts an ENTERPRISE trial → `planType` still `PRO`; on expiry they are back on **PRO**, not FREE. 🔴 **This case is what proves the overlay works** — the old code cannot express it at all.
4. A trial that converts → `planType` changes **once**, `trialGrant` cleared, no double-grant.
5. The same tier cannot be trialled twice — even after `trialGrant` is cleared.
6. **A FREE tenant who never trials is untouched by every one of these paths.** *(Florin: the free tier is not concerned by the trial.)*
7. `scope.may()` is the **only** place the overlay is resolved. **No component compares dates.**

## PROHIBITIONS
- 🛑 **A trial may not write `planType`.** That is the whole defect.
- 🛑 **A trial may not write `subscriptionStatus`.** Payment state is not trial state.
- 🛑 **No component reads `trialGrant` and decides.** It asks the scope. *(`pd.md` 5a.)*
- 🛑 **Do not un-park Stripe's `trial_period_days`** in the same pass, or under the same flag.

---

## 🟢 WHY THIS IS THE SAME LESSON AGAIN
**Four fields, four jobs.** The defect was one field doing two jobs — `planType` meaning both *what they pay for* and *what they may use* — and a second field, `subscriptionStatus`, pressed into carrying trial state as well as payment state.

**Every gate we have built this week says the same thing:** one fact, one home, asked of one authority. *Reach* is not *quota*, *tier* is not *entitlement*, and **a trial is not a tier.**
