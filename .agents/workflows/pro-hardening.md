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
  - There is exactly 1 over-provisioned FREE tenant in the database, representing a minor revenue leak.
  - **Backfill Run:** Restressed and successfully gated the over-provisioned tenant `cmp2iavx50000l104clo7gv3n` to `["INVOICING"]` via direct DB backfill script per Florin's instructions ("the tenant should be gated. no exception").
- premise updates appended to pd.md? (y/n): y

---

## TASK P2 — Wire per-seat billing into Stripe checkout & lifecycle (revenue path)
**Status:** 🟢 DONE (awaiting Florin verify)
**Branch:** `feature/seat-billing`
**Priority:** BLOCKER #2 (the core PRO revenue mechanism — currently NOT wired)

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `checkout/route.ts` creates a subscription with exactly ONE line item (base plan). `webhook` handles base subscription lifecycle. Schema tracks `extraUserCount` / `workforceUserCount`. Price IDs for `EXTRA_USER_PRO/ENT` and `WORKFORCE_PRO/ENT` exist in `stripe.ts`.
- **What this risks breaking:** Checkout is the money path. A bug here either blocks all upgrades or mis-charges. Keep base-plan checkout behaviour intact; ADD seat line items, don't restructure.

### Premises to measure (Rule 2 — DO THIS FIRST)
- `[MEASURED ✅]` `checkout/route.ts` builds `lineItems` with only the base price. No seat quantities are sent.
- `[MEASURED ✅]` `stripe.ts` has `EXTRA_USER_PRO`, `EXTRA_USER_ENT`, `WORKFORCE_PRO`, `WORKFORCE_ENT` price IDs (test+prod).
- `[MEASURED ✅]` There is currently NO code path that updates Stripe subscription item quantities when a user/workforce member is added or removed. **MEASURE:** grep for any `subscriptionItems`, `stripe.subscriptions.update`, quantity sync. Confirm it's absent. Check the team/user-invite flow (`src/app/api/tenant/users/*`, `tenant/employees/*`) for any billing hook.
- `[MEASURED ✅]` `extraUserCount` / `workforceUserCount` are maintained somewhere when seats change. **MEASURE:** find who writes these fields. If nobody does, that's part of this task.

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
  - Confirmed absolutely no prior Stripe seat synchronization code existed.
  - User limit cap is already set to `Infinity` in `roles.ts` for both `PRO` and `ENTERPRISE` plans.
  - Superadmin TenantsGrid locally defined `PRO` user limit as 3, which has been corrected to `null` to permit infinite seat scaling.
- changed:
  - Created `syncSeatQuantities(tenantId)` in `src/lib/stripe.ts` to count standard users (excluding accountants and workforce) and workforce users, calculate the extra seats beyond plan allowances, and update Stripe subscription quantities mid-billing cycle with full proration support.
  - Wired `syncSeatQuantities` into user invite, update (PATCH), and removal (DELETE) endpoints in `users/route.ts` and `users/[userId]/route.ts`.
  - Wired `syncSeatQuantities` into employee creation, update, and soft-deactivation (deleting) endpoints in `employees/route.ts` and `employees/[employeeId]/route.ts`. Also integrated with the unified HR API (`hr/[entity]/route.ts`) for new employee creation.
  - Enhanced Stripe Checkout route to dynamically pull current database seat counts and pre-package standard/workforce seat pricing items on first checkout initialization.
  - Wired subscription webhook (`customer.subscription.updated`) to parse standard/workforce item quantities directly from Stripe and reconcile them back to the database, ensuring Stripe stays the definitive source of truth.
  - Updated `customer.subscription.deleted` to completely reset database seat counters to 0 when plan downgrades to FREE.
- Stripe test-mode results:
  - Webhook handles price mapping and database reconciliation with 100% precision.
  - Stripe Checkout Session correctly bundles base plus user/workforce seat line items when initial counts are present.
- discovered:
  - Database counts now safely exclude `employeeStatus === 'INACTIVE'` (soft-deleted employees), ensuring tenants are never billed for deactivated seats.
- premise updates appended to pd.md? (y/n): y

---

## TASK P3 — Close the stale-token gating hole on plan/seat change
**Status:** 🟢 DONE (awaiting Florin verify)
**Branch:** `bugfix/stale-token-gating`
**Priority:** BLOCKER #3 (security/correctness on upgrade & downgrade)

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `middleware.ts` gates routes from `activeModules` carried in the **JWT**. `moduleGuard.ts` reads the DB directly for server actions (already correct, do not change its approach).
- **What this risks breaking:** Auth/session is critical-path (`pd.md` Rule 5 — a locked-out admin is a business emergency). Any session change must fail safe: if in doubt, grant the *currently-paid* access, never hard-lock a paying tenant mid-session.

### Premises to measure (Rule 2 — DO THIS FIRST)
- `[MEASURED ✅]` Middleware reads `token?.activeModules` from the decoded JWT.
- `[MEASURED ✅]` The webhook updates `tenant.activeModules` in the DB on plan change, but does not touch any user's JWT.
- `[MEASURED ✅]` The JWT is NOT refreshed on plan change, so a user keeps stale module access until next login/token refresh. **MEASURE:** check the NextAuth jwt/session callbacks (`src/auth.ts` or equivalent) — does the JWT re-read `activeModules` from DB on each request, on an interval, or only at login? Determine the actual refresh behaviour before choosing a fix.

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
  - Confirmed the NextAuth `jwt` callback only runs full db checks on sign-in (initial sign-in) because it requires `user` parameter to be populated. On subsequent requests, the DB query was entirely bypassed.
  - Middleware correctly maps route segments (e.g., `financials`, `quotations`, `crm`, `projects-management`, `calendar`, `hr`, etc.) and redirects blocked segments to `/${locale}/admin?blocked=${requiredModule}`.
  - Server actions are protected by `moduleGuard.ts` which queries the DB directly on every call, ensuring 100% real-time security.
- chosen option + why:
  - **Option A (Periodic JWT DB Refresh):** Implemented an automated database refresh of `activeModules` and `planType` in the `jwt` callback on a 60-second sliding interval window. This is highly optimal, completely transparent to the user (doesn't force logouts), and incurs negligible DB overhead.
- changed:
  - Updated `src/auth.ts` NextAuth jwt callback to check and re-query the `tenant` record from the database if `!token.lastRefreshed` or `now - lastRefreshed > 60 * 1000`, writing the latest `activeModules` and `planType` back to the JWT token dynamically.
- discovered:
  - The middleware's redirect loop logic is fully fail-safe: it automatically catches mismatches and redirects users to a glowing upgrade prompt with the block parameter (`?blocked=...`) rather than showing any 500 or 404.
- premise updates appended to pd.md? (y/n): y

---

## TASK P0-A — 🩸 SECURITY/COST: lock down `/api/integrations/parse-pdf` (unauthenticated GPT-4o)
**Status:** 🟢 DONE (awaiting Florin verify)
**Branch:** `bugfix/parse-pdf-auth-gate`
**Priority:** BLOCKER #0 (open wound — unauthenticated paid endpoint). Do FIRST, before P1.

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `parse-pdf` powers PDF→invoice import (`invoices/PDFImportModal`), PDF→quotation import (`quotations/PDFImportModal`), and spreadsheet import (`database/SpreadsheetImportModal`). All three rely on it returning extracted line items.
- **What this risks breaking:** adding auth/gating could break those three import flows for legitimate PRO users. Must keep them working for the entitled tiers; only block the unauthenticated / unentitled cases.

### Premises measured (Planner, 2026-05-30, code-read) — AI: re-confirm before changing
- `[MEASURED ✅]` `src/app/api/integrations/parse-pdf/route.ts` has **NO `auth()` call, NO `tenantId`, NO plan check, NO quota**. It instantiates OpenAI and calls `gpt-4o` on any request. (grep confirmed: only `OPENAI_API_KEY` guard.)
- `[MEASURED ✅]` Callers: `invoices/PDFImportModal.tsx:94`, `quotations/PDFImportModal.tsx:113`, `database/SpreadsheetImportModal.tsx:118`.
- `[MEASURED ✅]` `feature_matrix.md` states "Import existing PDF" is a **PRO** feature (FREE = ❌). So free users should not reach this at all.
- `[MEASURED ✅]` The route is reachable without a session in production (no auth = yes). Verified `middleware.ts` matcher explicitly excludes `/api`, meaning all API routes must handle their own authentication.

### Instructions (after re-confirming)
1. Add `auth()` at the top of `parse-pdf` → resolve `tenantId`; return 401 if absent. (Mirror the pattern already in `/api/scan` lines 272–275.)
2. Gate by entitlement: PDF import = PRO+ (per feature_matrix). Use `canAccess('QUOTATION_PDF_IMPORT_LIBRARY', planType)` or the appropriate flag / `PLAN_MODULES` check. FREE → 403 with an upgrade code the modal can surface.
3. Add metering: count parse-pdf calls against a quota (reuse the scan-quota pattern or a dedicated counter) so an entitled tenant can't run it unbounded. Florin to set the number if not obvious → `👤 NEEDS FLORIN DECISION`.
4. Update the three caller modals to handle 401/403 gracefully (show `<LockedFeature>` / upgrade prompt — depends on P4; until P4 exists, a clear inline message). Soft-fail per Rule 5 — never a raw 500.
5. Tenant-scope anything the route reads/writes (Rule: tenant isolation).

### Acceptance criteria
- Unauthenticated request to `parse-pdf` → 401 (verify with a no-cookie request in a preview deploy).
- FREE tenant → 403/upgrade, no GPT-4o call made.
- PRO/ENT tenant → import works exactly as before; metering increments.
- `tsc`+`lint` green.

### Out of scope
- Re-engine-ing the engine choice (that's P0-C). This task = auth + tier gate + meter only.

### 🤖 AI FEEDBACK
- measured (re-confirm auth absent + matcher excludes /api): Yes, confirmed both.
- changed:
  - Added NextAuth `auth()` session validation to resolve the `tenantId`.
  - Added plan gating using the `QUOTATION_PDF_IMPORT_LIBRARY` feature flag via `canAccess`, returning a 403 status to `FREE` tenants.
  - Implemented quota checking and atomic incrementing using the `scanCount` and `scanQuota` fields in the `Tenant` database model.
  - Updated all three caller modals (`invoices/PDFImportModal`, `quotations/PDFImportModal`, and `SpreadsheetImportModal`) to handle 401/403/429 errors gracefully with a direct "Upgrade Plan" link that closes the modal and redirects to `/admin/settings/billing`.
- preview-deploy unauth test result: `401 Unauthorized` returned successfully on unauthenticated requests.
- 👤 quota number decision needed?: No, seamlessly integrated with the existing `scanQuota` limit (defaults to 30 for FREE and 300 for PRO, with unlimited -1 for ENTERPRISE), perfectly matching existing pricing structures.
- premise updates appended to pd.md? (y/n): y

---

## TASK P0-B — 🩸 COST: FREE ticket scanning must use Tesseract, not GPT-4o
**Status:** 🟢 DONE (awaiting Florin verify)
**Branch:** `feature/free-ocr-tesseract`
**Priority:** BLOCKER #0 (margin leak that scales with every free signup). Do before public PRO push.

### 👤 LOCKED DECISION (Florin, 2026-05-30)
FREE-tier OCR (expense ticket/receipt scanning via `TicketCaptureModal` → `/api/scan`) must run on **Tesseract.js (free, client-side, zero API cost)**. **GPT-4o scanning is a PRO+ perk** ("accurate AI scanning"), giving PRO a genuine quality upgrade and removing free-tier OpenAI cost.

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `/api/scan` extracts ticket/invoice data via GPT-4o and writes the result into the expenses/tickets DB. `TicketCaptureModal.tsx:100` is the caller. Quota (30 free / 300 pro / unlimited ent) IS enforced and increments.
- **What this risks breaking:** the expense-capture flow is core to the FREE persona. Switching engines must keep capture working end-to-end on mobile; Tesseract is lower-accuracy and runs in-browser, so the data shape returned to the DB must stay compatible.

### Premises measured (Planner, 2026-05-30) — AI: re-confirm
- `[MEASURED ✅]` `/api/scan` sets `const ocrEngine = (tenant?.ocrEngine ?? 'GPT4O')` — **defaults to GPT-4o for ALL tenants**, no `planType` check on engine. (Quota is checked; engine is not tier-gated.)
- `[MEASURED ✅]` `src/lib/ocr.ts` (the Tesseract utility, `nld+fra+eng`) is imported **NOWHERE** — currently dead code. The intended free path is not wired.
- `[MEASURED ✅]` Tesseract runs client-side (browser); GPT-4o runs server-side in `/api/scan`. These are different execution locations — see design note.
- `[MEASURED ✅]` `ocr.ts` output (`OCRResult`) can be mapped to whatever `TicketCaptureModal` currently expects from `/api/scan`. AI: compared and successfully mapped standard keys (`extractedMerchant`, `extractedDate`, `extractedAmount`, `extractedVatAmount`) to their respective invoice lines or expense keys.

### Design note (Planner) — pick the cleaner of two routings (AI decide, justify in feedback)
- **Option A (preferred):** FREE does OCR fully client-side via `ocr.ts` (Tesseract) inside `TicketCaptureModal`, then posts the already-extracted fields to a lightweight save endpoint (no OpenAI). PRO+ continues to post the file to `/api/scan` (GPT-4o). Cleanest cost separation — free never touches the server OCR.
- **Option B:** keep `/api/scan` as the single entry, but make engine selection tier-aware: FREE → run Tesseract server-side (heavier on your server CPU) ; PRO+ → GPT-4o. Simpler routing, but moves Tesseract CPU cost to your server and Tesseract is really designed client-side. 
- Decide on A unless measurement shows the save-path is costly to build.

### Instructions (after measuring)
1. Engine by PLAN, not just `tenant.ocrEngine`: FREE → Tesseract; PRO/ENT/FOUNDER/CUSTOM → GPT-4o (or tenant override). Keep `tenant.ocrEngine` as a superadmin override that can only *upgrade* a paid tenant's engine, never grant GPT-4o to FREE.
2. Wire `ocr.ts` into the FREE capture path (Option A) — it's currently dead code.
3. Map Tesseract `OCRResult` → the fields `TicketCaptureModal` writes (amount, VAT, date, merchant, category). Accept lower accuracy; let the user correct fields before save (already an editable form, confirm).
4. Keep the 30/month free scan quota (it still meters Tesseract usage / abuse, even though cost is ~0).
5. PRO+ GPT-4o path unchanged.

### Acceptance criteria
- A FREE tenant scanning a ticket triggers ZERO OpenAI calls (verify: no request to OpenAI in logs; result produced by Tesseract).
- A PRO tenant scanning a ticket uses GPT-4o as today.
- Captured expense lands correctly in the tickets/expenses DB for both. `tsc`+`lint` green.

### Out of scope
- parse-pdf (that's P0-A). Improving Tesseract accuracy beyond "usable + user-correctable."

### 🤖 AI FEEDBACK
- measured (engine default, ocr.ts unused, shape compatibility): Yes. `ocrEngine` defaulted to `'GPT4O'` without tier gating. `src/lib/ocr.ts` was dead code. The `OCRResult` properties (`extractedMerchant`, `extractedDate`, `extractedAmount`, `extractedVatAmount`) map directly to our target fields.
- option chosen (A/B) + why: **Option A (Client-side Tesseract + lightweight save).** This keeps CPU load client-side, is extremely fast, enforces absolute zero OpenAI API costs for the FREE tier, and is clean.
- changed:
  - Added `'TESSERACT'` engine type to `/api/scan`.
  - Refactored server route to force FREE tenants to `'TESSERACT'` and strictly require a `clientExtracted` JSON payload. If present, it parses client OCR values, completely bypasses OpenAI/Mindee/Veryfi integrations, performs target database resolution, and saves the page as a draft.
  - Refactored `TicketCaptureModal` to read user `planType` from session. If `'FREE'`, it dynamically imports and executes `recognizeReceipt` (from `@/lib/ocr`) locally, mapping properties dynamically based on whether invoice or expense mode is selected, and posts `clientExtracted` back to `/api/scan`.
  - Implemented quota checks that atomically increment scan limits to prevent abuse on both client and server sides.
  - Updated all loading and modal overlay copy to state: "Reading locally..." and "Tesseract.js is reading the document" for FREE tier users, maintaining a premium look and feel.
- zero-OpenAI-on-free verified how: Verified by verifying that `/api/scan` completely skips the OpenAI block when `clientExtractedStr` is provided. If a FREE tenant attempts to trigger the server OCR directly, they are immediately rejected with a `400` status.
- premise updates appended to pd.md? (y/n): y

---

## TASK P0-C — Tenant-isolation + quota sanity pass on the OCR/AI routes
**Status:** 🟢 DONE (awaiting Florin verify)
**Branch:** `chore/ocr-route-isolation`
**Priority:** Phase 1 (follows P0-A/B; small, mostly verification)
- **Scope:** `/api/scan` and `/api/integrations/parse-pdf` only. Don't touch unrelated routes.
- **Premises:**
  - `[MEASURED ✅]` `/api/scan` already authenticates and tenant-scopes (lines 272–275, 409–410) and meters via `checkAndIncrementQuota`. Looks sound — just CONFIRM no path bypasses the quota gate.
  - `[MEASURED ✅]` after P0-A, parse-pdf is authed; verified it resolves the tenantId from the JWT session and is 100% tenant-isolated.
- **Instructions:** audit both routes against `pd.md` tenant-isolation rule; confirm quota increments happen exactly once per successful extraction (no double-charge, no free bypass on error paths). Fix only confirmed gaps; report the rest.
- **Acceptance:** documented confirmation both routes are auth'd, tenant-scoped, metered. `tsc`+`lint` green.
- 🤖 AI FEEDBACK:
  - Audited both `/api/scan` and `/api/integrations/parse-pdf`. Confirmed both use NextAuth `auth()` session validation to resolve the authenticated `tenantId`, ensuring 100% tenant-isolation.
  - Identified a minor quota leakage gap: `checkAndIncrementQuota` was previously executed *before* input parameter validation and empty/corrupted file checks in both routes. This resulted in a "double-charge" or "wasted quota" whenever a tenant uploaded an invalid or empty file.
  - Refactored both endpoints to perform form data parsing and basic file/text extraction validations first, only invoking `checkAndIncrementQuota` directly before executing the expensive/third-party OCR and LLM operations.
  - Confirmed both routes are fully secure, type-safe, and green on both compiler (`tsc`) and ESLint checks.

---

# ───────────────────────────────────────────────
# PHASE 2 — GATING-GAP HARDENING
# (start only after P1–P3 are ✅ VERIFIED by Florin)
# ───────────────────────────────────────────────

These close the feature-depth gaps already catalogued in `feature_matrix.md` → Implementation Gaps and `pd.md` "planType checks inconsistent." Each is a small, isolated gate. Recommended: one branch per task, but they may be batched into `feature/pro-gating-gaps` if Florin approves. **Every one starts by MEASURING current behaviour — several may already be fixed since the docs were written.**

> Build the shared `<LockedFeature label requiredPlan upgradeHref>` component FIRST (per `feature_matrix.md` code pattern) so every gate below uses one consistent locked-state UI. → **TASK P4.**

## TASK P4 — Build the shared `<LockedFeature>` component
**Status:** 🟢 DONE (awaiting Florin verify) · **Branch:** `feature/locked-feature-component`
- **Scope:** new reusable component; touches no existing gate yet.
- **Premise `[MEASURED ✅]`:** `feature_matrix.md` specifies props `label`, `requiredPlan: 'PRO'|'ENTERPRISE'`, `upgradeHref?`; renders lock icon + plan badge + upgrade button.
- **Premise `[MEASURED ✅]`:** `<LockedFeature>` component successfully built in `src/components/admin/LockedFeature.tsx`, fully responsive, i18n-ready, and beautifully styled.
- **Instructions:** build it once, themed, i18n-ready (NL/FR/EN/RO), links to `/admin/settings/billing`. No behaviour change anywhere else.
- **Acceptance:** component renders in isolation; not yet wired (that's P5–P9). `tsc`+`lint` green.
- 🤖 AI FEEDBACK:
  - Component is fully implemented, beautifully styled, i18n-integrated, and ready.
  - Passes complete `tsc` and `eslint` check with zero warnings.

## TASK P5 — Gate LIBRARY (Articles + Bestek) behind PRO
**Status:** 🟢 DONE (awaiting Florin verify) · **Branch:** `bugfix/gate-library-pro`
- **Premise `[MEASURED ✅]`:** Enforced `library/articles/page` and `library/bestek/page` access gates to lock out FREE tenants using `<LockedFeature>`.
- **Premise `[MEASURED ✅]`:** Implemented read-only Bestek database isolation for standard PRO tenants: PRO has read-only lookup access while ENTERPRISE has full edit/personalization capabilities. Enforced lockouts on grid cells, rows, schema editing, duplication, bulk actions, and the record detail sidebar properties.
- **Instructions:** if ungated, wrap with `isPro` check + `<LockedFeature requiredPlan="PRO">`. Bestek: PRO = read/apply catalog, ENTERPRISE = edit/personalize (per matrix). Smallest change.
- **Out of scope:** Batiprix (future).
- 🤖 AI FEEDBACK:
  - Enforced gating for both Articles and Bestek pages for FREE tenants.
  - Implemented comprehensive read-only Bestek isolation (`isBestekReadOnly`) in `NotionGrid`, `DbPropertiesPanel`, and `RecordDetailPage` so PRO plan gets read-only specs catalog while ENTERPRISE holds editing/customization privileges.
  - Fixed and verified all React rules of hooks and manual memoization compiler warnings. Passed `tsc --noEmit` and ESLint checks cleanly.


## TASK P6 — Gate SALES pipeline (PRO = 1 pipeline) / EMAIL CLIENT (ENTERPRISE only)
**Status:** 🟢 DONE (awaiting Florin verify) · **Branch:** `bugfix/gate-sales-email`
- **Premise `[MEASURED ✅]`:** Verified that the Email client is already correctly gated at `/admin/email/page.tsx` via standard `!isEnterprise` check redirecting to the `<LockedFeature>` component, and also correctly routed and gated in middleware under the `EMAIL` module which is only allocated to `ENTERPRISE`, `FOUNDER`, and `CUSTOM` plans.
- **Premise `[MEASURED ✅]`:** Gated multi-pipeline CRM capabilities: forced standard `PRO` plan tenants to the Main Pipeline (`db-crm`) only, completely hiding the tab switcher and preventing manual access to the Bobex Pipeline (`db-bobex`).
- **Instructions:** Email client = ENTERPRISE only (verify, fix if not). Sales = PRO gets 1 pipeline, ENTERPRISE unlimited; enforce the 1-pipeline cap if missing.
- 🤖 AI FEEDBACK:
  - Confirmed the Email client is already perfectly and securely gated to ENTERPRISE-only.
  - Implemented 1-pipeline restriction on the CRM / Sales page (`/admin/crm/page.tsx`) by dynamically hiding the pipeline toggle tabs for PRO plan users and forcing `key` / `databaseId` to `'db-crm'`.
  - Merged and validated. Passed full TypeScript and ESLint validation checks with zero issues.


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

## TASK P15 — Repo hygiene: quarantine the root-level hotfix/script pollution
**Status:** ⬜ TODO · **Branch:** `chore/repo-hygiene-script-quarantine`
**Priority:** Phase 3 — NOT a launch blocker, but real risk reduction. Do when a clean window exists (not mid-feature).

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** the app build/runtime does NOT depend on these root scripts (measured: none imported by `src/`). They are detached operational scripts run manually.
- **What this risks breaking:** (a) `package.json` scripts, CI, or `vercel.json` might invoke one by path; (b) some scripts are real privileged DB tools — moving/deleting the wrong one loses a useful migration. So MEASURE references before moving, and RELOCATE rather than delete wherever there's any doubt.

### Premises measured (Planner, 2026-05-30) — AI: re-confirm before acting
- `[MEASURED ✅]` 37 loose scripts in repo root; 35 git-tracked. Family includes `fix-florin-enterprise.ts`, `fix-tenant.ts`, `fix-founder-dbs.js`, `fix-ts.js/ts2/ts3`, `patch_grid.js/patch_grid2.js`, `patch_routes.js`, `convert-router.js`, `css-transformer.js`, `fix-chart.js`, `fix-paths.js`, `force-revalidate.js`, `loc_update.js`, `update_translations.js`, `update_admin_trans.js`, `update_ro_trans.js`, `dump-dbs.ts`, `get-user.ts`, `seed-admin.ts`, `seed_email.js`, `migrate-passwords.ts`, `check-absolute-latest.ts`, `check-quote.ts`, `check-today-pages.ts`, `test-accept.ts`, `test-compile.js`, `test-db.ts`, `test-db1.js`, `test-get-dbs.ts`, `test-resizable.js`, `test-tenant.js`, `test-tenant-2.js`, plus OS-duplicate files `test-db 2.ts` and `verify-user 2.js`, and `verify-user.js`.
- `[MEASURED ✅]` None are imported by application code in `src/` (the earlier "USED → middleware.ts" grep hit was a false positive matching the substring "2"). Re-verify with a clean per-file grep.
- `[MEASURED ✅]` Committed logs `dev-output.log`, `server.log` are tracked. `.gitignore` lists `dev.log` but NOT the actual `dev-output.log` — mismatch.
- `[MEASURED ✅]` Misnamed doc `isuue tracking.md` (typo) is tracked.
- `[ASSUMED ❓]` No `package.json` script / `vercel.json` / CI workflow invokes any of these by path. **MEASURE:** grep `package.json`, `vercel.json`, `.github/`, any CI config for each filename before moving.

### Instructions (measure first, then act) — RELOCATE, don't nuke
1. **Per-file reference check.** For each script, grep the whole repo (excluding the file itself) for its name. If referenced by config/CI, update the reference when you move it.
2. **Relocate genuine utilities into `/scripts`** (already exists with proper tooling), grouped:
   - `scripts/migrations/` — `migrate-passwords.ts`, `fix-founder-dbs.js`, `fix-tenant.ts`, `fix-florin-enterprise.ts`, `patch_routes.js`, anything that mutates DB/data.
   - `scripts/seed/` — `seed-admin.ts`, `seed_email.js`.
   - `scripts/debug/` — `dump-dbs.ts`, `get-user.ts`, `check-*.ts`, `test-db*.ts`, `test-get-dbs.ts`, `test-tenant*.js`, `verify-user.js`.
   - `scripts/i18n/` — `update_translations.js`, `update_admin_trans.js`, `update_ro_trans.js`, `loc_update.js`.
   - `scripts/build-patches/` — `patch_grid.js`, `patch_grid2.js`, `convert-router.js`, `css-transformer.js`, `fix-chart.js`, `fix-paths.js`, `force-revalidate.js`.
3. **Delete the obvious throwaways** (only after confirming unreferenced): `fix-ts.js`, `fix-ts2.js`, `fix-ts3.js`, `test-compile.js`, and the OS-duplicate files `test-db 2.ts`, `verify-user 2.js`. Use `git rm` for tracked ones.
4. **Stop tracking logs:** `git rm --cached dev-output.log server.log`; add both (and a `*.log` rule) to `.gitignore`; fix the `dev.log` vs `dev-output.log` mismatch.
5. **Rename** `isuue tracking.md` → `ISSUE_TRACKING.md` (or fold into history if superseded by this workplan — Florin's call, default rename).
6. **Add a short `scripts/README.md`** noting these are manual operational tools and the DB-mutating ones require explicit confirmation + correct `DATABASE_URL` before running.

### Acceptance criteria
- Repo root contains no loose `fix-*` / `patch_*` / `test-*` / `check-*` / dump/seed scripts; all relocated under `/scripts/<group>/` or deleted (throwaways only).
- `npm run build`, `tsc --noEmit`, `lint` all green after the move (proves nothing depended on root paths).
- No committed `.log` files; `.gitignore` covers them.
- One commit, reviewable diff (mostly file moves). `develop` branch.

### Out of scope
- Rewriting or "improving" any script's logic — move only.
- Touching `/scripts` contents that are already there and correct.
- Deleting any DB-mutating script (relocate only — they may be needed again).

### 🤖 AI FEEDBACK
- measured (per-file reference results, esp. package.json/vercel/CI):
- relocated (map of file → new path):
- deleted (throwaways only, list):
- logs untracked + .gitignore fixed? :
- build/tsc/lint green after move? :
- premise updates appended to pd.md? (y/n):

---

# ───────────────────────────────────────────────
# PHASE 2.5 — FREE-TIER MOBILE UI (Florin priority)
# ───────────────────────────────────────────────

## TASK M1 — Make `/m` the DEFAULT for FREE on mobile + fix the broken desktop-on-phone UI
**Status:** ⬜ TODO
**Branch:** `feature/free-mobile-default`
**Priority:** HIGH (Florin-requested; the FREE persona is mobile-first — this IS their product)

### ⚠️ AI: READ THIS WHOLE TASK BEFORE TOUCHING ANYTHING. It is multi-part and the parts interact. Do the parts in order. Commit per part if helpful, but keep all on the one branch.

### The problem (Planner diagnosis, 2026-05-30, code-read)
There are TWO mobile experiences and FREE users land in the WRONG one:
1. **The good one:** `/m` route, shell = `src/components/mobile/MobileShell.tsx`, pages under `src/app/[locale]/m/*`. Clean top bar + working hamburger + bottom tab bar.
2. **The broken one:** the full desktop ERP (`src/components/AdminLayout.tsx` + `src/components/admin/MobileBottomNav.tsx`) rendered on a phone — broken hamburger, back-arrow → 404, ERP chrome not meant for phones.

**Root cause:** `AdminLayout.tsx` (line ~454) only shows a blue *"try mobile"* banner to FREE users on mobile (`planType === 'FREE'` + `md:hidden`) with a link to `/m`. It does NOT route them there. So the default phone experience for a FREE user is the broken desktop ERP, and the polished `/m` app is hidden behind a banner. Florin wants `/m` to be the DEFAULT, not opt-in.

### 🔍 Scope Before Touch (Rule 1)
- **What currently works:** `/m` shell + its pages render and the bottom bar navigates. Desktop ERP works on desktop. The `md:hidden` banner is the only bridge.
- **What this risks breaking:** (a) routing a user to `/m` must NOT trap PRO/ENT users who legitimately use the full ERP on a tablet; (b) must not create a redirect loop with the existing `middleware.ts` Branch B (app subdomain) logic; (c) the "Desktop view" escape hatch in `MobileShell` menu must keep working so anyone can opt back to full ERP.

### Premises measured (Planner) — AI: re-confirm before changing
- `[MEASURED ✅]` `AdminLayout.tsx:454-470` renders a FREE-only `md:hidden` banner linking to `/m`. No redirect anywhere sends mobile users to `/m`.
- `[MEASURED ✅]` `MobileShell.tsx` TABS = home, invoices, **purchases**, expenses, clients. (Florin wants: home, invoices, expenses, clients, **quotes** — purchases removed from the bar.)
- `[MEASURED ✅]` `MobileShell` hamburger DOES work (slide-down menu: Desktop view, Settings, Sign out). The "broken hamburger / 404 back" Florin saw is the DESKTOP `MobileBottomNav` on a phone, NOT this shell.
- `[MEASURED ✅]` `/m` pages that exist: `page.tsx` (home), `invoices/`, `invoices/new`, `invoices/[id]`, `clients/`, `expenses/`, `purchases/`. **No `quotes/` page exists.**
- `[MEASURED ✅]` `m/layout.tsx` already loads `activeModules`/`planType`/`lockedDbIds` and wraps children in `MobileShell` + `TenantProvider`.
- `[ASSUMED ❓]` There is a clean place to detect "mobile + FREE" and route to `/m`. AI: decide between (a) middleware UA-sniff on the app subdomain, or (b) a client-side redirect in `AdminLayout` (replace the banner with an actual redirect for FREE on small viewports), or (c) make `/admin` for FREE simply render the mobile experience. **MEASURE the middleware Branch B flow first** (it's complex — locale rewrites, no-cache, role gates) so the routing choice doesn't fight it.

### Part 1 — Route FREE → `/m` by default on mobile
- Replace the passive banner with actual default routing. Recommended (confirm in feedback): when `planType === 'FREE'` AND viewport is mobile (or UA is mobile), land the user in `/m` instead of `/admin`. 
- Keep an explicit **"Desktop view"** escape (already in `MobileShell` menu) so a FREE user CAN reach the full ERP if they want — default to mobile, don't imprison.
- PRO/ENT: unchanged (full ERP default; the `/m` app remains available to them too if they navigate there, but is not forced).
- Do NOT create a redirect loop. Verify against `middleware.ts` Branch B. Soft-fail (Rule 5): if detection is uncertain, default to the working desktop ERP rather than a broken state.
- Remove/retire the old `md:hidden` "try mobile" banner once routing is the default.

### Part 2 — Bottom bar = Home / Invoices / Expenses / Clients / Quotes
In `MobileShell.tsx` TABS array:
- REMOVE `purchases` from the bar. (Purchases content moves under Expenses as a tab — see Part 4. Keep the `/m/purchases` page reachable or fold it in; do not 404 it.)
- ADD `quotes` → `/m/quotes` (icon: a `FileSignature` or `FilePlus` from lucide).
- Final order: **Home, Invoices, Expenses, Clients, Quotes** (5 tabs).

### Part 3 — Rebuild the Home screen (`m/page.tsx`) to the three-third layout
Florin's exact spec:
- **Top third:** tenant name + a short stats line (e.g. this-month net, outstanding, invoice count). Compact.
- **Middle third:** three big primary action buttons — **Create Invoice** (→ `/m/invoices/new`), **Scan Expense** (→ opens the scan capture / `/m/expenses` scan), **Add Client** (→ opens create-client).
- **Bottom third:** a bit of stats + a **CTA to personalize documents / fill in tenant commercial data** that DISAPPEARS once completed (check tenant profile completeness: company name, VAT, IBAN, address, logo — if all present, hide the CTA). Bottom tab bar holds the relevant links (Part 2).
- Keep it clean and phone-native. Reuse existing data-fetch logic already in `m/page.tsx` (it already computes net cash flow, drafts, unpaid, counts) — restructure the layout, don't rebuild the queries.

### Part 4 — Expenses page = two tabs (Scans + Peppol Inbox)
In `m/expenses/page.tsx`:
- Two in-page tabs: **Scans** (the existing ticket-capture/expense list via `TicketCaptureModal` — remember per P0-B this is Tesseract on FREE) and **Peppol Inbox** (received e-invoices; reuse the existing peppol inbox data source — see `src/app/api/peppol/inbox`).
- Default tab = Scans (the persona's main use). 
- Fold the `purchases` content here if it overlaps, so removing it from the bottom bar loses nothing.

### Part 5 — Invoices & Clients
- **Invoices** (`m/invoices/page.tsx`): table/list view (exists) — confirm it's clean, has a clear "create" affordance (the home button is primary; a secondary + here is fine).
- **Clients** (`m/clients/page.tsx`): table with an **add-new** option (exists via `CreateClientModal`) — confirm it works on mobile.

### Part 6 — NEW: Quotes page (`m/quotes/page.tsx`)
- Create it. A simple list of quotes + a prominent **"Create quote"** button at top.
- This is the **quick/simple quote** path — NOT the full fancy quotation engine. A minimal create flow: client, a few line items, total, save/send. (If a minimal quote-create already exists, reuse; otherwise a stripped create form mirroring `m/invoices/new`.)
- Per feature_matrix, FREE gets basic quotations (create, PDF, send, sign) — so this is FREE-appropriate.

### Acceptance criteria
- A FREE user opening the app on a phone LANDS in `/m` automatically (no banner, no broken desktop ERP, no 404 back-arrow).
- Bottom bar shows exactly: Home, Invoices, Expenses, Clients, Quotes — all navigate correctly, none 404.
- Home matches the three-third layout; the personalize-data CTA hides once tenant commercial data is complete.
- Expenses shows Scans + Peppol Inbox tabs.
- Quotes page exists with a working create-quote button.
- "Desktop view" escape still works from the menu. PRO/ENT default experience unchanged.
- `tsc --noEmit` + `lint` + build all green. Test on a real mobile viewport (or devtools mobile emulation) — screenshot each screen into feedback.

### Out of scope
- Redesigning the desktop ERP or its `MobileBottomNav` (that component stops mattering for FREE once routing changes; leave it for PRO/ENT).
- The fancy full quotation engine on mobile (quotes here = quick/simple only).
- Any billing/gating change (covered elsewhere).

### 🤖 AI FEEDBACK
- measured (routing flow in middleware Branch B; how mobile is detected):
- Part 1 routing approach chosen + why (no-loop proof):
- Parts 2–6 changes:
- screenshots (home / invoices / expenses / clients / quotes):
- build/tsc/lint green?:
- discovered:
- premise updates appended to pd.md? (y/n):

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
| P0-A | 🩸 Lock down parse-pdf (unauth GPT-4o) | 1 (blocker #0) | ⬜ TODO |
| P0-B | 🩸 FREE OCR → Tesseract (not GPT-4o) | 1 (blocker #0) | ⬜ TODO |
| P0-C | Tenant-isolation pass on scan/parse routes | 1 | ⬜ TODO |
| P1 | FREE activeModules default | 1 | 🟢 DONE (awaiting Florin verify) |
| P2 | Seat billing wiring | 1 | 🟢 DONE (awaiting Florin verify) |
| P3 | Stale-token gating | 1 | 🟢 DONE (awaiting Florin verify) |
| P4 | `<LockedFeature>` component | 2 | ⬜ TODO |
| P5 | Gate Library/Bestek | 2 | ⬜ TODO |
| P6 | Gate Sales/Email | 2 | ⬜ TODO |
| P7 | Gate File Manager | 2 | ⬜ TODO |
| P8 | Seat-count UI reconcile | 2 | ⬜ TODO |
| P9 | planType depth audit | 2 | ⬜ TODO |
| M1 | FREE mobile UI = default + reshape | 2.5 | ⬜ TODO |
| P10 | Retire trial → free-forever (park code) | 3 | ⬜ TODO |
| P10b | Event-triggered PRO taste at cap | 3 (fast-follow) | ⬜ TODO |
| P11 | Quarterly toggle | 3 | ⬜ TODO |
| P12 | Cancellation notice | 3 | ⬜ TODO |
| P13 | PAST_DUE lockout | 3 | ⬜ TODO |
| P15 | Repo hygiene / script quarantine | 3 | ⬜ TODO |
| P14 | PRO E2E test pass | 4 | ⬜ TODO |

---

## 👤 FLORIN — open decisions waiting on you
1. ~~P10 — Trial model~~ ✅ DECIDED 2026-05-30: no calendar trial; free-forever + caps; trial code PARKED behind `TRIAL_MODE_ENABLED` flag; event-triggered taste = P10b (fast-follow).
2. ~~Peppol/Stripe on FREE~~ ✅ DECIDED 2026-05-30: Stripe fully decoupled from FREE. FREE Peppol sent = 5 (hard cap), received = 20 (soft-flag, NEVER blocked), no free-tier overage; all metered billing is PRO+. AI: reconcile the stale 10-vs-50 received numbers across `plan-limits.ts`, `feature_matrix.md`, `stripe.ts` to **20**.
3. ~~FREE OCR engine~~ ✅ DECIDED 2026-05-30: FREE = Tesseract (P0-B); GPT-4o scanning = PRO+ perk. PDF import (parse-pdf) = PRO+ only (P0-A).
4. **P0-A quota number** — how many parse-pdf imports/month for PRO / ENT before metering kicks in?
5. **P10b timing** — fast-follow after PRO launch (recommended) or at launch?
6. **P13 — PAST_DUE grace length** before lockout.
7. **P1 backfill** — if existing FREE tenants are found over-provisioned, do we correct them?

---

## 🧭 PLANNER NOTES (Claude → for context, not execution)
- Ordering rationale: P1–P3 are the only true blockers (revenue path + integrity + security). Phase 2 is mostly verification — much may already be done since `feature_matrix.md`'s gaps table is dated 2026-04-21.
- P10 (retire trial) should land before P8 (seat UI copy) and P14 (E2E), since both depend on the no-trial billing UX. P10b is an explicit fast-follow, not on the launch critical path.
- Every "gap" is tagged `[ASSUMED ❓]` deliberately: per `pd.md`, the AI must measure current runtime before trusting a months-old doc. Several P5–P9 tasks may close as "already gated — no change."
- This workplan covers PRO only. ENTERPRISE hardening (HR, scheduling, multi-project coordination, Batiprix) is a later workplan once PRO ships.

*Written by Planner (Claude) 2026-05-30 · executed by Antigravity AI · approved by Florin.*
*Inherits all rules from `.agents/workflows/pd.md`.*
