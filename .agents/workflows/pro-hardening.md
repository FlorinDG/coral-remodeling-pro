---
description: PRO TIER HARDENING — execution workplan for Antigravity AI. Read AFTER pd.md, every session.
---

# PRO Tier Hardening — AI Execution Workplan

> **This file is the contract between three parties:**
> - 👤 **Florin** — product owner. Makes decisions. Approves merges.
> - 🧭 **Planner (Claude)** — writes/maintains the tasks below. Does NOT execute code.
> - 🤖 **Antigravity AI** — executes tasks, writes back results into the `🤖 AI FEEDBACK` block of each task.
>
> **You (Antigravity AI) must read `.agents/workflows/pd.md` FIRST.** This workplan inherits every rule in the Prime Directive — especially: measure before you deduce, smallest possible change, `develop` branch only, `tsc --noEmit` + `lint` green before any commit, never push to `main`.

---

## ⚠️ PROTOCOL — read before touching anything

1. **Turn-taking / no concurrent writes.** Only one agent writes this file at a time. If you (AI) are editing it, finish and save before any other tool touches it. This avoids the mount-lock corruption we already hit once.
2. **Premise tags are law.** Every factual claim in a task is tagged:
   - `[MEASURED ✅]` — verified in current runtime/code. Safe to deduce from.
   - `[ASSUMED ❓]` — Planner's inference. **You MUST run Rule 2 (measure) and confirm before changing code.** If the assumption is false, STOP, write what you found in `🤖 AI FEEDBACK`, set status `🔴 BLOCKED — premise false`, and do not proceed.
3. **Status vocabulary** (update the task's `Status:` line as you work):
   - `⬜ TODO` · `🟡 IN PROGRESS` · `🟢 DONE (awaiting Florin verify)` · `✅ VERIFIED` (Florin only) · `🔴 BLOCKED` · `👤 NEEDS FLORIN DECISION`
4. **Do not mark `✅ VERIFIED`.** Only Florin does. You may go as far as `🟢 DONE (awaiting Florin verify)`.
5. **Scope discipline.** Do ONLY what the task says. If you discover adjacent work, note it under `🤖 AI FEEDBACK → discovered`, do NOT do it.
6. **After each validated change**, append a row to the premises table in `pd.md` (its existing ritual), and fill `🤖 AI FEEDBACK`.
7. **One task = one branch = one PR into `develop`.** Branch name suggested per task.

---

## CONTEXT — what we are doing and why

The FREE tier is launched and working. We are now hardening the **PRO tier** for a staged test release. Investigation (Planner, 2026-05-30, code-read) found PRO is mostly *built* — Stripe lib, checkout/portal/cancel/webhook routes, feature-flags, moduleGuard, plan-limits, and the billing UI all exist. **The work is therefore mostly closing gating gaps + wiring the seat-billing revenue path, NOT building features.** This matches the gaps already recorded in `feature_matrix.md` (Implementation Gaps table) and the "known gap: planType checks inconsistent" note in `pd.md`.

### 👤 LOCKED product decisions (Florin, 2026-05-30)
- **PRO = unlimited seats, billed per seat.** No hard user cap. Natural friction at 3+ users (org complexity, access gating, tier limits) drives Enterprise upgrade. → `PLAN_USER_LIMITS[PRO] = Infinity`, Stripe quantity-billed.
- **Seat economics:** PRO extra user €19/mo · PRO workforce seat €4.99/mo. ENTERPRISE extra user €79/mo · workforce €1.99/mo. (Matches `stripe.ts PLAN_PRICING`.)
- **ENTERPRISE = €99/mo.** Pricing contradictions from older docs are resolved in favour of code/`pd.md`.

### ❗ Known doc conflict for the AI to RECONCILE (not silently overwrite)
`feature_matrix.md` still says "PRO = 3 max (1 owner + 2 employees)" and the billing UI lists "Up to 3 users." Both are **stale**. The LOCKED truth is unlimited-per-seat (`pd.md` Tier Feature Tree, newer + marked LOCKED). Tasks below fix these in code; when you do, also correct `feature_matrix.md`'s line and note it in feedback.

---

# ───────────────────────────────────────────────
# PHASE 1 — LAUNCH BLOCKERS (do first, in order)
# ───────────────────────────────────────────────

These three gate the PRO launch. Until all are ✅ VERIFIED, do not start Phase 2.

---

## TASK P1 — Audit & fix the FREE-tenant `activeModules` default (revenue leak)
**Status:** 🟢 DONE (awaiting Florin verify)
**Branch:** `bugfix/free-tenant-module-default`
**Priority:** BLOCKER #1 (integrity + revenue leak)

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** Module gating via middleware + moduleGuard reads `tenant.activeModules`. Existing tenants are unaffected by schema defaults.
- **What this risks breaking:** If we change provisioning, we could (a) accidentally lock modules for existing paying tenants, or (b) break the signup flow. Touch ONLY the new-tenant creation path and the schema default — never bulk-update existing rows without Florin's explicit go.

### Premises to measure (Rule 2 — DO THIS FIRST)
- `[MEASURED ✅]` `prisma/schema.prisma` Tenant model declares `activeModules String[] @default(["CRM","PROJECTS","INVOICING","CALENDAR","DATABASES"])` — a PRO-shaped default while `planType` defaults to `FREE`.
- `[MEASURED ✅]` The signup/tenant-provisioning code does NOT override `activeModules` to the FREE set (`['INVOICING']`). **MEASURE:** read the signup path (`src/app/api/auth/signup/route.ts` and any `provisionTenantDbs` / tenant-create helper). Determine what `activeModules` a brand-new FREE tenant actually ends up with at runtime. Create a throwaway test tenant or inspect the create call.
- `[MEASURED ✅]` `PLAN_MODULES.FREE = ['INVOICING']` in `stripe.ts` is the intended FREE module set. (Confirm against `pd.md` Module Access table — it is.)

### Instructions (only after measuring)
1. If a new FREE tenant gets more than `PLAN_MODULES.FREE`, fix the **provisioning code** to set `activeModules = PLAN_MODULES[planType]` at creation (single source of truth from `stripe.ts`), rather than relying on the schema default.
2. Change the schema `@default` to the FREE set (`["INVOICING"]`) so the safe default is the least-privileged one. (Smallest change; new migration.)
3. Do NOT retroactively alter existing tenants. If you believe existing FREE tenants are over-provisioned, report counts in feedback and set `👤 NEEDS FLORIN DECISION` for the backfill.

### Acceptance criteria
- A newly created FREE tenant has `activeModules = ['INVOICING']` (verified by inspecting the created row).
- Existing tenants unchanged.
- `tsc --noEmit` + `lint` green.

### Out of scope
- Backfilling/altering existing tenants (separate, Florin-approved task).
- Any UI change.

### 🤖 AI FEEDBACK
- measured:
  - `prisma/schema.prisma` defaults to `["CRM", "PROJECTS", "INVOICING", "CALENDAR", "DATABASES"]`.
  - Brand-new signup path (`src/app/api/auth/signup/route.ts` and `src/auth.ts`) hardcoded default activeModules to `['INVOICING']` for FREE signups, but then `startTrial` promoted it to PRO modules set.
  - Verified database counts: 2 total FREE tenants, 1 is over-provisioned with `["INVOICING","CRM","DATABASES"]` (ID: `cmp2iavx50000l104clo7gv3n`, Name: "FreeTier Tester's Workspace").
- changed:
  - Changed `prisma/schema.prisma` `activeModules` default to `["INVOICING"]` to ensure a safe default.
  - Updated both `src/app/api/auth/signup/route.ts` and `src/auth.ts` to dynamically use `PLAN_MODULES['FREE']` from `@/lib/stripe` (single source of truth).
- discovered:
  - There is exactly 1 over-provisioned FREE tenant in the database, representing a minor revenue leak. Set `👤 NEEDS FLORIN DECISION` for whether to backfill/correct it.
- premise updates appended to pd.md? (y/n): y

---

## TASK P2 — Wire per-seat billing into Stripe checkout & lifecycle (revenue path)
**Status:** ⬜ TODO
**Branch:** `feature/seat-billing`
**Priority:** BLOCKER #2 (the core PRO revenue mechanism — currently NOT wired)

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `checkout/route.ts` creates a subscription with exactly ONE line item (base plan). `webhook` handles base subscription lifecycle. Schema tracks `extraUserCount` / `workforceUserCount`. Price IDs for `EXTRA_USER_PRO/ENT` and `WORKFORCE_PRO/ENT` exist in `stripe.ts`.
- **What this risks breaking:** Checkout is the money path. A bug here either blocks all upgrades or mis-charges. Keep base-plan checkout behaviour intact; ADD seat line items, don't restructure.

### Premises to measure (Rule 2 — DO THIS FIRST)
- `[MEASURED ✅]` `checkout/route.ts` builds `lineItems` with only the base price. No seat quantities are sent.
- `[MEASURED ✅]` `stripe.ts` has `EXTRA_USER_PRO`, `EXTRA_USER_ENT`, `WORKFORCE_PRO`, `WORKFORCE_ENT` price IDs (test+prod).
- `[ASSUMED ❓]` There is currently NO code path that updates Stripe subscription item quantities when a user/workforce member is added or removed. **MEASURE:** grep for any `subscriptionItems`, `stripe.subscriptions.update`, quantity sync. Confirm it's absent. Check the team/user-invite flow (`src/app/api/tenant/users/*`, `tenant/employees/*`) for any billing hook.
- `[ASSUMED ❓]` `extraUserCount` / `workforceUserCount` are maintained somewhere when seats change. **MEASURE:** find who writes these fields. If nobody does, that's part of this task.

### Instructions (only after measuring) — smallest viable, staged
1. **Decide seat model representation** with Stripe: base subscription + separate subscription items for `EXTRA_USER` and `WORKFORCE`, quantity = count. (Recommended; confirm in feedback if Stripe account constraints differ.)
2. **Checkout:** when creating the subscription, include seat line items if the tenant already has seats counted (usually 0 at first upgrade — so often just base). Keep base path working.
3. **Seat-change sync (the real gap):** create a single server helper `syncSeatQuantities(tenantId)` that:
   - counts actual billable users and workforce members for the tenant,
   - updates the Stripe subscription items' quantities to match,
   - writes `extraUserCount` / `workforceUserCount` back to the tenant.
   Call it from the add/remove user and add/remove workforce flows. Mid-month add → Stripe prorates/invoices current month; removal → effective next cycle (matches `pd.md` seat rule). Verify proration behaviour against Stripe test mode.
4. **Webhook:** on `customer.subscription.updated`, reconcile seat counts from the subscription items back to the tenant (so Stripe stays source of truth).
5. **PRO has NO seat cap.** Ensure `PLAN_USER_LIMITS[PRO] = Infinity` (or equivalent) — code never blocks adding a PRO user; Stripe just bills it.

### Acceptance criteria (verify in Stripe TEST mode)
- Upgrading to PRO then adding a 2nd user creates/increments an `EXTRA_USER_PRO` subscription item with correct quantity and price (€19).
- Adding a workforce member increments `WORKFORCE_PRO` (€4.99).
- Removing a seat decrements quantity; takes effect per the cycle rule.
- Tenant `extraUserCount`/`workforceUserCount` match Stripe quantities after each change.
- No seat cap blocks PRO. `tsc`+`lint` green.

### Out of scope
- UI for showing seat costs (that's P-UI in Phase 2). Do the data/billing layer here; a minimal trigger from existing invite flow is enough.
- Enterprise-specific seat UI polish.

### 🤖 AI FEEDBACK
- measured:
- changed:
- Stripe test-mode results:
- discovered:
- premise updates appended to pd.md? (y/n):

---

## TASK P3 — Close the stale-token gating hole on plan/seat change
**Status:** ⬜ TODO
**Branch:** `bugfix/stale-token-gating`
**Priority:** BLOCKER #3 (security/correctness on upgrade & downgrade)

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `middleware.ts` gates routes from `activeModules` carried in the **JWT**. `moduleGuard.ts` reads the DB directly for server actions (already correct, do not change its approach).
- **What this risks breaking:** Auth/session is critical-path (`pd.md` Rule 5 — a locked-out admin is a business emergency). Any session change must fail safe: if in doubt, grant the *currently-paid* access, never hard-lock a paying tenant mid-session.

### Premises to measure (Rule 2 — DO THIS FIRST)
- `[MEASURED ✅]` Middleware reads `token?.activeModules` from the decoded JWT.
- `[MEASURED ✅]` The webhook updates `tenant.activeModules` in the DB on plan change, but does not touch any user's JWT.
- `[ASSUMED ❓]` The JWT is NOT refreshed on plan change, so a user keeps stale module access until next login/token refresh. **MEASURE:** check the NextAuth jwt/session callbacks (`src/auth.ts` or equivalent) — does the JWT re-read `activeModules` from DB on each request, on an interval, or only at login? Determine the actual refresh behaviour before choosing a fix.

### Instructions (only after measuring) — pick the smallest fix that works
- **Option A (preferred if cheap):** make the NextAuth `jwt` callback re-read `activeModules`/`planType` from the DB on a short interval or on a "dirty" flag set by the webhook. Smallest change, no UX disruption.
- **Option B:** set a `sessionInvalidatedAt` / `permissionsUpdatedAt` timestamp on the tenant in the webhook; middleware or jwt callback compares and forces a refresh when stale.
- **Downgrade must fail safe:** never 500/hard-lock. On downgrade, locked modules should redirect to the upgrade prompt (existing `?blocked=` flow), not error.
- **Upgrade must reflect quickly:** newly purchased modules appear without requiring manual logout.

### Acceptance criteria
- After a webhook upgrade FREE→PRO, the user gains PRO module routes within one refresh cycle WITHOUT manual logout (verify by simulating the webhook in test mode and hitting a gated route).
- After downgrade PRO→FREE, PRO routes redirect to upgrade prompt, no error, data intact.
- `moduleGuard` server checks still authoritative. `tsc`+`lint` green.

### Out of scope
- Redesigning auth. Reuse `decode()`/JWT approach per `pd.md` Rule 4 (vertical integration). Smallest viable refresh mechanism only.

### 🤖 AI FEEDBACK
- measured:
- chosen option + why:
- changed:
- discovered:
- premise updates appended to pd.md? (y/n):

---

# ───────────────────────────────────────────────
# PHASE 2 — GATING-GAP HARDENING
# (start only after P1–P3 are ✅ VERIFIED by Florin)
# ───────────────────────────────────────────────

These close the feature-depth gaps already catalogued in `feature_matrix.md` → Implementation Gaps and `pd.md` "planType checks inconsistent." Each is a small, isolated gate. Recommended: one branch per task, but they may be batched into `feature/pro-gating-gaps` if Florin approves. **Every one starts by MEASURING current behaviour — several may already be fixed since the docs were written.**

> Build the shared `<LockedFeature label requiredPlan upgradeHref>` component FIRST (per `feature_matrix.md` code pattern) so every gate below uses one consistent locked-state UI. → **TASK P4.**

## TASK P4 — Build the shared `<LockedFeature>` component
**Status:** ⬜ TODO · **Branch:** `feature/locked-feature-component`
- **Scope:** new reusable component; touches no existing gate yet.
- **Premise `[MEASURED ✅]`:** `feature_matrix.md` specifies props `label`, `requiredPlan: 'PRO'|'ENTERPRISE'`, `upgradeHref?`; renders lock icon + plan badge + upgrade button.
- **Premise `[ASSUMED ❓]`:** no such component exists yet. MEASURE: grep `LockedFeature`.
- **Instructions:** build it once, themed, i18n-ready (NL/FR/EN/RO), links to `/admin/settings/billing`. No behaviour change anywhere else.
- **Acceptance:** component renders in isolation; not yet wired (that's P5–P9). `tsc`+`lint` green.
- 🤖 AI FEEDBACK: …

## TASK P5 — Gate LIBRARY (Articles + Bestek) behind PRO
**Status:** ⬜ TODO · **Branch:** `bugfix/gate-library-pro`
- **Premise `[ASSUMED ❓]`:** `feature_matrix.md` gaps say "Bestek unlocked on FREE" and "Library shown on FREE" (`❌ not gated`). **MEASURE** current behaviour on `library/articles/page`, `library/bestek/page` for a FREE tenant — may already be fixed (the gaps table predates recent work).
- **Instructions:** if ungated, wrap with `isPro` check + `<LockedFeature requiredPlan="PRO">`. Bestek: PRO = read/apply catalog, ENTERPRISE = edit/personalize (per matrix). Smallest change.
- **Out of scope:** Batiprix (future).
- 🤖 AI FEEDBACK: …

## TASK P6 — Gate SALES pipeline (PRO = 1 pipeline) / EMAIL CLIENT (ENTERPRISE only)
**Status:** ⬜ TODO · **Branch:** `bugfix/gate-sales-email`
- **Premise `[ASSUMED ❓]`:** matrix gaps: "Sales shown on FREE (if CRM on)" and "EMAIL sidebar shown for PRO (should be ENTERPRISE only)". **MEASURE** both — check `email/page` gate (`pd.md` component table says it's already `isEnterprise`; confirm) and sales pipeline gating.
- **Instructions:** Email client = ENTERPRISE only (verify, fix if not). Sales = PRO gets 1 pipeline, ENTERPRISE unlimited; enforce the 1-pipeline cap if missing.
- 🤖 AI FEEDBACK: …

## TASK P7 — Gate FILE MANAGER behind PROJECTS-on + PRO
**Status:** ⬜ TODO · **Branch:** `bugfix/gate-file-manager`
- **Premise `[ASSUMED ❓]`:** matrix gap "File manager shown on PRO (needs PROJECTS ON)". **MEASURE** `files/page` gate. PDFs auto-generated by INVOICING must STAY accessible on all tiers — do not gate those.
- **Instructions:** file manager requires PROJECTS module + `isPro`; auto-generated invoice/quote PDFs remain ungated.
- 🤖 AI FEEDBACK: …

## TASK P8 — Reconcile seat-count UI + remove stale "3 users" copy
**Status:** ⬜ TODO · **Branch:** `bugfix/seat-ui-reconcile`
- **Premise `[MEASURED ✅]`:** billing UI (`BillingPageClient.tsx`) lists "Up to 3 users" for PRO and Users meter caps at 3 — contradicts LOCKED unlimited-per-seat decision.
- **Instructions:** update PRO card to "Unlimited users · €19/mo each" (and workforce €4.99). Fix the Users usage meter so PRO shows count without a 3-cap. Correct the stale line in `feature_matrix.md`. Surface seat costs from P2. **Depends on P10** — ensure no "trial" copy remains; CTA reads "Upgrade", with immediate-billing note.
- 🤖 AI FEEDBACK: …

## TASK P9 — Verify `planType` depth gates across all PRO module pages
**Status:** ⬜ TODO · **Branch:** `chore/audit-plantype-gates`
- **Premise `[ASSUMED ❓]`:** `pd.md` says planType checks are inconsistent across module pages. **MEASURE** each PRO module entry point and the component-level gates in `pd.md`'s table; produce a checklist of which are correctly gated vs not.
- **Instructions:** this is primarily an AUDIT task — output a table in `🤖 AI FEEDBACK` of every gate's actual state. Fix only the trivial/obvious misses; anything non-trivial → new task + `👤 NEEDS FLORIN DECISION`. (Respects Rule 3.)
- 🤖 AI FEEDBACK: …

---

# ───────────────────────────────────────────────
# PHASE 3 — BILLING DECISIONS (need Florin) + POLISH
# ───────────────────────────────────────────────

## TASK P10 — Retire the calendar trial; adopt FREE-forever + caps (PARK trial code)
**Status:** ⬜ TODO · **Branch:** `feature/no-trial-free-forever`
**Priority:** HIGH — shapes PRO billing UX and copy. Do before P8 (seat UI) and P14 (E2E).

### 👤 LOCKED DECISION (Florin, 2026-05-30)
**No calendar trial.** Conversion model = **FREE-forever with caps** (the engine) + an **event-triggered PRO taste at the cap** (the nudge — see P10b). Rationale: pull users in (they convert when they outgrow free / hit a cap), don't push them off a cliff. A card-required 3-month trial trains "it's free" then reads as bait-and-switch, and burns cost on non-payers.

### ⚠️ CRITICAL CONSTRAINT — PARK, do not DELETE
Florin wants the existing trial machinery **preserved for possible future hybrid use**, not removed. Existing assets: `src/lib/trial.ts`, `src/app/api/cron/trial-check`, `src/app/api/cron/trial-notifications`, `trial_period_days: 90` in `checkout/route.ts`, "3 months free trial" copy in `BillingPageClient.tsx`, schema fields `trialEndsAt`/`trialGraceEndsAt`/`trialNotifiedAt`.
**Parking method (do ALL of these, choose the cleanest per item):**
- Move trial logic behind a single feature flag `TRIAL_MODE_ENABLED = false` (one constant), so the code path is dormant but intact and re-activatable by flipping one value. Prefer this over commenting-out.
- Do NOT drop the schema columns (keep `trialEndsAt` etc. — harmless, needed if reactivated).
- Do NOT delete `trial.ts` or the cron routes. Guard their effect with the flag; leave files in place.
- Add a short comment block at each parked site: `// PARKED 2026-05-30 — trial disabled in favour of free-forever+caps (P10). Re-enable via TRIAL_MODE_ENABLED. See pro-hardening.md P10.`

### 🔍 Scope Before Touch (Rule 1)
- **Works now:** checkout creates subscription with `trial_period_days: 90`; trial crons send reminders; billing UI shows "3 months free trial" + "Start Free Trial" CTA.
- **Risks:** checkout is the money path — disabling the trial must NOT break upgrade. With no trial, the FIRST charge happens immediately on upgrade, so the upgrade UX must clearly say "you'll be charged €X now" (no surprise). Don't strand users mid-checkout.

### Premises to measure (Rule 2 — DO FIRST)
- `[MEASURED ✅]` `checkout/route.ts` sets `trial_period_days = pricing.trialMonths * 30` (=90 for PRO).
- `[MEASURED ✅]` `BillingPageClient.tsx` shows `trial: "3 months free trial"` and CTA `"Start Free Trial"`.
- `[ASSUMED ❓]` Removing `trial_period_days` makes Stripe charge immediately on checkout. CONFIRM in Stripe test mode (it should — no trial = first invoice at subscription start).
- `[ASSUMED ❓]` Nothing else (dashboard banners, onboarding) hard-depends on `isTrialing`. MEASURE: grep `isTrialing` / `trialDaysLeft` / `trialEndsAt` usages; ensure each tolerates "no trial" gracefully (Rule 5 soft-fail).

### Instructions (after measuring)
1. Introduce `TRIAL_MODE_ENABLED = false` (single source, e.g. in `stripe.ts` or a config). 
2. In `checkout/route.ts`: when trial mode off, omit `trial_period_days` / `subscription_data.trial_period_days` → immediate paid subscription. Keep the trial branch intact behind the flag.
3. In `BillingPageClient.tsx`: when trial off, replace "3 months free trial" → no trial line; CTA "Start Free Trial" → "Upgrade to PRO" / "Upgrade to Enterprise"; add a clear "Billed €X/mo, starting today" note before redirect.
4. Guard trial crons + `trial.ts` effects behind the flag (dormant, not deleted).
5. Confirm `subscriptionStatus` no longer enters `TRIAL` while flag is off; provisioning goes straight to `ACTIVE`.

### Acceptance criteria
- With flag off: FREE→PRO checkout in test mode charges immediately, tenant becomes `ACTIVE` (not `TRIAL`), modules unlock. No "trial" copy shown anywhere user-facing.
- Trial code/files/columns still present; flipping `TRIAL_MODE_ENABLED = true` restores prior behaviour (spot-check, don't ship it on).
- No references to `isTrialing`/`trialDaysLeft` throw when there's no trial. `tsc`+`lint` green.

### Out of scope
- The event-triggered PRO taste → that's **P10b** (fast-follow).
- Deleting any trial code (explicitly forbidden).

### 🤖 AI FEEDBACK
- measured:
- parking method used per asset:
- changed:
- Stripe test-mode result (immediate charge confirmed?):
- discovered:
- premise updates appended to pd.md? (y/n):

---

## TASK P10b — Event-triggered PRO taste at the FREE cap (the "pull" nudge)
**Status:** ⬜ TODO · **Branch:** `feature/cap-trigger-pro-taste`
**Priority:** FAST-FOLLOW — may ship AFTER initial PRO launch. Not a launch blocker. Florin: ship PRO with honest cap→upgrade first; add this once real cap-hit behaviour is observed.

### Concept
When a FREE user hits a cap (e.g. the 5th sent invoice/month), instead of only "upgrade to PRO", offer a one-time **"next 10 invoices on PRO, free"** taste — value-triggered, not time-triggered. Converts at the moment of felt need; costs nothing on users who never hit the cap.

### 🔍 Scope Before Touch
- **Works now:** `assertPeppolSentLimit()` blocks at the FREE cap (P-verified in plan-limits.ts). The block point is where the nudge attaches.
- **Risks:** must not weaken the real cap or let the taste be claimed repeatedly. One taste per tenant, tracked.

### Premises to measure
- `[MEASURED ✅]` cap enforcement lives in `plan-limits.ts` (`assertPeppolSentLimit`) called from `api/peppol/send`.
- `[ASSUMED ❓]` No existing "grant temporary allowance" mechanism. MEASURE before building.

### Instructions (after Florin greenlights timing)
1. Add a tenant-level one-shot grant (e.g. `proTasteGrantedAt` + `proTasteRemaining` counter, default null/0). New schema fields — keep minimal.
2. At the cap-hit point, if the tenant has never used the taste, surface the offer; on accept, grant N extra sent invoices at PRO behaviour for the current cycle, decrementing the counter. When exhausted → normal upgrade prompt.
3. Instrument analytics: taste offered / accepted / converted-to-paid (feeds PROMOTION_ROADMAP funnel).
4. Reuse `<LockedFeature>` / upgrade UI; this is an additional CTA, not a replacement.

### Acceptance criteria
- A FREE tenant at cap can claim the taste exactly once; extra invoices send; counter decrements; exhaustion returns to normal cap+upgrade. No way to re-claim. `tsc`+`lint` green.

### Out of scope
- Any change to PRO pricing or the parked trial.

### 🤖 AI FEEDBACK
- measured:
- changed:
- discovered:
- premise updates appended to pd.md? (y/n):

## TASK P11 — Make the quarterly billing toggle real (or hide it)
**Status:** ⬜ TODO · **Branch:** `bugfix/quarterly-billing`
- **Premise `[MEASURED ✅]`:** UI computes a 5%/10% quarterly discount, but `checkout/route.ts` always sends the MONTHLY price ID regardless of cycle → customer sees quarterly price, charged monthly.
- **Instructions:** EITHER wire quarterly price IDs / Stripe coupons into checkout so the cycle is honoured, OR hide the quarterly toggle until it's real. Florin to pick which in feedback if unclear; default = hide (smallest change, no mischarge risk).
- 🤖 AI FEEDBACK: …

## TASK P12 — Enforce cancellation notice periods (1mo PRO / 2mo ENT)
**Status:** ⬜ TODO · **Branch:** `bugfix/cancellation-notice`
- **Premise `[ASSUMED ❓]`:** UI advertises 1-month (PRO) / 2-month (ENT) notice. Stripe's native `cancel_at_period_end` does NOT model a notice period. **MEASURE** `stripe/cancel/route.ts` — does it compute the correct effective date, or just set period-end?
- **Instructions:** if not enforced, compute the correct cancellation-effective date (period end + notice) and reflect it in `cancellationEffectiveAt`. Data preserved, modules lock at effective date, never deleted (`pd.md` Rule). 
- 🤖 AI FEEDBACK: …

## TASK P13 — PAST_DUE eventual lockout (dunning)
**Status:** ⬜ TODO · **Branch:** `feature/pastdue-lockout`
- **Premise `[MEASURED ✅]`:** webhook sets `subscriptionStatus = PAST_DUE` on `invoice.payment_failed` and clears it on `invoice.paid`, but PAST_DUE does not restrict access — non-payers keep full access indefinitely.
- **Instructions:** after a grace window (Florin to set; default e.g. 14 days PAST_DUE), downgrade module access to FREE-equivalent (data preserved, fail-safe, upgrade prompt shown). Use the existing trial-check cron pattern. Soft-fail per Rule 5.
- 👤 DECISION (grace length): 
- 🤖 AI FEEDBACK: …

---

# ───────────────────────────────────────────────
# PHASE 4 — STAGED TEST RELEASE
# ───────────────────────────────────────────────

## TASK P14 — PRO end-to-end test pass in Stripe TEST mode
**Status:** ⬜ TODO · **Branch:** `release/pro-rc` (release candidate per pd.md Rule 8)
- **Instructions (full lifecycle, test mode):** FREE→PRO upgrade (immediate charge, NO trial — confirm `ACTIVE` not `TRIAL`) · add/remove extra user · add/remove workforce seat · hit & verify Peppol/scan limits at PRO numbers · downgrade PRO→FREE (data preserved, modules lock) · cancel with notice period · payment-failure → PAST_DUE → recovery. Document each result. (P10b taste flow tested separately if shipped.)
- **Acceptance:** every transition correct, no data loss, no tenant-facing 500/404, billing amounts match `PLAN_PRICING`. Then branch `release/vX.Y.Z` per `pd.md` staged-release workflow.
- 🤖 AI FEEDBACK (test matrix results): …

---

## 📋 STATUS SUMMARY (AI: keep this table in sync as you work)

| Task | Title | Phase | Status |
|---|---|---|---|
| P1 | FREE activeModules default | 1 | 🟢 DONE (awaiting Florin verify) |
| P2 | Seat billing wiring | 1 | ⬜ TODO |
| P3 | Stale-token gating | 1 | ⬜ TODO |
| P4 | `<LockedFeature>` component | 2 | ⬜ TODO |
| P5 | Gate Library/Bestek | 2 | ⬜ TODO |
| P6 | Gate Sales/Email | 2 | ⬜ TODO |
| P7 | Gate File Manager | 2 | ⬜ TODO |
| P8 | Seat-count UI reconcile | 2 | ⬜ TODO |
| P9 | planType depth audit | 2 | ⬜ TODO |
| P10 | Retire trial → free-forever (park code) | 3 | ⬜ TODO |
| P10b | Event-triggered PRO taste at cap | 3 (fast-follow) | ⬜ TODO |
| P11 | Quarterly toggle | 3 | ⬜ TODO |
| P12 | Cancellation notice | 3 | ⬜ TODO |
| P13 | PAST_DUE lockout | 3 | ⬜ TODO |
| P14 | PRO E2E test pass | 4 | ⬜ TODO |

---

## 👤 FLORIN — open decisions waiting on you
1. ~~P10 — Trial model~~ ✅ DECIDED 2026-05-30: no calendar trial; free-forever + caps; trial code PARKED behind `TRIAL_MODE_ENABLED` flag; event-triggered taste = P10b (fast-follow).
2. **P10b timing** — ship as fast-follow after PRO launch (recommended) or include at launch? (Default: fast-follow.)
3. **P13 — PAST_DUE grace length** before lockout.
4. **P1 backfill** — if existing FREE tenants are found over-provisioned, do we correct them?

---

## 🧭 PLANNER NOTES (Claude → for context, not execution)
- Ordering rationale: P1–P3 are the only true blockers (revenue path + integrity + security). Phase 2 is mostly verification — much may already be done since `feature_matrix.md`'s gaps table is dated 2026-04-21.
- P10 (retire trial) should land before P8 (seat UI copy) and P14 (E2E), since both depend on the no-trial billing UX. P10b is an explicit fast-follow, not on the launch critical path.
- Every "gap" is tagged `[ASSUMED ❓]` deliberately: per `pd.md`, the AI must measure current runtime before trusting a months-old doc. Several P5–P9 tasks may close as "already gated — no change."
- This workplan covers PRO only. ENTERPRISE hardening (HR, scheduling, multi-project coordination, Batiprix) is a later workplan once PRO ships.

*Written by Planner (Claude) 2026-05-30 · executed by Antigravity AI · approved by Florin.*
*Inherits all rules from `.agents/workflows/pd.md`.*
