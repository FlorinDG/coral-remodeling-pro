# CoralOS — Launch Roadmap & Critical Path
> Companion to `ROADMAP.md` (strategy) — this doc is the **execution tracker**.
> Last updated: 2026-05-30
> Goal A: Ship **FREE tier** to the public ASAP.
> Goal B: As soon as possible after, ship a **staged test release of paying tiers** (PRO/ENTERPRISE).

---

## 0. How to read this document

- `[ ]` = not started · `[~]` = in progress · `[x]` = done · `[!]` = **launch blocker**
- **CP** tag = on the critical path to FREE launch. If it slips, launch slips.
- Each phase has **exit criteria** — the gate you must pass before moving on.
- Estimates are deliberately omitted; fill them in as you assign. Sequence matters more than dates here.
- Strategy only — no code in this file.

---

## 1. Strategic framing (read before planning)

Three decisions drive everything below:

1. **FREE tier does NOT require Stripe.** Billing only gates *paid* features. Decoupling free-tier launch from the entire Stripe/gating epic is the single biggest accelerator available. Ship free first; sell second. (Good news: the billing layer is already substantially built — see note below — so Goal B is closer than `ROADMAP.md` suggests.)
2. **Security is the real gate, not features.** This is an inference, not a documented finding: the presence of one-off repair scripts in the repo root (`fix-florin-enterprise.ts`, `fix-tenant.ts`, `fix-founder-dbs.js`) strongly suggests multi-tenant data was manually patched at least once, which is exactly the smell of inconsistent `tenantId` scoping. Before going public you must *prove* tenant isolation holds across all data routes. Treat this as the long pole until a real audit says otherwise — it's the one class of bug you cannot ship.
3. **The free persona is narrow on purpose.** Self-employed, mobile-first, invoices ~twice a month for salary, logs a limited set of expenses, and periodically hands an export to the accountant. Every free-tier task should be judged against *that one workflow*. Anything outside it is scope creep and waits.

> **What's already built (verified by reading the code, not the roadmap):**
> Billing is much further along than `ROADMAP.md` Phase 2 implies. Present and apparently functional: `src/lib/stripe.ts` (plan→module map, `PLAN_PRICING`), Stripe routes for `checkout` / `cancel` / `portal` / `webhook`, `src/lib/trial.ts` (203 lines), `src/lib/feature-flags.ts` (`canAccess()` gating engine), `src/lib/moduleGuard.ts` (server-side `verifyModuleAccess`, reads from DB to avoid stale-token windows), `src/lib/plan-limits.ts` (Peppol send/receive enforcement + monthly reset), and cron routes (`trial-check`, `trial-notifications`, `invoice-overdue`). Schema has `stripeCustomerId`, `subscriptionStatus`, `trialEndsAt`, `peppol*ThisMonth` counters. **So Phase B is mostly "verify, wire into the UI, test, harden, go live" — not "build."** Two caveats: (a) confirm `assertPeppolSentLimit()` is actually *called* in the send path, not just defined; (b) `PLAN_MODULES.FREE = ['INVOICING']` only — verify the free persona's expense-logging and accountant-export live under INVOICING or are otherwise reachable on FREE.

> **The free "happy path" (the only thing that must be perfect at launch):**
> sign up → set minimal company/VAT details → create invoice on mobile → send/get paid → log a few expenses → accountant exports the period. Everything else can be rough or hidden.

---

## 2. Critical Path at a glance

```
FREE LAUNCH CRITICAL PATH (must all be green):
  CP1 Multi-tenant security audit & lockdown   ──┐
  CP2 Free happy-path UX (mobile-first)          ├─→  CP6 Closed beta (real self-employed users)
  CP3 Signup / onboarding / minimal company setup│        │
  CP4 Accountant export flow                      │        ▼
  CP5 Usage-limit enforcement (free caps)        ─┘   CP7 Public FREE launch
  + Production hardening (monitoring, backups, legal)

PAID TIERS (starts in parallel AFTER CP1, ships AFTER free launch):
  P1 Stripe test-mode wiring → P2 Gating/upgrade UX → P3 Closed paid beta (test mode)
  → P4 Stripe production → P5 Staged paid release
```

---

# PHASE A — FREE TIER LAUNCH (Goal A)

## A1. Security & multi-tenant isolation — `[!] CP` (LONG POLE)
> Nothing ships publicly until this phase passes. Treat as a hard gate.

- [ ] **A1.1 — Systematic `tenantId` filtering audit** `[!] CP`
  - [ ] A1.1.1 Inventory every API route (62) and server action that reads/writes tenant data
  - [ ] A1.1.2 Confirm each query is scoped to the session's `tenantId` (no implicit "all rows")
  - [ ] A1.1.3 Prioritize the free happy-path routes first: contacts/clients, invoices, expenses, company settings, export
  - [ ] A1.1.4 Adopt a single enforced pattern (e.g. a tenant-scoped data accessor) so new code can't regress
  - [ ] A1.1.5 Write a repeatable isolation test: log in as Tenant A, attempt to read/modify Tenant B's records by ID — must fail every time
- [ ] **A1.2 — Remove hardcoded tenant references** `[!] CP`
  - [ ] A1.2.1 Grep for hardcoded tenant IDs / single-tenant assumptions (the `fix-florin-enterprise`, `fix-tenant`, `fix-founder-dbs` scripts hint these exist)
  - [ ] A1.2.2 Verify a freshly-signed-up tenant gets a fully working, isolated workspace with zero manual DB surgery
- [ ] **A1.3 — Auth & session correctness**
  - [ ] A1.3.1 Verify session/permissions refresh after plan change — `moduleGuard` already reads from DB (good), but confirm the JWT/sidebar doesn't show stale access; lower priority for free-only
  - [ ] A1.3.2 Confirm middleware blocks unauthenticated access to all `/admin` and `/m` routes
- [ ] **A1.4 — Input validation on free-path endpoints**
  - [ ] A1.4.1 Zod (already a dependency) validation on invoice create, expense create, company settings, signup
  - [ ] A1.4.2 Basic rate limiting on auth + public endpoints — at minimum signup/login abuse protection
- [ ] **A1.5 — Secrets hygiene** — confirm no secrets committed; rotate anything that leaked into git history
- **Exit criteria:** Documented isolation test passes for all free-path routes; a new tenant works end-to-end with no manual intervention; auth gates verified.

## A2. Free happy-path UX (mobile-first) — `[~] CP`
> The `/m` mobile shell exists (dashboard, clients, expenses, invoices list/new/detail, purchases). This phase is about making *that one workflow* flawless on a phone.

- [~] **A2.1 — Mobile invoice creation** `[!] CP`
  - [ ] A2.1.1 "Create invoice in under 60 seconds on a phone" usability target
  - [ ] A2.1.2 Pre-fill from saved client; remember last-used values for the recurring "salary" invoice
  - [ ] A2.1.3 PDF generation + send works on mobile (Resend path)
  - [ ] A2.1.4 Online signature / payment status visible on mobile
- [ ] **A2.2 — Mobile expense logging** `[!] CP`
  - [ ] A2.2.1 Fast add: amount, category, supplier, date, attachment/photo
  - [ ] A2.2.2 Optional receipt photo → attachment (OCR can be deferred to paid; keep manual entry solid)
  - [ ] A2.2.3 List/filter expenses by period
- [ ] **A2.3 — Mobile dashboard** — show only what the persona needs: this-period invoices, outstanding, expense total, "export for accountant" CTA
- [ ] **A2.4 — i18n coverage** — NL/FR/EN (and RO already in progress) complete for every free-path string; no missing keys
- [ ] **A2.5 — Empty/loading/error states** for the free path — no white screens (themed crash screen already exists per issue tracker #68; confirm it covers the mobile path)
- [ ] **A2.6 — Free-tier IA cleanup** — hide/lock everything not in the free workflow so the UI feels purpose-built, not a stripped ERP
- **Exit criteria:** A non-technical self-employed tester completes invoice → send → expense → export on a phone unaided.

## A3. Signup, onboarding & minimal setup — `[ ] CP`
- [ ] **A3.1 — Public self-serve signup** (no manual provisioning) `[!] CP`
  - [ ] A3.1.1 Email/password + Google; email verification
  - [ ] A3.1.2 Auto-provision isolated tenant + default databases (verify the `provisionTenantDbs` path is reliable for free)
- [ ] **A3.2 — Minimal company setup wizard** `[!] CP`
  - [ ] A3.2.1 Collect only what an invoice legally needs: name, address, VAT/BTW number, IBAN, logo (optional)
  - [ ] A3.2.2 Belgian VAT validation; sensible defaults so first invoice is possible immediately
- [ ] **A3.3 — First-run guidance** — a 3-step nudge toward the first invoice (not a heavy tour)
- **Exit criteria:** A stranger can go from landing page to first sent invoice with zero help from you.

## A4. Accountant export flow — `[ ] CP`
> This is the persona's recurring "why I'll keep using it" moment. Make it boring and reliable.

- [ ] **A4.1 — Define the export contract** `[!] CP`
  - [ ] A4.1.1 Decide format(s): CSV/Excel for sure; PDF bundle of invoices+receipts; consider a Belgian-accountant-friendly format (e.g. compatible with common BE bookkeeping imports)
  - [ ] A4.1.2 Decide scope selector: by month/quarter/custom range; sales + purchases + VAT summary
- [ ] **A4.2 — Generate export** — invoices, expenses, attachments, VAT totals for the chosen period in one package
- [ ] **A4.3 — Delivery** — download + optional "email to my accountant" (store accountant email in settings)
- [ ] **A4.4 — Validate with a real accountant** — have one confirm the export is actually usable before launch
- **Exit criteria:** A real accountant accepts the export for a sample period without asking for reformatting.

## A5. Usage-limit enforcement (free caps) — `[ ] CP`
> Even without Stripe, free must enforce its own limits or it's an unbounded liability and removes the upgrade incentive.

- [ ] **A5.1 — Confirm server-side enforcement is wired** `[!] CP` (functions exist in `plan-limits.ts`; the risk is they're defined but not *called*)
  - [ ] A5.1.1 Verify `assertPeppolSentLimit()` runs before dispatch in `api/peppol/send` and `incrementPeppolSent()` after success
  - [ ] A5.1.2 Free caps confirmed in code: 5 sent / 10 received per month (`PLAN_LIMITS.FREE`). Confirm the 3-database cap is enforced too
  - [ ] A5.1.3 Monthly reset exists (`maybeResetMonthlyCounters`, UTC 1st-of-month) — confirm it's invoked on the read path
- [ ] **A5.2 — Usage meter UI** — "3/5 invoices this month" on mobile dashboard
- [ ] **A5.3 — At-limit behavior** — soft warning at 80%, graceful block at 100% (never delete data)
  - [ ] A5.3.1 Pre-Stripe: block + "PRO coming soon — join waitlist" (captures demand, see Phase C)
  - [ ] A5.3.2 Post-Stripe: swap waitlist CTA for real upgrade/10-pack checkout
- **Exit criteria:** Free user cannot exceed caps; counters reset correctly; at-limit UX is clear and non-destructive.

## A6. Production hardening — `[ ] CP` (parallel with A1–A5)
- [ ] **A6.1 — Monitoring & error tracking** `[!] CP` (ROADMAP lists monitoring as "console logs" — you're effectively blind in prod) — Sentry + Vercel Analytics
- [ ] **A6.2 — Database backups** `[!] CP` (Neon Free — confirm backup/PITR posture) — automated backups + a tested restore
- [ ] **A6.3 — Legal & compliance**
  - [ ] A6.3.1 Privacy policy, EULA, terms live (pages exist — fill with real content, lawyer-reviewed)
  - [ ] A6.3.2 GDPR: tenant data export + deletion path
  - [ ] A6.3.3 Cookie/consent if analytics used
- [ ] **A6.4 — Infra tier check** — confirm Vercel/Neon free tiers survive launch load; plan upgrade trigger
- [ ] **A6.5 — Performance pass on free path** — check for missing DB indexes and N+1 queries on invoice/expense lists
- [ ] **A6.6 — Repo/release hygiene** (not user-facing but de-risks launch)
  - [ ] A6.6.1 Move ~30 root one-off scripts into `/scripts` or delete; stop committing `dev-output.log`/`server.log`
  - [ ] A6.6.2 Replace boilerplate `README.md` with real run/deploy/architecture notes
  - [ ] A6.6.3 Rename `isuue tracking.md` → fold into this tracker
  - [ ] A6.6.4 `npm run validate` (typecheck + lint) green in CI before deploy
- **Exit criteria:** Errors are visible, data is recoverable, legal pages are real, free path is performant.

## A7. Closed beta — `[ ] CP`
- [ ] A7.1 Recruit 5–15 real self-employed users matching the persona (see Phase C for sourcing)
- [ ] A7.2 Give them the live free tier; watch the happy path with light instrumentation
- [ ] A7.3 Triage: fix only launch-blockers + happy-path friction; park everything else
- [ ] A7.4 Confirm the accountant-export loop completes for at least one real monthly cycle (or simulated)
- **Exit criteria:** ≥3 beta users complete the full loop and would recommend it; no open P0/P1 on the free path.

## A8. 🚀 PUBLIC FREE LAUNCH — `[ ] CP`
- [ ] A8.1 Marketing site points to signup (hand-off to Phase C promotional plan)
- [ ] A8.2 Support channel ready (even just a monitored inbox)
- [ ] A8.3 Launch-day monitoring watch
- **Exit criteria:** Public can sign up and run the free workflow unaided.

---

# PHASE B — PAID TIERS, STAGED TEST RELEASE (Goal B)

> Start B1–B2 **in parallel** with Phase A *after* A1 (security) is done — but do **not** ship paid until after the free launch. Billing scaffolding already partially exists (schema fields, Stripe webhook w/ handlers, billing portal route), so this is "finish + harden," not "build from zero."

## B1. Stripe — test mode wiring (mostly verification, not build)
- [ ] **B1.1 — Reconcile pricing source-of-truth** `[!]`
  - [ ] B1.1.1 Resolve the ENTERPRISE price contradiction: `ROADMAP.md` header says €99, its decisions log/Phase 2 say €79, but the **code (`stripe.ts PLAN_PRICING`) uses €99 base**. Code is the most recent truth — update `ROADMAP.md` to €99 (and decide the add-on model: code has extra-user €19/PRO, €79/ENT, plus workforce seats — make sure that's intentional and documented). PRO trial in code is **3 months**, not the 14 days in `ROADMAP.md` — reconcile.
- [ ] **B1.2 — Create/confirm Stripe products & prices** (test mode): PRO €29/mo, ENTERPRISE €99/mo, extra-user seats, 10-pack €4.90 one-time — map each to a price ID in env
- [ ] **B1.3 — Checkout flows** — `api/stripe/checkout` exists; verify both subscription and one-time pack paths end-to-end
- [ ] **B1.4 — Webhook completeness** — `api/stripe/webhook` exists; verify handlers cover created/updated/cancelled + payment success/fail and map cleanly to `planType`/`subscriptionStatus`/`stripeCustomerId`
  - [ ] B1.4.1 Confirm webhook idempotency/retry handling
- [ ] **B1.5 — Customer portal** — `api/stripe/portal` exists; verify self-service manage/cancel end-to-end

## B2. Gating & upgrade UX (engine built; finish the UI surface)
- [ ] **B2.1 — Module gating** — `moduleGuard.verifyModuleAccess` + `feature-flags.canAccess` already exist and read `activeModules`/`planType`. Remaining: lock icons in sidebar + consistent client-side gating on every paid module's entry point
- [ ] **B2.2 — Upgrade modal** — plan comparison; triggered at free limit and on locked modules
- [ ] **B2.3 — Plan-change correctness** — on upgrade/downgrade, refresh session/sidebar immediately; activate/deactivate modules; never delete data on downgrade
- [ ] **B2.4 — Overage flow** — 10-pack purchase increments allowance; meter reflects it
- [ ] **B2.5 — PRO trial on signup** — `trial.ts` + `cron/trial-check` + `cron/trial-notifications` exist; confirm the trial length matches the reconciled decision (B1.1.1) and expiry/downgrade behavior is correct

## B3. Closed paid beta (Stripe TEST mode)
- [ ] B3.1 Invite a handful of free users who hit limits (warm leads from A5.3.1 waitlist)
- [ ] B3.2 Run full upgrade → use PRO modules → downgrade/cancel cycle in test mode
- [ ] B3.3 Verify no data loss across plan transitions; meters/limits correct per tier

## B4. Stripe production + go-live readiness
- [ ] B4.1 Switch to live keys/prices; real payment-method test with a live card
- [ ] B4.2 Tax/VAT handling on invoices to customers (Stripe Tax or manual BE VAT) — **confirm with accountant**
- [ ] B4.3 Dunning/failed-payment emails; subscription-state transition emails
- [ ] B4.4 Refund/cancellation policy documented

## B5. 🚀 STAGED PAID RELEASE
- [ ] B5.1 Roll out PRO first to the waitlist/beta cohort (limited), monitor billing events closely
- [ ] B5.2 Then open PRO publicly
- [ ] B5.3 ENTERPRISE last (HR, Projects, API are 🟡/🔴 maturity — harden before selling): finish HR time-tracker, project management, then enable
- **Exit criteria:** Real revenue collected, no billing-state corruption, customer can self-serve manage subscription.

---

# PHASE C — PROMOTIONAL ROADMAP (placeholder — we discuss next)

> Stub only. We'll flesh this out together after you react to Phase A/B.

- [ ] C1 Positioning & message for the free persona (self-employed, mobile, "invoice your salary + hand off to your accountant")
- [ ] C2 Pre-launch demand capture (waitlist tied to A5.3.1)
- [ ] C3 Channels: where Belgian self-employed (zelfstandigen / indépendants) actually gather
- [ ] C4 Accountant partnership angle (accountants as a distribution channel — they onboard their clients)
- [ ] C5 Launch sequence + content
- [ ] C6 Free → PRO conversion nudges
- [ ] C7 Metrics: activation (first invoice sent), retention (monthly export loop), conversion to paid

---

## Appendix — Deferred / explicitly NOT in free launch
Keep these out of the critical path to protect the launch date:
- Peppol *production* mode (test mode is fine for free; production is a paid differentiator + needs e-invoice.be registration)
- OCR receipt scanning (manual expense entry is enough for free)
- Calendar, Email, Files, Spreadsheet, Library, Tasks, CMS, Portals (all PRO+)
- HR, Time-tracker, Projects, Project-management (all ENTERPRISE, and 🟡/🔴 maturity)
- Inventory, Purchasing, Accounting/Ledger, Payroll, Reporting/BI (future)
- Batiprix, Tooli.be integrations (future, partnership-dependent)
```
