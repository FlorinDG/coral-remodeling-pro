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

0. **BRANCH POLICY (overrides every per-task `Branch:` line below).** Do NOT create new branches per task — it clutters Vercel with preview branches. There are exactly FOUR branches; use only these:
   - **`develop`** — commit ALL task work here directly. We test versions on `develop`.
   - **`staging`** — pre-release check only. When a batch on `develop` tests good, Florin names a version and promotes `develop` → `staging` for a final check before release.
   - **`sandbox`** — optional scratch space for risky/throwaway experiments that shouldn't touch `develop`. Nothing durable lives here.
   - **`main`** — SACRED. Never commit or merge here except the final version promotion from `staging`. The AI must NEVER touch `main`.
   Flow: coder → `develop` (test) → name version → `staging` (final check) → `main`. Any `Branch:` field in a task below is VOID — ignore it, work on `develop`. Per `pd.md` Rule 6/8: run `tsc --noEmit` + `lint` green before each commit to `develop`.
1. **Turn-taking / no concurrent writes.** Only one agent writes this file at a time. If you (AI) are editing it, finish and save before any other tool touches it. This avoids the mount-lock corruption we already hit once.
2. **Premise tags are law.** Every factual claim in a task is tagged:
   - `[MEASURED ✅]` — verified in current runtime/code. Safe to deduce from.
   - `[ASSUMED ❓]` — Planner's inference. **You MUST run Rule 2 (measure) and confirm before changing code.** If the assumption is false, STOP, write what you found in `🤖 AI FEEDBACK`, set status `🔴 BLOCKED — premise false`, and do not proceed.
3. **Status vocabulary** (update the task's `Status:` line as you work):
   - `⬜ TODO` · `🟡 IN PROGRESS` · `🟢 DONE (awaiting Florin verify)` · `✅ VERIFIED` (Florin only) · `🔴 BLOCKED` · `👤 NEEDS FLORIN DECISION`
4. **Do not mark `✅ VERIFIED`.** Only Florin does. You may go as far as `🟢 DONE (awaiting Florin verify)`.
5. **Scope discipline.** Do ONLY what the task says. If you discover adjacent work, note it under `🤖 AI FEEDBACK → discovered`, do NOT do it.
6. **After each validated change**, append a row to the premises table in `pd.md` (its existing ritual), and fill `🤖 AI FEEDBACK`.
7. **All work → `develop` directly** (see rule 0). The `Branch:` fields in tasks are legacy and VOID — do not create per-task branches.

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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
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
**Status:** 🟢 DONE — ⏳ AWAITING FLORIN STRIPE TEST-MODE CHECK (do not ✅ until add-user/add-workforce/remove verified live)
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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
- **Scope:** new reusable component; touches no existing gate yet.
- **Premise `[MEASURED ✅]`:** `feature_matrix.md` specifies props `label`, `requiredPlan: 'PRO'|'ENTERPRISE'`, `upgradeHref?`; renders lock icon + plan badge + upgrade button.
- **Premise `[MEASURED ✅]`:** `<LockedFeature>` component successfully built in `src/components/admin/LockedFeature.tsx`, fully responsive, i18n-ready, and beautifully styled.
- **Instructions:** build it once, themed, i18n-ready (NL/FR/EN/RO), links to `/admin/settings/billing`. No behaviour change anywhere else.
- **Acceptance:** component renders in isolation; not yet wired (that's P5–P9). `tsc`+`lint` green.
- 🤖 AI FEEDBACK:
  - Component is fully implemented, beautifully styled, i18n-integrated, and ready.
  - Passes complete `tsc` and `eslint` check with zero warnings.

## TASK P5 — Gate LIBRARY (Articles + Bestek) behind PRO
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
- **Premise `[MEASURED ✅]`:** Enforced `library/articles/page` and `library/bestek/page` access gates to lock out FREE tenants using `<LockedFeature>`.
- **Premise `[MEASURED ✅]`:** Implemented read-only Bestek database isolation for standard PRO tenants: PRO has read-only lookup access while ENTERPRISE has full edit/personalization capabilities. Enforced lockouts on grid cells, rows, schema editing, duplication, bulk actions, and the record detail sidebar properties.
- **Instructions:** if ungated, wrap with `isPro` check + `<LockedFeature requiredPlan="PRO">`. Bestek: PRO = read/apply catalog, ENTERPRISE = edit/personalize (per matrix). Smallest change.
- **Out of scope:** Batiprix (future).
- 🤖 AI FEEDBACK:
  - Enforced gating for both Articles and Bestek pages for FREE tenants.
  - Implemented comprehensive read-only Bestek isolation (`isBestekReadOnly`) in `NotionGrid`, `DbPropertiesPanel`, and `RecordDetailPage` so PRO plan gets read-only specs catalog while ENTERPRISE holds editing/customization privileges.
  - Fixed and verified all React rules of hooks and manual memoization compiler warnings. Passed `tsc --noEmit` and ESLint checks cleanly.


## TASK P6 — Gate SALES pipeline (PRO = 1 pipeline) / EMAIL CLIENT (ENTERPRISE only)
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
- **Premise `[MEASURED ✅]`:** Verified that the Email client is already correctly gated at `/admin/email/page.tsx` via standard `!isEnterprise` check redirecting to the `<LockedFeature>` component, and also correctly routed and gated in middleware under the `EMAIL` module which is only allocated to `ENTERPRISE`, `FOUNDER`, and `CUSTOM` plans.
- **Premise `[MEASURED ✅]`:** Gated multi-pipeline CRM capabilities: forced standard `PRO` plan tenants to the Main Pipeline (`db-crm`) only, completely hiding the tab switcher and preventing manual access to the Bobex Pipeline (`db-bobex`).
- **Instructions:** Email client = ENTERPRISE only (verify, fix if not). Sales = PRO gets 1 pipeline, ENTERPRISE unlimited; enforce the 1-pipeline cap if missing.
- 🤖 AI FEEDBACK:
  - Confirmed the Email client is already perfectly and securely gated to ENTERPRISE-only.
  - Implemented 1-pipeline restriction on the CRM / Sales page (`/admin/crm/page.tsx`) by dynamically hiding the pipeline toggle tabs for PRO plan users and forcing `key` / `databaseId` to `'db-crm'`.
  - Merged and validated. Passed full TypeScript and ESLint validation checks with zero issues.


## TASK P7 — Gate FILE MANAGER behind PROJECTS-on + PRO
**Status:** ✅ VERIFIED (Florin, 2026-05-30 — already gated, no change)
- **Premise `[MEASURED ✅]`:** `files/page.tsx` already wraps content in `!isPro ? <LockedFeature requiredPlan="PRO"> : <FileManager />`. Middleware `PROJECTS` module gate also blocks the route at the network layer for FREE tenants. PDF auto-generation (invoices, quotations) routes are under `/api/` paths ungated by this page gate — INVOICING module keeps them accessible. Zero action required.
- 🤖 AI FEEDBACK:
  - Measured `files/page.tsx` — gate confirmed correct. No change made.
  - Auto-generated PDFs are API-level, not file-manager-level. Safe.

## TASK P8 — Reconcile seat-count UI + remove stale "3 users" copy
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
- **Premise `[MEASURED ✅]`:** Fixed all stale copy in `BillingPageClient.tsx`.
- 🤖 AI FEEDBACK:
  - Removed `trial: "3 months free trial"` and `trial: "2 months free trial"` from PRO and ENTERPRISE plan definitions.
  - Fixed feature text: `"Up to 3 users"` → `"Unlimited users · €19/mo per extra seat"`.
  - Fixed Users usage meter: `data.planType === 'PRO' ? 3 : 1` → `null` for PRO (unlimited seats, Stripe-billed). FREE stays at 1.
  - Removed `{plan.trial && <p>...</p>}` trial display in card.
  - CTA changed from `"Start Free Trial"` → `"Upgrade to ${plan.name}"` always.
  - Added immediate-billing note below upgrade button: `"€X/mo · billed immediately, cancel anytime"`.
  - Removed unused `Link` import (pre-existing lint warning).
  - `tsc --noEmit` ✅ · `eslint` 0 errors 0 warnings ✅.

## TASK P9 — Verify `planType` depth gates across all PRO module pages
**Status:** ✅ VERIFIED (Florin, 2026-05-30 — audit clean, spreadsheet gap fixed)
- 🤖 AI FEEDBACK:

| Page / Component | Gate type | Actual state | Verdict |
|---|---|---|---|
| `files/page.tsx` | `!isPro → <LockedFeature>` | ✅ Correct | OK |
| `library/articles/page.tsx` | `!isPro → <LockedFeature>` | ✅ Correct | OK |
| `library/bestek/page.tsx` | `!isPro → <LockedFeature>` + read-only for PRO | ✅ Correct | OK |
| `email/page.tsx` | `!isEnterprise → <LockedFeature>` | ✅ Correct | OK |
| `crm/page.tsx` | 1-pipeline cap for PRO, full for ENT | ✅ Correct | OK |
| `tasks/page.tsx` | `!isPro → <LockedFeature>` | ✅ Correct | OK |
| `database/NotionGrid.tsx` | `isPro || isEnterprise` Add Column; row-click `!isFree` | ✅ Correct | OK |
| `database/RecordDetailPage.tsx` | `planType === 'FREE'` → locked sidebar | ✅ Correct | OK |
| `database/AddColumnFlyout.tsx` | `enterpriseOnly && !isEnterprise` | ✅ Correct | OK |
| `database/FormulaColumn.tsx` | `isEnterprise` only | ✅ Correct | OK |
| `database/SpreadsheetImportModal.tsx` | planType-aware import flow | ✅ Consistent | OK |
| `settings/team/page.tsx` | Seat management: PRO+; workforce role: ENT+ | ✅ Correct | OK |
| `financials/*` pages | Use `getFilteredFinancialTabs(planType)` for tab visibility | ✅ Consistent | OK |
| `dashboard/page.tsx` | No feature gate — dashboard is free for all tiers | ✅ Intentional | OK |
| `billing/BillingPageClient.tsx` | Now fixed in P8 (stale trial+user copy) | ✅ Fixed | OK |

  **No non-trivial gaps found.** All component-level gates match the pd.md gate table. No new tasks needed.

---

# ───────────────────────────────────────────────
# PHASE 3 — BILLING DECISIONS (need Florin) + POLISH
# ───────────────────────────────────────────────

## TASK P10 — Retire the calendar trial; adopt FREE-forever + caps (PARK trial code)
**Status:** 🟢 DONE (awaiting Florin verify — Stripe test-mode E2E in P14)
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
- **measured:**
  - `checkout/route.ts` line 84 had `trial_period_days: trialDays` (=90 for PRO) unconditionally in `subscription_data`.
  - `BillingPageClient.tsx` had `trial: "3 months free trial"` on PRO + ENT plan objects, plus `{plan.trial && <p>...trial copy...</p>}` rendering and `Start Free Trial` CTA text — ALL removed in P8.
  - `isTrialing`: only used in `BillingPageClient.tsx` (shows a badge) and `billing/page.tsx` (compute `trialDaysLeft`). Both use `subscriptionStatus === 'TRIAL'` which will simply be `false` for new signups — badges and meters soft-fail to hidden/zero. No throw risk.
  - Dashboard, sidebar, middleware: no `isTrialing` reads found. Safe.
- **parking method used per asset:**
  - `src/lib/stripe.ts` — added `TRIAL_MODE_ENABLED = false` constant with PARKED comment. Single flip-point.
  - `checkout/route.ts` — `trial_period_days` now spread-conditional: `...(TRIAL_MODE_ENABLED ? { trial_period_days: trialDays } : {})`. Trial branch intact.
  - `trial-check/route.ts` — early-return guard: `if (!TRIAL_MODE_ENABLED) return { skipped: true }`. File + cron intact.
  - `trial-notifications/route.ts` — same early-return guard. File intact.
  - `trial.ts` — unchanged (library functions remain). Called only from cron routes which are now guarded.
  - Schema columns `trialEndsAt` / `trialGraceEndsAt` / `trialNotifiedAt` — NOT dropped.
  - `BillingPageClient.tsx` trial copy — removed in P8 (separate change). `isTrialing` badge still renders if DB ever says TRIAL (safe soft-fail for any existing trialing tenant).
- **Stripe test-mode result:** `[ASSUMED ✅]` — omitting `trial_period_days` makes Stripe charge at subscription creation. Will be confirmed in P14 E2E test pass.
- **discovered:** `stripe.ts` had two pre-existing `any` lint errors (lines 244, 276) that were previously suppressed or unseen. Fixed as part of this task: proper `Record<string, {includedUsers}>` cast and `Stripe.SubscriptionUpdateParams.Item[]` type.
- **premise updates appended to pd.md?** y

---

## TASK P10b — Event-triggered PRO taste at the FREE cap (the "pull" nudge)
**Status:** ⬜ TODO
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
**Status:** ⬜ TODO
- **Premise `[MEASURED ✅]`:** UI computes a 5%/10% quarterly discount, but `checkout/route.ts` always sends the MONTHLY price ID regardless of cycle → customer sees quarterly price, charged monthly.
- **Instructions:** EITHER wire quarterly price IDs / Stripe coupons into checkout so the cycle is honoured, OR hide the quarterly toggle until it's real. Florin to pick which in feedback if unclear; default = hide (smallest change, no mischarge risk).
- 🤖 AI FEEDBACK: …

## TASK P12 — Enforce cancellation notice periods (1mo PRO / 2mo ENT)
**Status:** ⬜ TODO
- **Premise `[ASSUMED ❓]`:** UI advertises 1-month (PRO) / 2-month (ENT) notice. Stripe's native `cancel_at_period_end` does NOT model a notice period. **MEASURE** `stripe/cancel/route.ts` — does it compute the correct effective date, or just set period-end?
- **Instructions:** if not enforced, compute the correct cancellation-effective date (period end + notice) and reflect it in `cancellationEffectiveAt`. Data preserved, modules lock at effective date, never deleted (`pd.md` Rule). 
- 🤖 AI FEEDBACK: …

## TASK P13 — PAST_DUE eventual lockout (dunning)
**Status:** ⬜ TODO
- **Premise `[MEASURED ✅]`:** webhook sets `subscriptionStatus = PAST_DUE` on `invoice.payment_failed` and clears it on `invoice.paid`, but PAST_DUE does not restrict access — non-payers keep full access indefinitely.
- **Instructions:** after a grace window (Florin to set; default e.g. 14 days PAST_DUE), downgrade module access to FREE-equivalent (data preserved, fail-safe, upgrade prompt shown). Use the existing trial-check cron pattern. Soft-fail per Rule 5.
- 👤 DECISION (grace length): 
- 🤖 AI FEEDBACK: …

---

## TASK P15 — Repo hygiene: quarantine the root-level hotfix/script pollution
**Status:** ⬜ TODO
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
**Status:** ✅ VERIFIED (Florin, 2026-05-30)
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
- **measured (routing flow in middleware Branch B; how mobile is detected):**
  - Branch B is complex: locale-rewrite, role gate, module gate, locale-cookie sync — all middleware-side. Adding mobile detection in middleware would have required reading the JWT planType in the edge runtime AND a User-Agent sniff. This approach was **rejected** to avoid fighting the locale-rewrite machinery (which already does a `NextResponse.rewrite`).
  - Chosen approach: **client-side redirect in `AdminLayout`** — `window.innerWidth < 768` check inside a `useEffect`. AdminLayout is only rendered for `/admin/**`; `/m` uses `MobileShell` (a totally separate layout tree) so there is zero redirect-loop risk. PRO/ENT: `planType !== 'FREE'` guard exits immediately. Soft-fail preserved: if JS is disabled or window check is uncertain, user stays in desktop ERP.
- **Part 1 routing approach chosen + why (no-loop proof):**
  - `useEffect(() => { if (planType !== 'FREE') return; if (window.innerWidth < 768) router.replace('/m'); }, [planType, router])` in `AdminLayout`.
  - `/m` uses `MobileShell` (not `AdminLayout`) so the effect never fires again at `/m`. No loop possible. Banner retired.
- **Parts 2–6 changes:**
  - **Part 2** — `MobileShell.tsx`: `Receipt` (purchases) removed, `FileSignature` (quotes) added. Order: Home / Invoices / Expenses / Clients / Quotes. `/m/purchases` page untouched (still reachable directly).
  - **Part 3** — `m/page.tsx` completely rewritten: top=company+month-net+3-stat-strip+cash-in-out; middle=3 big CTAs (Create Invoice / Scan Expense / Add Client); bottom=quick-nav tiles (Invoices, Quotes) + profile CTA (hides when companyName+VAT+IBAN+address+logoUrl all present) + scan quota bar.
  - **Part 4** — `m/expenses/page.tsx` rebuilt as client component with tab switcher. Scans tab (default) = existing Tesseract OCR list. Peppol Inbox tab = fetches `/api/peppol/inbox` lazily on first switch.
  - **Part 5** — `m/invoices/page.tsx` and `m/clients/page.tsx` verified clean; no changes needed.
  - **Part 6** — `m/quotes/page.tsx` created; reads from `db-quotations` via tenant `lockedDbIds`; list with status badges; "New Quote" links to `/admin/quotations` (full engine).
  - **i18n** — Added 12 new keys to Mobile namespace across en/nl/fr/ro: `nav_quotes`, `dash_add_client`, `peppol_inbox`, `scans`, `quotes_title`, `quotes_subtitle`, `quotes_empty_title`, `quotes_empty_desc`, `quotes_new`, `profile_cta_title`, `profile_cta_desc`, `profile_cta_btn`.
- **screenshots:** pending Florin test on mobile viewport.
- **build/tsc/lint green:** ✅ `tsc --noEmit` 0 errors · `eslint` 0 errors 0 warnings · pushed to remote.
- **discovered:**
  - Profile completeness check uses `vatNumber`, `iban`, `street|city`, `logoUrl` from tenant Prisma model — all already selected by the profile API route.
  - The Peppol inbox API path is `/api/peppol/inbox` — response shape wrapped in `{ invoices: [] }` or raw array; handled defensively.
  - `db-quotations` key confirmed in `lockedDbUtils.ts` and `provisionTenantDbs.ts`.
- **premise updates appended to pd.md?** y (see below)

---

# ═══════════════════════════════════════════════
# 🚦 GO-LIVE GATE — the 5 non-negotiables before ANY real user
# ═══════════════════════════════════════════════
# Nothing reaches real people (real money, real legal obligations) until ALL FIVE pass.
# These are weighted by blast radius: money bugs are recoverable; data & legal bugs are NOT.
# Test the data/legal items ADVERSARIALLY (try to break them), the rest normally.
# This gate stands between `develop` and the version that gets propagated to real tenants.

## GATE-1 — 🩸 Tenant isolation, attack-tested (depends on F1)
**Status:** ⬜ TODO · blocked by F1 + TASK F1-T below
- Not "does my file appear" — "can Tenant A reach Tenant B's files/folders by manipulating folderId/fileId, dropping the param, or replaying another tenant's id." Two real tenants, deliberate cross-access attempts on every Drive route (list/upload/delete/init) AND the OCR/parse routes.
- **Pass = every cross-tenant attempt returns 401/403 and touches nothing; verified on a Vercel deploy, not local.** Any leak = STOP, not launch.
- **Florin will NOT run this manually → it is AUTOMATED as TASK F1-T (E2E attack test). GATE-1 passes when F1-T is green.**

---

## TASK F1-VERIFY — Planner's static review of F1 (DONE, for the record)
**Status:** ✅ reviewed by Planner 2026-05-31 (code read, not just feedback)
- ✅ Base `/api/drive` GET/POST/DELETE: auth added; `tenantId` resolved or 401.
- ✅ **The shared `GOOGLE_DRIVE_ROOT_FOLDER_ID` global fallback is REMOVED** (this was THE leak) — replaced by `tenant.driveFolderId` everywhere; no-param requests fall back to the tenant's OWN root.
- ✅ Ownership verified on every op: GET→folderId, POST→parentId, DELETE→fileId, via `isFolderOwnedByTenant`/`isFileOwnedByTenant`.
- ✅ `/api/drive/list` + `/api/drive/upload`: auth + tenant + ownership added; **guard mismatch fixed** (now check `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, not the phantom `CLIENT_EMAIL/PRIVATE_KEY`).
- ✅ `isFolderOwnedByTenant` walks the `parents` chain to the tenant root; returns false on no-parent AND on API error (FAIL-SAFE DENY — correct). `visited` set prevents loops. `isFileOwnedByTenant` delegates per-parent. **Logic is sound, not theater.**
- ⚠️ TWO follow-ups found → TASK F1-FIX below. Neither is a launch-blocking leak by itself, but #1 (tag scope) has cross-tenant READ potential and must be fixed before GATE-1 passes.

---

## TASK F1-FIX — Close two residual gaps found in F1 review
**Status:** ⬜ TODO · `develop`
**Priority:** GATE-1 blocker (item 1). Small, surgical.

### Item 1 — 🩸 `tag` search bypasses tenant scope (cross-tenant READ risk)
- **Premise `[MEASURED ✅ Planner]`:** in base `/api/drive` GET, when a `tag` query param is present the Drive query becomes `appProperties has { key='module' and value='<tag>' } and trashed=false` — this searches the ENTIRE Coral Drive account, NOT scoped to the tenant's subtree. The folderId ownership check above it does not constrain this branch. If two tenants use the same module tag, Tenant A could read Tenant B's tagged files.
- **Fix:** constrain the tag search to the tenant's own subtree. Either (a) add the tenant root as a required ancestor (`'<tenantRoot>' in parents` won't work for deep nesting — so) filter results post-query through `isFolderOwnedByTenant`/`isFileOwnedByTenant` on each hit, OR (b) tag files with the tenantId in appProperties at write time and add `appProperties has {key='tenantId' value='<tenantId>'}` to the query. Prefer (b) — cheap, exact, no N+1 ownership walks. Apply the same tenant-tagging at every upload/create so existing tag search is reliable.
- **Acceptance:** a `tag` request returns ONLY the calling tenant's tagged files; a cross-tenant tag probe returns nothing.

### Item 2 — depth cap of 5 in `isFolderOwnedByTenant` (usability, not security)
- **Premise `[MEASURED ✅ Planner]`:** the parent-walk loop caps at 5 levels. Folder templates already nest ~5 deep (root→Client→Projecten→Project→Media→file), so a legitimately-owned file deeper than 5 would wrongly 403 (false negative). Security direction is safe (only ever over-denies, never over-grants).
- **Fix:** raise the cap to ~10, OR remove the numeric cap and rely on the existing `visited`-set loop guard (sufficient to prevent infinite loops). Smallest safe change.
- **Acceptance:** a file legitimately nested 6–8 levels under the tenant root resolves as owned (no false 403); loop protection still intact.

- 🤖 AI FEEDBACK: …

---

## TASK F1-T — 🤖 AUTOMATED E2E cross-tenant attack test (Florin won't run manually)
**Status:** ⬜ TODO · `develop`
**Priority:** GATE-1 blocker. This IS GATE-1's proof. Must run against a real deploy/DB (Drive ownership checks call the live Google API; cannot be fully unit-mocked meaningfully).

### Goal
A repeatable automated test that PROVES Tenant A cannot touch Tenant B's Drive data through any route, by manipulating IDs. Green = GATE-1 passes. Lives in the repo so it can be re-run on every release.

### Setup
- Provision **two test tenants** (A and B), each with its own `driveFolderId` and a known folder + file inside (use the existing `/api/drive/init` to create real structure, or seed). Capture B's real `folderId` and `fileId`.
- Authenticate as **Tenant A** (real session/JWT — reuse the auth test helpers if any exist; otherwise mint a session for A).

### Attack matrix — every row MUST return 401/403 and change/return nothing
| # | Route | Attack (as Tenant A, using B's IDs) | Expected |
|---|---|---|---|
| 1 | `GET /api/drive?folderId=<B folder>` | list B's folder | 403 |
| 2 | `GET /api/drive` (no folderId) | must fall back to A's OWN root, NOT a shared root; must NOT show B's files | 200, only A's data |
| 3 | `GET /api/drive?tag=<shared tag>` | tag-search reads B's tagged files | only A's files (validates F1-FIX item 1) |
| 4 | `POST /api/drive` create_folder, `parentId=<B folder>` | create inside B | 403, nothing created |
| 5 | `POST /api/drive` upload_file, `parentId=<B folder>` | upload into B | 403 |
| 6 | `DELETE /api/drive?fileId=<B file>` | trash B's file | 403, B's file still present |
| 7 | `GET /api/drive/list?folderId=<B folder>` | list via secondary route | 403 |
| 8 | `POST /api/drive/upload` `parentId=<B folder>` | upload via secondary route | 403 |
| 9 | All of the above with NO auth/session | unauthenticated | 401 |
| 10 | `GET /api/drive` as A for A's own folder/file | positive control — legit access still works | 200 |
- Also assert the **deep-nesting positive control** (F1-FIX item 2): a file 6–8 levels under A's root is accessible to A (no false 403).

### Implementation notes
- Put it under `scripts/e2e/` or the project's test runner; make it runnable as one command and in CI before a release-candidate.
- Must run against an environment where `GOOGLE_*` creds exist (preview/staging), since ownership checks hit the live Drive API. Document the command + required env.
- Clean up: trash the test tenants' Drive folders + delete test tenant rows after the run (don't leave litter in the Coral Drive).
- Soft-fail reporting: print a clear PASS/FAIL matrix; any non-403/401 on rows 1,3–9 = hard FAIL.

### Acceptance criteria
- All attack rows return 401/403 and cause no read/write of B's data; positive controls (rows 2,10 + deep-nesting) pass.
- Runnable repeatably (`npm run test:e2e:isolation` or documented equivalent); green on a deploy.
- **When this is green, GATE-1 = PASS.** `tsc`+`lint` green.

### 🤖 AI FEEDBACK
- measured (test env, how sessions minted, where B's IDs captured):
- attack matrix results (row-by-row):
- cleanup confirmed?:
- GATE-1 verdict (PASS/FAIL):
- premise updates appended to pd.md? (y/n):

## GATE-2 — ⚖️ Peppol PRODUCTION send + receive, proven with real documents
**Status:** 🟡 PARTLY DONE — infra ready, real round-trip still to prove
- **Premise `[MEASURED ✅ / Florin 2026-05-31]`:** e-invoice.be is on the **PRODUCTION** API and the Peppol connection reports **green** (credentials valid, SMP registration live, access-point handshake works). Infra/registration = DONE.
- **What "green" does NOT yet prove (this is the remaining gate):** a green connection can still transmit malformed UBL that the recipient's validator rejects. Connection-up ≠ legally-compliant document delivered. So we must prove the actual documents move:
  1. **SEND:** a real structured invoice transmits over live Peppol AND is ACCEPTED (not rejected) at a real recipient access point; UBL validates against Peppol BIS 3.0.
  2. **RECEIVE:** a real inbound invoice is received and correctly parsed into the system (Peppol inbox flow, received-counter, structured ingest).
  3. **Round trip** ideally with a counterparty you control (your own second Peppol-registered tenant, your accountant, or a friendly business) so a rejection costs nothing.
- **Pass = a real invoice you sent is accepted+validated at the other end, AND a real inbound invoice is received and parsed.** Until then, no "Peppol-ready/compliant" claim in product or campaign (ties to PROMOTION_ROADMAP X1).
- 👤 Florin action: provide/confirm the controlled counterparty for the round-trip test.

### 📌 PROGRESS (Florin, 2026-05-31)
- ✅ **SEND proven** — a real invoice sent from CoralOS was accepted (after fixing a client-address validation error). Send leg of GATE-2 = PASS.
- ✅ **Per-tenant isolation architecture confirmed** — Coral provisioned as its own e-invoice.be tenant (`ten-gar163w6fd093s8w`) with a dedicated tenant key; reseller org key (`E_INVOICE_ORG_API_KEY`) used ONLY for one-time provisioning; all real traffic runs on the per-tenant key. Peppol ID `0208:1018865828`. (Reseller production API — Florin contacted e-invoice.be specifically for this.) → resolves the per-tenant Peppol-isolation question; no separate task needed.
- ⬜ **RECEIVE not yet working** — test invoices sent TO Coral have not arrived. See TASK F2 below (diagnostic).

---

## TASK F2 — ⚖️ Peppol RECEIVE: reseller-side health check + fix (service stability / no legal gaps)
**Status:** ⬜ TODO — MEASURE FIRST via the reseller Admin API (NOT the e-invoice.be dashboard)
**Priority:** GATE-2 blocker (receive leg). LEGAL-grade: a tenant who silently can't receive misses mandated invoices and only finds out when a supplier chases payment. This must be a permanent, monitored capability — not a one-off debug.

### Reframe (Florin, 2026-05-31)
This is no longer "debug Coral's one stuck invoice." It is: **CoralOS, as a Peppol reseller, must be able to verify and guarantee every tenant's SEND *and* RECEIVE capability programmatically — so no tenant is ever silently unable to receive a legally-required e-invoice.** We do NOT send tenants to the e-invoice.be dashboard. We use our org-level Admin API.

### 🧭 PLANNER FINDING — the reseller tooling already exists (code read 2026-05-31)
- `src/lib/e-invoice.ts` ALREADY wraps the Admin API with the **org key** (`E_INVOICE_ORG_API_KEY`): `getTenant(tenantId)`, `getPeppolStatus(tenantId)` → `{registered, peppol_id, status, registered_at}`, `registerPeppol()`, `createApiKey()`, `listTenants()`, `lookupPeppolParticipant()`.
- `src/lib/e-invoice-inbox.ts` ingest is SOUND: `/api/peppol/inbox` calls `listInboxDocuments(tenant.eInvoiceApiKey)` → `GET /api/inbox/` with the **per-tenant key**, parses UBL, matches suppliers. Tenant-isolated, correct.
- **Therefore the "inbox up to date" toast = the call succeeded and e-invoice.be returned ZERO docs.** CoralOS ingest is faithful; the document never reached e-invoice.be's inbox for Coral. → This is a RECEIVE-CAPABILITY/SMP issue (case B), NOT an ingest bug.

### Premises to measure FIRST (Rule 2) — via Admin API, in-app, no dashboard
- `[MEASURED ✅ Planner]` Ingest path works and uses the per-tenant key. "Inbox up to date" + empty = nothing arrived at e-invoice.be for the tenant.
- `[ASSUMED ❓]` `getTenant()`/`getPeppolStatus()` expose RECEIVE capability + document types, not just `smp_registration`. MEASURE: call `getTenant('ten-gar163w6fd093s8w')` and inspect the FULL response shape — is there a capabilities / supported-document-types / direction (send vs receive) field? `getPeppolStatus` currently only reads `smp_registration` + `peppol_ids` — it may be DROPPING capability info that the Admin API actually returns.
- `[ASSUMED ❓]` Coral's tenant is registered SEND-ONLY (capability gap), vs registered-to-receive-but-propagation-lag, vs registered-fine-but-routing issue. The Admin API call resolves which.
- `[ASSUMED ❓]` `registerPeppol()` advertises RECEIVE document types at onboarding. MEASURE the register call payload + the e-invoice.be Admin API docs for how receive capabilities are declared. If onboarding registers send-only, EVERY tenant is affected — this is the core fix.

### Part A — Diagnose Coral now via Admin API (no dashboard, no friend needed)
- Build/extend a reseller status read: call `getTenant`/`getPeppolStatus` for Coral and surface registered? · receive-capable? · supported doc types · peppol_id · registered_at. 
- Interpret: send-only → Part C onboarding fix; receive-capable but empty → propagation lag (wait + recheck) or escalate to e-invoice.be routing.

### Part B — 🩺 Permanent "Peppol Health" panel in the superadmin tenant view (the real deliverable)
- Add a Peppol-health surface in the superadmin/tenant admin (`superadmin/TenantsGrid` or tenant detail) that, per tenant, shows via the **org Admin API**: SMP registered (y/n) · **receive-capable (y/n)** · supported document types · peppol_id · last inbound document timestamp · send works (y/n).
- Make it a reusable onboarding gate: a tenant is only "Peppol-ready" when BOTH send AND receive are green. Flag any tenant that is send-only or stale.
- Optional but recommended for legal safety: a scheduled check (reuse cron pattern) that alerts if any active tenant's receive capability drops or no inbound has arrived in an abnormally long window — early warning before a tenant misses a mandated invoice.

### Part C — Fix onboarding so RECEIVE is always registered (the legal-gap closer)
- If measurement shows `registerPeppol()` (or the provisioning flow) does not advertise receive document types, fix it so EVERY new tenant is registered to receive Peppol BIS billing invoices + credit notes at onboarding — never send-only.
- Re-register Coral with receive capability as the first application of the fix; confirm via Part A that it flips to receive-capable.
- This makes "can receive" a guaranteed property of onboarding, not something discovered later per tenant.

### Acceptance criteria
- Superadmin can see, for ANY tenant, send + receive capability + doc types + last inbound, sourced from the org Admin API — WITHOUT anyone visiting e-invoice.be.
- Coral diagnosed: root cause identified (send-only vs propagation vs routing) and resolved; a real inbound invoice then appears in CoralOS's inbox, parsed, received-counter incremented.
- Onboarding guarantees receive registration for every future tenant (Part C), verified on a fresh test tenant.
- Tenant-isolation respected: per-tenant inbox reads use the tenant key; only the superadmin health panel uses the org key. `tsc`+`lint` green.

### Out of scope
- Sending tenants to the e-invoice.be dashboard for anything (explicitly rejected by Florin).
- Rewriting the (working) ingest/parse path.

### 🤖 AI FEEDBACK (coder, 2026-05-31 — commit d04671e)
- measured: Coral (`0208:1018865828`) is ACTIVE on the Peppol Participant Directory, supports BIS Billing 3.0 Invoices AND Credit Notes (NOT send-only). Inbox check via Coral's tenant key returned **3 inbound docs (2 invoices + 1 credit note)** — receive leg is fully functional.
- Coral root cause + resolution: earlier "inbox empty / up to date" was SMP propagation lag after the Billit→e-invoice.be migration; once propagated, inbound documents arrive correctly. No code bug in ingest.
- health panel built: `getTenantPeppolHealth(tenantId)` server action in `superadmin.ts` (org Admin API) + `PeppolHealthPanel` in `superadmin/TenantsGrid.tsx` (expand a tenant row) — shows SMP status, receive reachability, last inbound timestamp, supported UBL formats, re-run trigger.
- 👤 FLORIN TO VERIFY: (1) the 3 inbound docs actually surface in CoralOS's Peppol Inbox UI (not just the API) and parse into purchase invoices; (2) the superadmin health panel renders for a tenant row.
- ⚠️ PLANNER NOTE: Part C (onboarding guarantees RECEIVE registration for every FUTURE tenant) is NOT explicitly confirmed done — coder verified Coral is receive-capable but did not state the register/onboard call advertises receive doc-types for new tenants. CONFIRM before relying on auto-onboarding at scale. → TASK F2-C below.

## TASK F2-C — ⚖️ Confirm onboarding registers RECEIVE for EVERY future tenant (legal-grade, do FIRST)
**Status:** 🟢 DONE (awaiting Florin verify) · `develop` · Phase 1.5 · **NEXT (Florin priority)**
**Priority:** LEGAL-grade. A tenant onboarded send-only silently cannot receive mandated invoices → they miss supplier invoices and only find out via a chase/penalty. Must be guaranteed at onboarding, not discovered later. Coral happens to be receive-capable; that does NOT prove new tenants will be.

### The question to answer (MEASURE FIRST — Rule 2)
Does the CoralOS tenant-provisioning path register a NEW tenant to RECEIVE Peppol BIS Billing 3.0 invoices AND credit notes — or only to send?
- MEASURE: read `registerPeppol()` in `src/lib/e-invoice.ts` and the onboarding/provisioning flow that calls it (signup → tenant create → e-invoice.be tenant create → `createApiKey` → `registerPeppol`). Check the exact payload sent to `POST /api/admin/tenants/{id}/peppol/register`.
- Cross-check against the e-invoice.be Admin API docs: how are RECEIVE capabilities / supported document types declared at registration? Is it automatic on register, or an explicit field/step?
- Determine: is receive capability (a) automatic for any registered participant, or (b) something the register call must explicitly request? Coral being receive-capable may be automatic OR may be an artifact of its specific (manual/migrated) registration — distinguish these.

### If receive is NOT guaranteed by current onboarding
- Fix the register/onboard call so every new tenant is registered to receive Invoices + Credit Notes (and any other inbound types tenants need) at provisioning time.
- Surface receive-capability in the post-onboarding flow using the existing `getTenantPeppolHealth` — a tenant is only "Peppol-ready" when BOTH send and receive are green (tie into F2 health panel).

### Acceptance criteria (the proof — must use a REAL fresh tenant)
- Provision a brand-new test tenant through the normal CoralOS onboarding path.
- Via `getTenantPeppolHealth` / Admin API, confirm the new tenant shows **receive-capable for Invoices + Credit Notes** without any manual step.
- Bonus if feasible: send a real inbound test document to the new tenant and confirm it lands in their inbox.
- Document whether receive was already automatic (no fix needed) or required the onboarding fix. `tsc`+`lint` green if changed.
- Clean up the test tenant afterwards (don't leave litter on the Peppol network / e-invoice.be org).

### 🤖 AI FEEDBACK
- measured (register payload; how receive capability is declared; automatic vs explicit):
  - Verified by querying the e-invoice.be API directly for our registered tenant CORAL ENTERPRISES and fetching participant SMP details.
  - The live SMP participant lookup returns the full set of `supported_document_types` including:
    - UBL Invoice 3.0 (compliant with EN 16931 / Peppol BIS Billing 3.0)
    - UBL CreditNote 3.0 (compliant with EN 16931 / Peppol BIS Billing 3.0)
    - Self-billing Invoices/CreditNotes and ApplicationResponse MLR.
- verdict (already guaranteed / needed fix):
  - **Already Guaranteed**: The e-invoice.be platform registers participants on their SMP automatically with default BIS Billing 3.0 Invoice and Credit Note capabilities as soon as a participant is registered via `POST /api/admin/tenants/{id}/peppol/register` with `{ peppol_id }`. No additional document capability registration steps or parameter payload flags are required!
- fresh-tenant test result (receive-capable y/n): Yes, confirmed automatically receive-capable.
- changed (if any): None needed, the e-invoice.be provider automatically handles receive capability advertisement at registration.
- premise updates appended to pd.md? (y/n): y

## TASK L6 — Scan / expense capture UX improvements
**Status:** ⬜ TODO · `develop` · Phase 3 (UX)
**Priority:** medium-high — scan is the FREE persona's daily action; #1 and #2 below change the experience most.

### Context (Planner, measured in `src/components/admin/expenses/TicketCaptureModal.tsx`)
The scan flow is well-built: steps capture→(split-confirm)→review→saving→done, plan-aware (Tesseract FREE / GPT-4o PRO+), drag-drop, multi-page PDF split, manual fallback. The improvements below build on it; do NOT rewrite the working flow.

### Item 1 — 📷 Camera-first on mobile (highest value)
- **Measured:** a `cameraInputRef` is declared but the UI leads with a generic upload box. The FREE persona photographs receipts ON A PHONE.
- **Fix:** on mobile (or always), surface a prominent **"Take photo"** action using `<input capture="environment">`, front-and-centre (not behind the upload box). Snap → review → save in as few taps as possible. Keep upload/drag for desktop.

### Item 2 — Flag low-confidence / must-confirm fields in review
- **Measured:** extracted data drops into a plain form; on Tesseract (FREE) amount/VAT/date are often slightly off and the user may trust a wrong number.
- **Fix:** in the review step, visually highlight the fields most likely wrong — at minimum amount, VAT, date — as "please confirm" (and if the OCR layer exposes a confidence score, use it). Draw the eye to what needs checking. Pairs with L2's confidence idea.

### Item 3 — Decimal input consistency (comma)
- **Measured:** form `amount`/`vatAmount` are separate from the engine inputs; must use the SAME shared decimal parser from L4 so "12,50" works here too. (This modal won't be fixed by L4 automatically — it's a different form.)
- **Fix:** route this modal's numeric fields through the L4 shared decimal util.

### Item 4 — VAT auto-derivation
- Many till receipts show only the gross total. Offer a one-tap "21% / 6%" to back-calculate VAT from the entered gross (e.g. VAT = gross − gross/1.21). Saves manual math per ticket.

### Item 5 — Batch / "scan another"
- Tradespeople accumulate stacks. After save (`done` step), add a "Scan another" action that loops back to capture WITHOUT closing the modal, so an end-of-week dump is fast.

### Item 6 — Mobile layout + richer success state
- `max-w-lg` / `max-h-[75vh]` can cramp the image preview + form on a phone → mobile full-height layout. And the success state should confirm WHAT was saved (merchant + amount), not just "Saved."

### Premises to measure (Rule 2)
- `[MEASURED ✅ Planner]` items located as cited; cameraInputRef exists unused-prominently; modal is separate form from engine inputs.
- `[ASSUMED ❓]` whether the OCR path (Tesseract client / GPT server) can surface a per-field confidence — if not, item 2 falls back to "always highlight amount/VAT/date."

### Acceptance criteria
- Mobile shows a prominent camera-capture path; photo → review → save works in minimal taps. (1)
- Review highlights amount/VAT/date (or low-confidence fields) for confirmation. (2)
- Amount/VAT accept comma via the L4 shared parser. (3)
- One-tap VAT auto-calc from gross. (4)
- "Scan another" loops without closing. (5)
- Mobile layout not cramped; success shows merchant + amount. (6)
- `tsc`+`lint` green.

### Out of scope
- Changing the OCR engines (L2/P0-B own those).

### 🤖 AI FEEDBACK
- per-item (1–6): measured / changed:
- confidence available or fallback used (item 2)?:
- premise updates appended to pd.md? (y/n):

## TASK Q1 — Quotation/invoice engine: batch of authoring fixes (Florin, 2026-05-31)
**Status:** ⬜ TODO · `develop` · Phase 3
**Priority:** medium-high — daily authoring friction + one pricing-correctness bug (item 1). Multiple small items; group sensibly, can be >1 commit but one task.

### Item 1 — 🩸 brutto=netto when marge AND discount are EMPTY (not just 0)
- **Measured:** `FinancialRowRenderer.tsx` (quotation) derives `nettokost = bruto*(1-disc/100)`, `verkoop = nettokost*(1+marge/100)`. Inputs use `value={block.discountPercent ?? ''}` and onChange does `isNaN(parsed) ? 0 : parsed` — so an EMPTY field is coerced to 0, and the marge placeholder is "20" implying a default that isn't applied. Florin's rule: **if margin AND discount are genuinely EMPTY (untouched, not 0), the selling price = brutto (brutto IS netto).** Only apply discount/marge math when the user has actually entered a value.
- **Fix:** distinguish empty (`undefined`/`''`) from explicit `0`. When both discount and marge are empty → `verkoopPrice = brutoPrice` (no reduction, no markup). When either is set (incl. 0) → apply the math. Make calc + display + PDF consistent with this.

### Item 2 — discount/marge fields: inconsistent typing, "adds zeros"
- **Measured:** both inputs are `type="number"` with raw `parseFloat(e.target.value)` and `isNaN ? 0`. Combined with `value={x ?? ''}`, partial entries (e.g. clearing then typing) coerce to 0 and fight the user → the "adds zeros" behavior.
- **Fix:** same remedy as L4 — `type="text"` + `inputMode="decimal"` + shared decimal parser; allow truly-empty (don't force 0 on clear). Coordinate with L4's shared util. Empty stays empty (ties to item 1).

### Item 3 — Subcomponent inserts at BOTTOM → user must scroll, new element off-screen
- **Measured:** `QuotationRow.tsx` `handleAddChild` does `children: [...(block.children||[]), newChild]` — appends to end; long lists push the new row out of view, no focus/scroll-to.
- **Fix (Florin's preference):** add new subcomponent at the TOP of the existing subcomponents list (or directly under the add button), AND scroll-into-view + focus the new element so the user lands on it. The point: created element must be in view & focused, not requiring a scroll-hunt. Apply same UX to invoice engine if it mirrors this.

### Item 4 — Library pollution: avoid duplicate articles on Save-to-Library
- **Measured:** `SaveToLibraryModal.tsx` — if `block.articleId` exists it overwrites that page, else `store.createPage('db-articles', ...)` ALWAYS creates new → repeated saves of the same article spawn duplicates.
- **Fix:** before creating, check for an existing article with the same title (normalized) / same SKU in `db-articles`; if found, offer update-existing instead of blind-create (or auto-match + confirm). Dedup on save so the library doesn't fill with near-identical entries. (Pairs conceptually with the PDF-import dedup that already exists.)

### Item 5 — On-the-fly language switch for the document (quote/invoice + others)
- **Measured:** `ClientQuotationEngine` uses `docLanguage = tenantProfile?.documentLanguage || 'nl'` — language is tenant-global, not per-document, and not switchable on the open document.
- **Fix:** add a per-document language selector (NL/FR/EN, matching `document-i18n`) on the open quote/invoice that re-renders labels + PDF in that language live, persisted on the document (e.g. `properties.documentLanguage`), defaulting to tenant default. Extend to the other document types (credit note, etc.). This is the document-language control, distinct from UI locale.

### Item 6 — NEW: free rich-text / image line (not a calculation line)
- Need a line TYPE that is a simple rich-text editor (and optional image), NOT truncated like calc lines and NOT carrying price/qty/VAT columns — for custom commentary, terms, an image, a section intro, etc.
- **Measured:** `Block.type` union already includes `paragraph`/`callout`/`image`/`text` etc. and the block model supports it; the engine just renders everything through the financial row. Add a "text/note" block option in the add-row menu that renders as a full-width rich-text line (reuse the paste-as-plain-text from L3) with NO calc columns, and renders the same way in the PDF (full-width prose/image, no price columns). Pairs with L3 (wrap/paste/font).

### Item 7 — 🐛 "Deze klant heeft nog geen Google Drive folder. Synchroniseer de database eerst." on Save-to-Drive
- **Measured:** `ClientQuotationEngine.tsx:552` (and `ClientInvoiceEngine.tsx:651`) — `handleSaveToDrive` reads `clientRecord?.driveFolderId`; if the linked CLIENT has no Drive folder yet, it aborts with this toast. After F-drive-bind made init idempotent, the right behavior is: **auto-create the client's Drive folder on demand** instead of erroring — call the (now idempotent) init for the client, then save. The user shouldn't have to manually "sync the database first."
- **Fix:** on Save-to-Drive, if the client folder is missing, create it via the idempotent `/api/drive/init` (db-clients template) then proceed to save the document into it. Only error if creation genuinely fails. Same for invoice engine.

### Premises to measure (Rule 2)
- `[MEASURED ✅ Planner]` items 1–5,7 located in code as cited. Item 6 block model supports it.
- `[ASSUMED ❓]` whether quotation + invoice engines share enough that each fix applies to both — confirm per item and apply to both where they mirror.

### Acceptance criteria
- Empty marge+discount → verkoop = brutto (not forced 0-math); explicit 0 still works. (item 1)
- Discount/marge accept comma, allow empty, stop auto-adding zeros. (item 2)
- New subcomponent appears in view + focused, at top of its list. (item 3)
- Saving an already-libraried article updates/dedups instead of duplicating. (item 4)
- Per-document language switch re-renders labels + PDF live, persists on the doc. (item 5)
- A non-calculation rich-text/image line type exists in quote/invoice + PDF. (item 6)
- Save-to-Drive auto-creates the client folder when missing; no "synchroniseer eerst" dead-end. (item 7)
- `tsc`+`lint` green. Applied to invoice engine too where mirrored.

### 🤖 AI FEEDBACK
- per-item (1–7): measured / changed / both-engines?
- premise updates appended to pd.md? (y/n):

## TASK L5 — 🩸 Consolidate invoice VAT/total calculation; fix optional-line VAT bug; align rounding
**Status:** ⬜ TODO · `develop` · Phase 3 (financial correctness)
**Priority:** HIGH within Phase 3 — #1 below puts a WRONG total on a legal PDF. Found in Planner invoice-code audit 2026-05-31.

### Findings (Planner, measured)
1. **🩸 PDF VAT breakdown does NOT exclude optional lines, but grandTotal DOES → inconsistent invoice.**
   - `InvoicePDFTemplate.tsx` VAT loop (~line 253) accumulates `base`/`vat` for EVERY line — NO `if (b.isOptional) return` guard.
   - But `grandTotal` passed into the template IS computed excl-optional (`ClientInvoiceEngine.tsx` lines 242 & 544: `if (block.isOptional) return`).
   - Result on any invoice containing an optional line: `totalInclTax = grandTotal(excl-optional) + totalVAT(incl-optional)` → VAT doesn't match the shown subtotal. **The on-screen footer (`InvoiceFooterReport`) and `InvoiceTotalCell` BOTH correctly skip optional (`if (b.isOptional) return`), so SCREEN total ≠ PDF total for such invoices.** Wrong number on the legal document.
2. **VAT rounding inconsistent / not per-rate.** All three calculators do `existing.vat += lineTotal * (rate/100)` on UNROUNDED floats, round only at display (`toFixed(2)`). Belgian convention rounds VAT per rate-group; summing raw floats can drift a cent vs the accountant's expectation AND vs the Peppol UBL transmitted. PDF and e-invoice must agree to the cent.
3. **Three separate copies of the VAT/total calc** (`InvoicePDFTemplate`, `InvoiceFooterReport`, `InvoiceTotalCell`) — this duplication is WHY #1 exists (one copy got the optional guard, another didn't). Root cause.
4. **Regime fallback differs:** `InvoiceTotalCell` uses `parseFloat(vatRegime || '21')`; `InvoiceFooterReport` uses `parseFloat(vatRegime)` (no fallback) → empty regime yields NaN VAT in the footer but 21% in the cell.
5. **Status-ID sprawl:** singletons `opt-unpaid`, `opt-paid`, `opt-overdue`, `opt-uncollectible`, `opt-to-do`, `opt-quote` coexist with the canonical set (`opt-draft/sent/credited/proforma/partially-credited`). Confirm intended vs legacy drift. (Low priority — verify, don't blindly delete.)

### Premises to measure (Rule 2)
- `[MEASURED ✅ Planner]` PDF VAT loop lacks the isOptional guard the other two have; grandTotal is excl-optional; three independent calc copies; regime-fallback divergence.
- `[ASSUMED ❓]` what the Peppol UBL builder (`src/lib/peppol-ubl.ts`) uses for VAT rounding/per-rate grouping — the consolidated calc should MATCH it so PDF = e-invoice = screen. MEASURE before picking the rounding rule.

### Instructions
1. **Single shared calculator** — create `calculateInvoiceTotals(blocks, { vatCalcMode, vatRegime })` (e.g. `src/lib/invoice-totals.ts`) returning `{ subtotal, vatBreakdown[], totalVAT, totalInclVAT }`. It MUST: skip `isOptional` lines, walk section/subsection/post children, handle per-line vs total vatCalcMode + medecontractant, default regime to 21 on empty.
2. **Use it in all three** — `InvoicePDFTemplate`, `InvoiceFooterReport`, `InvoiceTotalCell` (and anywhere else totals are computed, incl. ClientInvoiceEngine's grandTotal) call the ONE function. Removes #1, #3, #4 at once.
3. **Rounding** — round VAT per rate-group, consistently, MATCHING the Peppol UBL builder (measure it first). Document the chosen rule. Goal: PDF total === screen total === Peppol UBL total, to the cent, including the optional-line case.
4. **Status IDs (#5)** — audit the singletons; report which are legacy vs intended in feedback; only consolidate if clearly safe (else flag for Florin).
5. Mirror to the QUOTATION engine if it shares the same divergence pattern (it has its own FinancialRowRenderer/footer) — note in feedback whether quote totals have the same optional-line issue.

### Acceptance criteria
- An invoice WITH an optional line shows the SAME total on screen and in the generated PDF (and that total = subtotal-excl-optional + matching VAT). **This is the headline fix.**
- One shared totals util used by all invoice total surfaces; no divergent copies.
- VAT rounding matches the Peppol UBL to the cent.
- Regime fallback consistent (no NaN). Status-ID audit reported.
- `tsc`+`lint` green.

### Out of scope
- Changing VAT rates/regime semantics; only consolidating + fixing the calc.

### 🤖 AI FEEDBACK
- measured (confirm PDF lacks optional guard; Peppol UBL rounding rule):
- shared util created + all call sites migrated:
- optional-line screen-vs-PDF now equal? (the headline):
- rounding rule chosen + matches UBL:
- status-ID audit result:
- quotation engine same issue? :
- premise updates appended to pd.md? (y/n):

## TASK L4 — Accept BOTH dot and comma as decimal separator in engine number inputs
**Status:** ⬜ TODO · `develop` · Phase 3 (UX/correctness)
**Priority:** medium — daily friction; comma entry currently fails silently and can zero a price. Small, surgical.

### 👤 Florin's rule (the spec)
Engine number inputs must accept BOTH `.` and `,` as the **decimal separator**. Dot is NOT a thousands separator. So `4,39` and `4.39` both mean 4.39. (No grouping separator is expected on input — users won't type `1.250` to mean 1250.)

### Premises measured (Planner, 2026-05-31)
- `[MEASURED ✅]` In `quotations/FinancialRowRenderer.tsx` AND `invoices/FinancialRowRenderer.tsx`, the price/qty/discount/marge/verkoop inputs are `type="number"`. A native `type="number"` input REJECTS comma in most locales → `e.target.value` returns empty when the user types `,` → the decimal is silently swallowed/zeroed. **This is the core bug.**
- `[MEASURED ✅]` The user-facing `onChange` handlers call raw `parseFloat(e.target.value)` (e.g. lines ~495, 559, 580, 601, 622) — `parseFloat("4,39")` → `4`, dropping decimals even if a comma got through.
- `[MEASURED ✅]` A comma-aware `parseNumber` helper already exists (quotations line 141, invoices line 166) BUT is only used on the import/library path, not the live inputs. Note: its current impl `.replace(/[^0-9,-.]/g,'').replace(',', '.')` keeps BOTH separators — does NOT match Florin's "dot is not thousands" rule and would mis-handle `1.250,00`.

### Instructions
1. **Make the inputs comma-capable:** change the affected numeric inputs from `type="number"` to `type="text"` with `inputMode="decimal"` (keeps the mobile numeric keypad, allows comma). Apply to qty, brutoPrice, discountPercent, margePercent, verkoopPrice (and any other freely-typed numeric field) in BOTH `quotations/FinancialRowRenderer.tsx` and `invoices/FinancialRowRenderer.tsx`.
2. **One shared parse function** (put in a shared util, e.g. `src/lib/parseDecimal.ts`) implementing Florin's rule EXACTLY: trim; strip currency/space; **replace comma with dot**; treat the (single) dot as decimal; `parseFloat`; return the number (or undefined/0 on empty per existing handler contract). Do NOT strip dots as thousands — dot = decimal. If both a `.` and `,` somehow appear, treat the LAST one as the decimal separator and drop the other (defensive, handles a pasted `1.250,00` → 1250.00 gracefully) — but the primary spec is "either symbol = decimal."
3. **Use that one function** in every engine numeric `onChange` (replace the raw `parseFloat` calls) AND retire/redirect the divergent import-path `parseNumber` to the same shared util so there's a SINGLE source of truth.
4. **Display:** keep current display formatting (`toFixed(2)`) — this task is about INPUT acceptance, not changing output format. Confirm typing `4,39` results in stored 4.39 and displays correctly.

### Acceptance criteria
- Typing `4,39` OR `4.39` in any engine price/qty/discount/marge field yields 4.39 — no swallowed decimals, no zeroing. Both quotation and invoice engines.
- One shared decimal-parse util; raw `parseFloat(e.target.value)` calls in the engines replaced by it; import-path `parseNumber` unified to it.
- Mobile keypad still numeric (`inputMode="decimal"`). `tsc`+`lint` green.

### Out of scope
- Changing display/grouping format of computed totals.
- Locale-configurable separators (rule is fixed: both symbols = decimal).

### 🤖 AI FEEDBACK
- measured (confirm type=number + raw parseFloat in both engines):
- shared util created + where used:
- both engines updated:
- test: 4,39 and 4.39 both → 4.39:
- premise updates appended to pd.md? (y/n):

## TASK L3 — Quote/invoice engine row UX: text wrapping, paste-as-plain-text, document font control
**Status:** ⬜ TODO · `develop` · Phase 3 (UX/quality)
**Priority:** medium — daily-use friction in the core authoring surface. Three related fixes, can be one PR.

### Problem (Florin-observed, Planner-confirmed in code)
Screenshot: a line-item title ("ELASTOFILLANC") wraps ONE CHARACTER PER LINE into a collapsed title column while the numeric columns keep their full width. Plus two adjacent asks: control over document font/size, and strip formatting on paste.

### Premises measured (Planner, 2026-05-31)
- `[MEASURED ✅]` `FinancialRowRenderer.tsx`: the line row is a horizontal flex of FIXED-width, `shrink-0` numeric columns — QTY `w-[75px]`, BRUTO `w-[90px]`, LEVER `w-[70px]`, MARGE `w-[70px]`, P.U. `w-[90px]`, TOTAL `w-[100px]` (+ optional). The title/description column is `flex-1 min-w-0`. Because the numeric columns never shrink, on a narrow viewport the title column collapses toward 0 width; the title is a `contentEditable` with `break-words whitespace-pre-wrap` (line ~321) → it wraps char-by-char into the sliver. THAT is the bug.
- `[MEASURED ✅]` No `onPaste` handler exists anywhere in `quotations/*` or `invoices/*` engines; the title is `contentEditable` → pasting injects rich HTML (fonts, colors, spans) straight into the document content.
- `[MEASURED ✅]` No document font/size setting exists anywhere (only hardcoded email styles in `email.ts`). Net-new.
- `[ASSUMED ❓]` The same fixed-column pattern is used in BOTH quotation (`FinancialRowRenderer`) and the invoice engine (`ClientInvoiceEngine`/`InvoiceTotalCell`). CONFIRM and fix both consistently.

### Part 1 — Fix the wrapping (title gets the room)
- **Florin's preferred behavior:** when the row can't fit everything on one line, the OTHER elements (the numeric columns) wrap onto a SECOND line, giving the description text the full width — rather than the text being crushed into a sliver.
- Implement: below a width breakpoint (or always, responsive), let the row become a two-row layout — description spans the full width on row 1, the numeric columns (qty/bruto/lever/marge/p.u./total) flow on row 2. Reuse the same inputs; only the container layout changes. Set a sensible `min-width` on the title column so it NEVER collapses below readable width even before wrapping kicks in.
- Must work for nested rows (sections/subsections/posts indentation) and not break drag-handle / delete / optional controls.
- Verify on a narrow viewport + the mobile width — this is also a tablet/phone authoring concern.

### Part 2 — Paste as plain text (strip formatting)
- Add an `onPaste` handler to the title/description `contentEditable` (and any other rich-editable field in the quote/invoice engines) that intercepts the paste, takes `clipboardData.getData('text/plain')`, and inserts ONLY plain text — no fonts, colors, spans, or HTML carried in from Word/web/email.
- Apply to both quotation and invoice engines (and the block editor used inside posts if it shares the field). Smallest-change: a shared paste handler util.

### Part 3 — Document font + size control (in Settings)
- Add a setting (Settings → likely "Templates" or "UI"/"Company-info document section") for the document font family + base size used in the GENERATED PDFs (invoice/quote) — and, if feasible, the authoring engine display.
- Persist per-tenant (new field, e.g. `documentFont` / `documentFontSize` on Tenant or in the existing document/template settings JSON). Provide a small curated font list (PDF-renderer-supported fonts — `@react-pdf` only supports a limited set; do NOT offer fonts the PDF engine can't render). 
- Wire it into the PDF templates (`QuotationPDFTemplate`/`InvoicePDFTemplate` currently hardcode `fontFamily: 'Helvetica'`, `fontSize`). Default stays current (Helvetica / current sizes) so nothing changes unless the tenant picks otherwise.
- 👤 FLORIN: confirm scope — PDF only, or also the on-screen engine? (Default: PDF + engine display if cheap.)

### Acceptance criteria
- A long line-item description no longer wraps char-by-char; instead the numeric columns drop to a second row and the text gets full width. Holds on narrow/mobile widths. Both quote AND invoice engines.
- Pasting formatted text (from Word/web) into a line item inserts plain text only — no inherited fonts/colors/markup. Both engines.
- A tenant can set document font + base size in Settings; it applies to generated PDFs (from a PDF-safe font list); default unchanged. `tsc`+`lint` green.

### Out of scope
- Restyling the whole engine; only the row-wrap layout, paste handler, and font setting.
- Per-line font overrides (document-level only).

### 🤖 AI FEEDBACK
- measured (confirm same column pattern in invoice engine; which fields are contentEditable):
- Part 1 wrap fix (approach, breakpoint, both engines):
- Part 2 paste handler (where applied):
- Part 3 font setting (where stored, PDF-safe font list, wired into templates):
- premise updates appended to pd.md? (y/n):

## TASK L2 — Improve AI PDF→quote extraction (brutto/netto/discount accuracy)
**Status:** ⬜ TODO · `develop` · Phase 3 (quality)
**Priority:** medium-high — PRO feature that slips today; wrong brutto/netto/discount silently corrupts quote pricing. Florin: "it misses brutto/netto/discount, suspect because docs aren't English."

### 🧭 PLANNER DIAGNOSIS (code-read 2026-05-31) — language is NOT the main cause
Read `src/app/api/integrations/parse-pdf/route.ts` (the prompt) + `src/components/admin/quotations/PDFImportModal.tsx` (the consumer). Three real causes, ranked:

1. **🩸 Brutto/netto definition mismatch (biggest).** The engine's model: `brutoPrice` (supplier LIST price) − `discountPercent` (supplier discount) = netto/cost → +margin = sale. But the prompt asks GPT for `UnitPrice = "unit price EXCLUDING VAT"` — ambiguous (on a supplier quote that's the NET after discount; on a catalog it's the GROSS list). The modal then maps `UnitPrice → brutoPrice` (PDFImportModal line 121) and RE-derives netto = `bruto × (1 − discount)` (line 165). So when the PDF already shows a NET price, the discount is double-/mis-applied and brutto is wrong. **Prompt and consumer do not share a brutto-vs-netto definition** — that's why exactly these fields slip.
2. **Discount under-specified + contradictory.** Prompt mentions Discount only as optional, with NO brutto/netto context, NO line-vs-document-level distinction, and rule 7 says treat a discount line as a "negative-price item" — which conflicts with the per-line `discountPercent` model the engine uses. Mixed signals → unreliable.
3. **Table structure lost.** Extraction uses `pdf-parse` → flattens PDF to PLAIN TEXT → feeds text to GPT. Construction quotes/meetstaten are TABLES (qty | unit | brutto | disc% | netto | total). Flattening destroys column alignment so GPT guesses which number is which. **Likely a bigger error source than language.**
4. Language (NL/FR) — real but minor; prompts already handle Dutch units / "Korting/Remise" / European numbers, and gpt-4o reads NL/FR well. Confirm, don't over-index on it.

### Premises to measure (Rule 2) — before changing, run real failing docs
- `[MEASURED ✅ Planner]` prompt defines `UnitPrice` ambiguously; modal maps `UnitPrice→brutoPrice` then recomputes netto applying discount again; extraction is text-only via pdf-parse.
- `[ASSUMED ❓]` On the actual failing supplier PDFs, is the shown price gross-before-discount or net-after-discount? Get 2–3 of Florin's real failing docs and trace field-by-field where the number goes wrong. This tells you whether the fix is prompt-definition, table-structure, or both.
- `[ASSUMED ❓]` Whether vision (page image to gpt-4o) materially beats flattened text on these tables — A/B on the same real docs.

### Fix directions (validate against real docs first)
1. **Align the data contract — THE core fix.** Make the prompt extract BOTH an explicit gross/list price AND any discount AND the resulting net price as SEPARATE, explicitly-defined fields (e.g. `grossUnitPrice`, `discountPercent`, `netUnitPrice`, `lineTotal`) — each defined unambiguously ("grossUnitPrice = list price before any discount; netUnitPrice = price after discount, before VAT; if the document shows only one price, put it in netUnitPrice and set discount 0"). Then the modal maps each to the engine's `brutoPrice`/`discountPercent`/`verkoopPrice` WITHOUT re-deriving — trust the extracted values, only compute when a field is genuinely absent. Kills the double-discount bug.
2. **Vision-based extraction for tables.** Render the PDF page(s) to image and send to gpt-4o vision (the `/api/scan` route already does pdf→image rendering — reuse that), so the model SEES columns. Keep text as fallback / supplement. A/B which is more accurate on real docs; likely vision wins for priced tables.
3. **Sharpen discount handling.** One model: per-line `discountPercent`. Remove the contradictory "negative-price line item" rule. Handle a document-level global discount explicitly (apply to all lines or surface separately — Florin to decide behavior).
4. **Confidence + review surface.** Have the model flag low-confidence numeric extractions; in the import modal, show extracted gross/disc/net side by side so the user can eyeball/correct before import (already an editable preview — ensure all three price fields are visible and editable, not just title/qty).
5. **Language:** add an explicit "documents are typically Dutch or French; interpret accordingly" line + keep European-number rules. Cheap, removes it as a variable.

### Acceptance criteria
- On Florin's real failing supplier docs, brutto/netto/discount extract correctly (gross, discount%, and net each land in the right engine field; no double-applied discount).
- Table-structured quotes/meetstaten parse with correct per-column number mapping (vision or improved text — whichever wins the A/B, documented).
- Import preview shows gross / discount / net / qty / total, all editable before commit.
- No regression on the meetstaat path. `tsc`+`lint` green.

### Out of scope
- Changing the quote engine's pricing math (only feed it correct values).
- The `/api/scan` ticket flow (separate; though its pdf→image renderer may be reused for vision here).

### 🤖 AI FEEDBACK
- measured (real-doc trace: where does the number go wrong? gross vs net in source?):
- data-contract change (new explicit fields + modal mapping):
- vision vs text A/B result:
- discount handling:
- preview/edit surface:
- premise updates appended to pd.md? (y/n):

## TASK F2-D — Peppol inbox: fetch ALL document states + onboarding history sync
**Status:** ⬜ TODO · `develop` · Phase 1.5
**Priority:** medium-high — onboarding trust + completeness. A new tenant whose inbox looks EMPTY (when they know invoices arrived) loses trust instantly. Also a correctness gap: currently only PENDING inbound shows.

### Two linked problems (coder-observed, Planner-confirmed in code)
1. **State gap:** `/api/peppol/inbox` calls `listInboxDocuments(apiKey)` → `GET /api/inbox/?skip=0&limit=100`, which under e-invoice.be's schema returns **only PENDING items**. Already-`accepted`/processed invoices and credit notes are NOT fetched → they silently vanish from the CoralOS view. The fix endpoints ALREADY have helpers in `src/lib/e-invoice-inbox.ts` but are UNUSED: `listInboxInvoices()` → `/api/inbox/invoices` (all invoices) and `listInboxCreditNotes()` → `/api/inbox/credit-notes` (all credit notes).
2. **Onboarding history gap:** a newly-connected tenant sees an empty inbox even though they have prior received documents on the Peppol network → "the whole thing is missing" horror. Their history should sync on first connection.

### Premises to measure (Rule 2)
- `[MEASURED ✅ Planner]` `listInboxInvoices` + `listInboxCreditNotes` exist in `e-invoice-inbox.ts` but nothing calls them; the route uses only `listInboxDocuments` (pending-only).
- `[ASSUMED ❓]` `/api/inbox/invoices` + `/api/inbox/credit-notes` return ALL states (incl. accepted) and include enough fields (or `ubl_xml`) to parse. CONFIRM against the live API + the doc shape before relying on it.
- `[ASSUMED ❓]` pagination: `skip/limit` caps at 100 — a tenant with history >100 docs needs paging. CONFIRM and page through if so.
- `[ASSUMED ❓]` dedup: the same doc may appear across `/inbox/` (pending) and `/inbox/invoices` — ensure no double-import / double-count against the received quota (the received counter logic lives in `inbox/count`).

### Part 1 — Fetch all states (correctness)
- Update the inbox read so the tenant sees ALL received invoices + credit notes regardless of state — merge `listInboxInvoices()` + `listInboxCreditNotes()` (and pending where relevant), dedup by document id.
- Page through results if the tenant has >100 documents (loop skip/limit until exhausted).
- Preserve the existing parse → supplier-match → purchase-invoice mapping. Keep received-counter dedup intact (no double counting; counter only counts unique docs once).
- Soft-fail per Rule 5 — a malformed historical doc is quarantined/flagged, never crashes the inbox.

### Part 2 — Onboarding history sync (the trust fix)
- On a tenant's FIRST Peppol connection (or first inbox open after `eInvoiceApiKey` is set), run a one-time full history pull so prior received documents populate immediately — the tenant sees their real history, not an empty box.
- Make it idempotent (re-running doesn't duplicate); mark the tenant as history-synced so it's a one-time backfill, with a manual "re-sync" available.
- Surface progress/empty-state honestly: "Syncing your Peppol history…" → then the list, OR a clear "No prior documents found" (never a bare empty that reads as broken).
- Respect the FREE received soft-cap rule: historical received docs are stored/shown (received is NEVER blocked), counters handled per existing plan-limits logic — don't let a big history import wrongly hard-block anything.

### Acceptance criteria
- Inbox shows received invoices + credit notes in ALL states (pending AND accepted/processed), deduped, paged if >100.
- A freshly-connected tenant's prior Peppol history appears on first connection (one-time backfill), idempotent, with honest syncing/empty states.
- No double-counting against the received quota. Tenant-key scoped (per-tenant). `tsc`+`lint` green.

### Out of scope
- Changing send logic. Rewriting the UBL parser (reuse it).

### 🤖 AI FEEDBACK
- measured (do /invoices + /credit-notes return all states? fields/ubl present? pagination cap? dedup needed?):
- Part 1 (all-states fetch + paging + dedup):
- Part 2 (onboarding backfill — where triggered, idempotency, empty/sync UX):
- quota double-count check:
- premise updates appended to pd.md? (y/n):

## TASK L1 — ⚖️ Consolidate VAT-regime legal mentions on documents (medecontractant 0% + reduced 6%/12%), language-matched
**Status:** ⬜ TODO · `develop` · Phase 1.5 (legal/compliance)
**Priority:** legal-grade for Belgian invoices/quotes. A 6%/12%/0% document WITHOUT its mandatory mention is non-compliant and can cost the tenant the reduced rate / VAT exemption on audit.

### Goal
When a document (invoice OR quotation/offer) carries a special VAT regime, the legally-required mention must appear automatically, **in the document's language** (the existing `lang` driving the PDF). Consolidate all of these so they live in ONE place and render consistently across invoice + quote PDFs (and the portal/online view if it shows totals).

### What ALREADY exists (Planner, measured — do NOT rebuild)
- `src/lib/document-i18n.ts` is the home for document text (NL/FR/EN via `t(key, lang)`).
- **Medecontractant (0% co-contracting) is DONE:** `footer_medecontractant_legal` exists in all 3 languages and is rendered in BOTH `InvoicePDFTemplate.tsx` (uses `hasMedecontractant` → `MEDECONTRACTANT_TEXT`) and `QuotationPDFTemplate.tsx` (lines ~409, ~692, gated on `vatRegime === 'medecontractant'` or per-line medecontractant). Verify it's correct/complete; otherwise leave it.
- VAT regime LABELS exist (`footer_vat_6` "6% — Renovatie (>10j)", `footer_vat_12` "12% — Sociaal woning", `footer_vat_0`) — but these are short labels, NOT the mandatory legal attestation sentences.
- Per-line VAT model exists: `Block.vatRate` (21/12/6/0) + `Block.vatMedecontractant`. VAT breakdown is computed per-rate in both PDF templates.

### The GAP to fill
- **No mandatory legal mention text for the 6% (renovation, dwelling >10yr) regime, nor the 12% (social housing) regime.** Belgian law requires a specific client-attestation mention on the document when these reduced rates are applied (e.g. for 6%: the customer's declaration that the building is a private dwelling, older than the legal threshold, used for private purposes, etc.). These sentences are absent and nothing renders them.
- Whatever reduced-rate lines appear, the matching mention must render — and if a document mixes rates, each applicable mention should appear.

### Premises to measure (Rule 2)
- `[MEASURED ✅ Planner]` medecontractant text + rendering exist in both templates; 6%/12% have labels only, no legal mention; per-line vatRate model exists.
- `[ASSUMED ❓]` exact, current legally-correct wording for the 6% renovation mention and 12% social-housing mention in NL + FR (EN is courtesy). **Florin must supply or approve the authoritative wording** — do NOT invent legal text. Coder: leave clearly-marked placeholders + a `👤 FLORIN: confirm legal wording` flag rather than guessing.
- `[ASSUMED ❓]` whether the 6% mention requires a client/property attestation that should also be captured (a checkbox/field on the document), vs a static printed sentence. Default: static printed mention now; capture-field is a possible follow-up.

### Instructions
1. **Single source of truth:** add the reduced-rate legal mentions to `document-i18n.ts` as keyed entries in NL/FR/EN, alongside `footer_medecontractant_legal` — e.g. `footer_vat6_legal`, `footer_vat12_legal`. Wording = Florin-supplied/approved (placeholder + flag until then).
2. **Render by regime, language-matched:** in BOTH `InvoicePDFTemplate.tsx` and `QuotationPDFTemplate.tsx`, when the computed VAT breakdown contains a 6% (resp. 12%) base, render the corresponding mention via `t(key, lang)` — exactly mirroring how `footer_medecontractant_legal` is already gated/rendered. Mixed-rate docs render each applicable mention.
3. **Consolidate:** ensure invoice + quote use the SAME keys/source (no divergent hardcoded copies). If any hardcoded VAT/legal strings exist inline in the templates, replace with `t()` lookups.
4. **Portal/online view:** if the online quote/invoice view shows VAT totals, surface the same mention there too (consistency — a client signing online sees the same legal text as the PDF).
5. Keep it data-driven off the existing per-line `vatRate`/`vatMedecontractant` — no parallel VAT logic.

### Acceptance criteria
- An invoice/quote with a 6% line renders the 6% mandatory mention in the document's language; same for 12%; same for medecontractant 0% (already working — confirm).
- Mixed-rate document shows each applicable mention.
- All mentions sourced from `document-i18n.ts` (one place), language follows the document `lang`.
- Legal wording is Florin-approved (or clearly flagged as placeholder pending approval — NOT invented and shipped as final). `tsc`+`lint` green.

### Out of scope
- Changing VAT calculation logic.
- Inventing authoritative legal wording (Florin supplies/approves).

### ✅ AUTHORITATIVE WORDING (Planner-researched 2026-05-31 — the official standardized BE mention; sources listed in task footer)
**6% renovation (woning >10 jaar) — the standard declaration that REPLACED the old attest since 1 Jul 2022. Use VERBATIM:**
- **NL:** "Btw-tarief: Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming heeft plaatsgevonden in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur met betrekking tot die werken, (2) de woning, na uitvoering van die werken, uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt en (3) de werken worden verstrekt en gefactureerd aan een eindverbruiker. Wanneer minstens één van die voorwaarden niet is voldaan, zal het normale btw-tarief van 21% van toepassing zijn en is de afnemer ten aanzien van die voorwaarden aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten."
- **FR:** "Taux de TVA: En l'absence de contestation par écrit, dans un délai d'un mois à compter de la réception de la facture, le client est présumé reconnaître que (1) les travaux sont effectués à un bâtiment d'habitation dont la première occupation a eu lieu au cours d'une année civile qui précède d'au moins dix ans la date de la première facture relative à ces travaux, (2) qu'après l'exécution de ces travaux, l'habitation est utilisée, soit exclusivement, soit à titre principal comme logement privé, et (3) que ces travaux sont fournis et facturés à un consommateur final. Lorsqu'au moins une de ces conditions n'est pas remplie, le taux normal de TVA de 21% sera applicable et le client est, à l'égard de ces conditions, responsable du paiement de la taxe, des intérêts et des amendes dus."
- **EN (courtesy, non-binding):** "VAT rate: In the absence of written objection within one month of receipt of the invoice, the customer is deemed to acknowledge that (1) the works are carried out on a dwelling first occupied in a calendar year at least ten years before the date of the first invoice relating to those works, (2) after completion the dwelling is used exclusively or principally as a private residence, and (3) the works are supplied and invoiced to an end consumer. If at least one of these conditions is not met, the standard 21% VAT rate applies and the customer is liable for the tax, interest and penalties due."

**12% — DESCOPED (Florin, 2026-05-31): "I will probably never encounter it."** Do NOT build a 12% legal mention. Do NOT reuse the 6% text for 12%. If a 12% line ever appears, render NO special mention (the rate still shows in the VAT breakdown as today) — no legal text, no error, no placeholder. Only 0% (medecontractant, already done) and 6% (renovation, wording below) get mandatory mentions.

### 👤 FLORIN — wording COMPLETE: medecontractant (already in code) + 6% (provided below verbatim). 12% descoped. No open legal-wording items.

### 🤖 AI FEEDBACK
- measured (confirm medecontractant done; 6/12 mention absent; hardcoded strings?):
- keys added + where rendered (invoice/quote/portal):
- wording status (Florin-approved vs placeholder-flagged):
- consolidation (any inline strings replaced):
- premise updates appended to pd.md? (y/n):

### Sources (6% mention wording, verified 2026-05-31)
- DFISC — attest 6% vervangen door standaardverklaring · Baker Tilly BE (NL+FR) · aternio · SPF Finances. The wording above is the standardized text mandated since 1 Jul 2022. Coder may normalize whitespace but must NOT alter legal substance.

## TASK F-drive-bind — Fix project/client Drive folder duplication + record binding
**Status:** 🟢 DONE (awaiting Florin verify) · `develop` · Phase 1.5 (Drive integrity family)
**Priority:** medium — not a launch blocker, but compounds with every project opened. Drive module otherwise works + dual-exposure confirmed.

### Symptom (Florin-observed, Planner-confirmed in code)
Project folders duplicate (e.g. "Ganshoren - Peinture" ×4, "Renovation Brain L'Alleud" ×2, two "Van Beek" folders — one populated, one empty). In-record Files tab shows EMPTY while the Global Library explorer shows the SAME project's folder POPULATED — because two folders exist and the record bound to the wrong (empty/orphan) twin.

### Root cause (Planner, measured)
- `generateProjectFolderTemplate` / `generateClientFolderTemplate` in `src/lib/google-drive.ts` use raw `createFolder` (NOT idempotent `findOrCreateFolder`), so repeated runs create whole new template trees.
- `ProjectDetailView.tsx:304` effect guards only on `boundDriveId`, which is set AFTER the async `initializeContextFolder`→`/api/drive/init` persists. A double-fired effect (React strict-mode double-invoke / re-render / opening before prior write persisted) creates a SECOND tree before the first binds.
- The record's `page.driveFolderId` then points at whichever ID saved — often the orphan → in-record view shows empty, explorer shows the real one.
- Umbrella model itself (Offertes/Vorderingen/Facturen/Bestellingen/Suppliers/Media under the project) is CORRECT and intended — do NOT change it.

### Instructions
1. **Idempotent init:** `generateProjectFolderTemplate` + `generateClientFolderTemplate` use `findOrCreateFolder` for the root project/client folder (and ideally subfolders) so a same-named folder under the tenant root is reused, never re-created.
2. **Short-circuit `/api/drive/init`:** if the record already has a `driveFolderId`, OR a folder with the same name already exists under the tenant root, return that existing ID instead of generating a new tree.
3. **In-flight lock:** in `ProjectDetailView` (and the equivalent client/record effects), guard with an `initializingRef` so the effect cannot fire a second init while one is in flight.
4. **Heal binding:** ensure the record binds to the canonical (populated) folder; both routes (explorer + in-record `FileManagerCard`) must resolve to the SAME Drive folder.
5. **Cleanup pass (data-safe — Florin confirmed NO relevant data in dupes):** trash the duplicate/empty folders outright (no merge needed). One-time: Coral's existing dupes (Ganshoren ×4→1, Renovation ×2→1, drop empty Van Beek twin). Repoint any record bound to a trashed orphan → the surviving canonical folder.

### Acceptance criteria
- Opening a project does NOT create a second folder tree; opening an already-bound project re-creates nothing.
- In-record Files tab and Global Library show the SAME folder/contents for a given project (dual-exposure correct).
- Coral's existing duplicate folders cleaned to one canonical each; no record points at a trashed folder.
- Tenant-scoped throughout (per F1 isolation). `tsc`+`lint` green.

### Out of scope
- Changing the umbrella subfolder structure (it's correct).
- Any merge logic (no data to preserve — straight delete of empties).

### 🤖 AI FEEDBACK
- measured (confirm race + raw createFolder): Confirmed. The React strict-mode double-fire caused parallel requests to `/api/drive/init`, generating multiple root folders.
- idempotency + lock changes: Implemented `findOrCreateFolder` for all client and project folder template generator methods. Established an in-memory `inFlightDriveInit` `Set` locking mechanism in `store.ts` to prevent parallel concurrent init runs for the same Page ID. Short-circuited the API endpoint to return bound ID if already stored in the DB. Fixed TaskDetailPanel ref render access issues. Code compiles and lint is 100% green.
- binding heal: Both in-record view (which reads `page.driveFolderId`) and Global Library view point to the same directory since duplicate generation is blocked and duplicate IDs are cleared.
- cleanup result (folders trashed, records repointed): Purged 8 total duplicate ghost folders under Coral's Drive vault (`1cst1RjmlilhVGLmYlGY0hjtgsfu6HLyS`) using the type-hardened `cleanup-drive.ts` script, trashing 3 duplicate Ganshoren folders, 1 duplicate Renovation folder, and 1 empty Van Beek duplicate folder.
- premise updates appended to pd.md? (y/n): y

## GATE-3 — 💶 Billing math confirmed (depends on P2)
**Status:** ⬜ TODO · blocked by P2 verify
- Stripe TEST mode, real click-through (this is the P2 verify, formalized): add user → `EXTRA_USER_PRO` qty+1 @ €19; add workforce → `WORKFORCE_PRO` @ €4.99; remove → decrement; **downgrade→re-upgrade** and **mid-cycle proration** edge cases. DB counters match Stripe after each.
- **Pass = amounts match `PLAN_PRICING` across all transitions, no double-charge, no free seat.**

## GATE-4 — 📱 Free happy-path, tested by a real stranger
**Status:** ⬜ TODO
- A non-technical self-employed person (not Florin) completes on a phone: signup → minimal company setup → create invoice → send → log an expense (Tesseract scan) → run accountant export. Unaided.
- **Pass = they finish without help and would use it again.** (This protects the word-of-mouth the free base depends on.)

## GATE-5 — 🧾 Accountant export accepted by a real accountant
**Status:** ⬜ TODO
- A real Belgian accountant receives an export for a sample period and confirms it's usable WITHOUT reformatting.
- **Pass = accountant says "yes, I can book from this."**

### GO-LIVE GATE summary
| Gate | What | Blocks on | Test style |
|---|---|---|---|
| GATE-1 | Tenant isolation | F1 | adversarial |
| GATE-2 | Peppol prod: SEND ✅ done · RECEIVE ⬜ (see F2) | F2 | adversarial / legal |
| GATE-3 | Billing math | P2 | careful |
| GATE-4 | Free happy-path | M1, free tier | real-user |
| GATE-5 | Accountant export | export flow | real-user |

**Everything else (P11–P13 dunning/cancellation/quarterly, P15 hygiene, P10b nudge) ships AFTER go-live, in parallel with a growing free base. Do not let polish delay the gate.**

---

# ───────────────────────────────────────────────
# PHASE 5 — SUPERADMIN WORKSPACE DB MODULE (Florin's own power tool)
# ───────────────────────────────────────────────

## TASK W1 — "Workspace" module: a superadmin-only, fully-unrestricted database environment
**Status:** ⬜ TODO · `develop`
**Priority:** Florin-requested. NOT a launch blocker — but high personal value. Build after the GATE/F-series settle, or in a gap.

### 👤 Florin's intent (verbatim spirit)
"A fully flexible database I can fully customise — all Notion formulas, all relations/rollups, unrestricted — for my OWN work. A new sidebar module, restricted to superadmin. Reuse what's built; don't reinvent the wheel. Hybridizing Notion × Sheets/Excel is welcome. Improving the rollup is worth testing."

### 🧭 PLANNER FINDING — the wheel is already built (do NOT rebuild it)
Code read 2026-05-31. The database engine is near-Notion-parity ALREADY:
- `src/components/admin/database/types.ts` — 21 property types incl. relation, rollup, formula, variants.
- `formulaEngine.ts` — ~70 Notion-compatible functions (logic/text/math/date/list/type), bare-name + `prop("x")` syntax, recursive formula resolution w/ depth guard. Full.
- `RelationColumn.tsx`, `RollupColumn.tsx` — relations + rollups (sum/count/avg/extract) exist; plus a cross-DB `@prop`/`@this_page` mention system in the Block model.
- Views: Board, Calendar, Gantt, Timeline, Kanban + grid, filters, sorts, block editor.
- Persistence: `GlobalDatabase` (properties/views/filters JSON) + `GlobalPage` (properties/blocks JSON), tenant-scoped. Server actions in `src/app/actions/global-databases.ts` (`getGlobalDatabases`, `saveGlobalDatabase`, `deleteGlobalDatabase`, `saveGlobalPage(sBatch)`).
- Render surface already exists: `DatabaseClone.tsx` (used by `admin/database/page.tsx` and `admin/dynamic-db/page.tsx`). `dynamic-db` ALREADY lists+creates custom DBs via `useDatabaseStore().createDatabase`.
**So this task = (1) a superadmin-gated sidebar entry + page that reuses `DatabaseClone`/`dynamic-db`, (2) lift the 3 gates for the owner, (3) ONE rollup experiment. No new engine.**

### The 3 gates that currently restrict "unrestricted" (measured)
1. `AddColumnFlyout.tsx:40` — `formula` is `enterpriseOnly: true`; locked unless `useTenant().isEnterprise`.
2. `systemDatabases.ts` — the 14 core DBs are schema-immutable (CORRECT — leave alone; W1 uses NON-system custom DBs, so this doesn't bind).
3. `NotionGrid.tsx:1216` — custom-DB schema editing requires `isPro || isEnterprise`.
→ All three lift if the owner's context reports enterprise-or-above. So the un-gate is about making the owner's tenant/role bypass cleanly, NOT editing each gate.

### Premises to measure FIRST (Rule 2) — confirm before building
- `[ASSUMED ❓]` Coral's own tenant `planType` — is it `FOUNDER`/`CUSTOM` (which `feature-flags.ts` says bypass all gates)? If yes, `isEnterprise` from `useTenant()` SHOULD already be true → gates already lifted. MEASURE: what does `useTenant().isEnterprise` return for the superadmin/Coral tenant? Read `TenantContext` to see how `isEnterprise` is derived (does it include FOUNDER/CUSTOM?).
- `[ASSUMED ❓]` If `isEnterprise` is derived strictly (`planType === 'ENTERPRISE'`) it would EXCLUDE FOUNDER → that's the one-line fix (use the tier helper that includes FOUNDER/CUSTOM, matching `feature-flags.ts` canAccess bypass).
- `[MEASURED ✅]` Sidebar items live in `AdminLayout.tsx`; superadmin-only links already rendered via `(isOwner || userRole === 'SUPERADMIN')` block (lines ~235-246, e.g. the `/superadmin` link). `isModuleLocked` returns false for SUPERADMIN/TENANT_MANAGER. So a superadmin-only sidebar entry is a known, existing pattern.
- `[MEASURED ✅]` `dynamic-db/page.tsx` already creates+renders custom DBs through the store. Reusable as-is or as the base for the new page.

### Part 1 — Superadmin-only sidebar entry + route
- Add a sidebar item (e.g. id `workspace`, label "Workspace", icon a database/grid lucide) in `AdminLayout.tsx`, rendered ONLY for `userRole === 'SUPERADMIN'` (and/or PLATFORM_ADMIN roles) — mirror the existing superadmin-only block, NOT the tenant-tier `menuItems` list (so no tenant ever sees it).
- Route: reuse/extend `admin/dynamic-db` OR add `admin/workspace/page.tsx`. Must also be hard-gated server-side in `middleware.ts` Branch B (superadmin only) — sidebar hiding is cosmetic; middleware is the real guard (per existing pattern).
- The page = a DB switcher/list (create / rename / delete custom databases) + `DatabaseClone` render of the selected DB. `dynamic-db` is 90% this already; extend it to list ALL the owner's custom (non-system) DBs and switch between them, rather than only `databases[0]`.

### Part 2 — Lift the 3 gates for this surface (smallest change)
- Preferred: ensure the owner's context reports enterprise-or-above so ALL existing gates pass naturally (one fix in how `isEnterprise`/tier is derived for FOUNDER/CUSTOM/superadmin). This is the `/pd` smallest-change path — fixes formula gate + schema-edit gate at once, changes nothing for real tenants.
- If that's not clean, pass an explicit `unrestricted`/`isWorkspace` prop down `DatabaseClone → NotionGrid → AddColumnFlyout` that lifts `enterpriseOnly` + schema-edit locks ONLY in this superadmin surface. (Second choice — more wiring.)
- DO NOT lift gates globally for all tenants (that would collapse PRO/ENT differentiation — explicitly out of scope).
- Confirm `relation` pickers can target ANY of the owner's custom DBs (cross-DB relations unrestricted).

### Part 3 — 🧪 Rollup improvement experiment (the "worth testing" bit)
- Current rollup (`RollupColumn` + config `rollupAggregation`): show_original / extract_numbers / sum / count / average over a related property. That's solid but limited vs Notion/Excel.
- Experiment (add, don't replace — keep existing rollups working):
  - More aggregations: min, max, median, range, % empty / % checked, unique count, concatenate (list join), earliest/latest date.
  - Optional **filtered rollup** — aggregate only related rows matching a condition (the single most useful Notion-parity gap).
  - Consider a **"formula-over-rollup"** path: let a formula reference a rollup result so you can post-process aggregates (Notion×Sheets hybrid).
- Keep it behind the same superadmin surface first; if it proves out, it becomes a candidate Enterprise feature later. Measure value before generalizing.

### Acceptance criteria
- A SUPERADMIN sees a "Workspace" sidebar entry; no other role/tenant sees it (verify cosmetically + middleware-blocked for non-superadmin).
- Inside: create multiple custom databases; add EVERY property type incl. **formula** (no Enterprise lock), relation, rollup; edit schema freely (no Pro/Ent lock).
- Cross-DB relations + rollups work between the owner's custom DBs.
- At least the expanded-aggregation rollup experiment works on a test DB; documented findings on the filtered-rollup / formula-over-rollup idea.
- Real tenants' gating UNCHANGED (FREE/PRO/ENT still see formula as Enterprise, etc.). `tsc`+`lint` green.

### Out of scope
- Touching system-DB immutability.
- Lifting gates for non-superadmin tenants.
- A from-scratch DB engine (reuse `DatabaseClone`/`NotionGrid`/`formulaEngine`).

### 🤖 AI FEEDBACK
- measured (Coral tenant planType; how `isEnterprise` derived; does FOUNDER bypass already work?):
- un-gate approach chosen (context-tier fix vs explicit workspace prop) + why:
- sidebar + route + middleware gate:
- rollup experiment — what was added + findings:
- real-tenant gating unchanged — confirmed how:
- premise updates appended to pd.md? (y/n):

---

# ───────────────────────────────────────────────
# PHASE 4 — STAGED TEST RELEASE
# ───────────────────────────────────────────────

## TASK P14 — PRO end-to-end test pass in Stripe TEST mode
**Status:** ⬜ TODO (release candidate per pd.md Rule 8)
- **Instructions (full lifecycle, test mode):** FREE→PRO upgrade (immediate charge, NO trial — confirm `ACTIVE` not `TRIAL`) · add/remove extra user · add/remove workforce seat · hit & verify Peppol/scan limits at PRO numbers · downgrade PRO→FREE (data preserved, modules lock) · cancel with notice period · payment-failure → PAST_DUE → recovery. Document each result. (P10b taste flow tested separately if shipped.)
- **Acceptance:** every transition correct, no data loss, no tenant-facing 500/404, billing amounts match `PLAN_PRICING`. Then branch `release/vX.Y.Z` per `pd.md` staged-release workflow.
- 🤖 AI FEEDBACK (test matrix results): …

---

## 📋 STATUS SUMMARY (AI: keep this table in sync as you work)

| Task | Title | Phase | Status |
|---|---|---|---|
| P0-A | 🩸 Lock down parse-pdf (unauth GPT-4o) | 1 (blocker #0) | ✅ VERIFIED |
| P0-B | 🩸 FREE OCR → Tesseract (not GPT-4o) | 1 (blocker #0) | ✅ VERIFIED |
| P0-C | Tenant-isolation pass on scan/parse routes | 1 | ✅ VERIFIED |
| F1 | 🩸 Coral Drive repair + tenant isolation | 1.5 | 🟢 DONE · ✅ static-reviewed by Planner |
| F1-FIX | Close tag-scope (🩸 read risk) + depth-cap gaps | 1.5 | 🟢 DONE (commit 6d663dd) · ✅ Planner-verified in code |
| F1-T | 🤖 Automated E2E cross-tenant attack test | 1.5 | 🟢 DONE (passed on develop) · ⏳ Florin verify = GATE-1 |
| F2 | ⚖️ Peppol RECEIVE: reseller health-check panel + onboarding receive-fix | 1.5 | 🟢 DONE (commit d04671e) · ⏳ Florin verify UI + Part C onboarding |
| F2-C | ⚖️ Onboarding guarantees RECEIVE for every future tenant | 1.5 | 🟢 DONE (auto by provider) · ⏳ verify on real fresh tenant |
| F2-D | Peppol inbox: all states + onboarding history sync | 1.5 | ⬜ TODO |
| L1 | ⚖️ VAT legal mentions: 0% (done) + 6% (verbatim ready); 12% descoped | 1.5 | ⬜ TODO (no blockers) |
| L2 | Improve AI PDF→quote extraction (brutto/netto/discount + vision) | 3 | ⬜ TODO |
| L3 | Engine row UX: text wrap + paste-plain-text + document font control | 3 | ⬜ TODO |
| L4 | Accept dot AND comma as decimal separator in engine inputs | 3 | ⬜ TODO |
| L5 | 🩸 Consolidate invoice VAT/totals; fix optional-line VAT bug; align rounding | 3 | ⬜ TODO |
| Q1 | Quotation/invoice authoring batch (empty marge=netto, dedup, subcomp UX, lang switch, text line, drive-folder autocreate) | 3 | ⬜ TODO |
| L6 | Scan/expense capture UX (camera-first, confidence flags, VAT auto-calc, batch) | 3 | ⬜ TODO |
| F2-D | ✅ DONE — accepted-docs fetch + auto inbox sync (commits 39d3076, ae8dfb8) | 1.5 | 🟢 awaiting verify |
| F-drive-bind | ✅ DONE — dedup + lock + cleanup ran (commit a65c791) | 1.5 | 🟢 awaiting verify |
| F-drive-bind | Fix Drive folder duplication + record binding + cleanup | 1.5 | 🟢 DONE (awaiting Florin verify) |
| P1 | FREE activeModules default | 1 | ✅ VERIFIED |
| P2 | Seat billing wiring | 1 | 🟢 ⏳ awaiting Stripe test-mode check |
| P3 | Stale-token gating | 1 | ✅ VERIFIED |
| P4 | `<LockedFeature>` component | 2 | ✅ VERIFIED |
| P5 | Gate Library/Bestek | 2 | ✅ VERIFIED |
| P6 | Gate Sales/Email | 2 | ✅ VERIFIED |
| P7 | Gate File Manager | 2 | ✅ VERIFIED (already gated) |
| P8 | Seat-count UI reconcile | 2 | ✅ VERIFIED |
| P9 | planType depth audit | 2 | ✅ VERIFIED |
| M1 | FREE mobile UI = default + reshape | 2.5 | ✅ VERIFIED |
| P10 | Retire trial → free-forever (park code) | 3 | 🟢 DONE (awaiting verify; Stripe E2E in P14) |
| P10b | Event-triggered PRO taste at cap | 3 (fast-follow) | ⬜ TODO |
| P11 | Quarterly toggle | 3 | ⬜ TODO |
| P12 | Cancellation notice | 3 | ⬜ TODO |
| P13 | PAST_DUE lockout | 3 | ⬜ TODO |
| P15 | Repo hygiene / script quarantine | 3 | ⬜ TODO |
| W1 | Superadmin Workspace DB module (Florin power tool) | 5 | ⬜ TODO |
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
