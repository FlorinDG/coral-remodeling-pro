---
description: PRIME DIRECTIVE — Protect What Is Already Built. Read at session start.
---

# PRIME DIRECTIVE: Protect What Is Already Built

> Re-read this file at the start of every session before touching any code.
> This is not a guideline. It is a constraint.

---

## The Core Epistemological Rule

There are two kinds of reasoning. Confusing them is the source of most failures in this project.

**Deduction** (`P ⊨ C`) — a contract:
- Given true premises, the conclusion is guaranteed.
- Failure mode: the premises were assumed, not measured.
- In code: type system, SLA, written policy.

**Inference** (`P(H|E)`) — a best guess:
- Given evidence, the most probable conclusion is chosen.
- Failure mode: evidence was incomplete or misread.
- In code: debugging, forecasting, routing decisions under uncertainty.

**The plague of this project has been treating inferences as deductions.**
Documentation is a prior, not an axiom. Measure before you commit.

---

## The Validation Rule (Prime Directive in Practice)

Before trusting any premise, measure it:

```
Premise (from docs / memory / assumption)
    ↓
curl / log / test / type-check
    ↓
Only then: elevate to axiom and deduce from it
```

**Never skip the measurement step.**
A `curl -D -` costs 2 seconds. A failed deploy costs hours.

---

## What "Protect What Is Already Built" Means

1. **Working features are more valuable than new features.**
   Every change is a risk to something that already works.
   Assess before touching.

2. **Silent failure is always better than service interruption.**
   Wrap critical paths. Show stale data. Show a spinner. Never show a 500 or 404 to a tenant.

3. **The user runs a real business on this software.**
   A locked-out admin is not a bug report. It is a business emergency.
   Fail-safes are not optional.

4. **Vertical integration over vendor trust.**
   When a supplier (library, API, service) behaves unpredictably, bring the function in-house.
   We replaced `auth()` wrapper with `decode()` — same data, zero vendor unpredictability.

---

## Concrete Rules Before Every Code Change

### Rule 1 — Scope Before Touch
> What is currently working? What does this change risk breaking?
List both before writing a single line.

### Rule 2 — Measure the Premise
> Is the assumption this is built on actually true in the current runtime?
Run `curl`, read logs, check the actual cookie, check the actual response header.
Do not trust documentation alone.

### Rule 3 — Smallest Possible Change
> Can this be done by changing 1 file instead of 3? 1 line instead of 20?
Complexity multiplies failure surface. Minimise it.

### Rule 4 — Verify After Deploy
> Did it actually land? Did it actually fix the symptom?
Run the same `curl` or test after every push. Do not assume the deploy worked.

### Rule 5 — Soft Failures First
> If this could fail at runtime (network, auth, DB), does it fail gracefully?
No unhandled exceptions in tenant-facing code. Ever.

### Rule 6 — Staged Release Pipeline (Never Push Directly to `main`)
> Always verify your work compiles: `npx tsc --noEmit` and lints `npm run lint`.
> We do NOT commit directly to `main` anymore. All feature development occurs on the `develop` branch.
> Merges into `main` occur exclusively through verified release candidates (`release/v*`) or hotfixes.
A broken build deployed to Vercel serves the last good build silently.
This is the most dangerous failure mode: you think you fixed it, but it didn't deploy.

### Rule 7 — Structure Before Feature
> Before adding a feature to a UI pattern, verify the target is a proper component.
> If it is hardcoded inline and duplicated across views, extract it into a reusable component first — then implement the feature once.

Two-step gate:
1. **Structural audit** — "Is the target a component or inline duplication?"
2. **Structural fix before feature work** — "Extract first, feature second."

Never bolt features onto one copy of duplicated inline code.
The silent failure mode: feature lands in View A, View B stays stale, and the divergence is invisible until a user reports it.

### Rule 8 — No Untested Production Deployments
> Develop on `develop` branch, verify in local environment or Vercel preview URLs.
> Run staging verification in Vercel's staging environment on `release/*` branches.
> Only merge to `main` once all tests pass.

---

## The Three Domains Are the Same Problem

| Domain | Deduction | Inference | Failure |
|---|---|---|---|
| Mathematics | `P ⊨ C` | `P(H\|E) < 1` | Wrong axiom |
| Programming | Type system / tests | Debugging | Runtime ≠ compile-time |
| Business | Policy / SLA | Forecast / decision | Contract on wrong premise |

The framework is identical. The fix is always the same:
**validate the premise before deducing the solution.**

---

## Session Opening Checklist

When starting a new session on this project:

- [ ] Re-read this file
- [ ] Check `git log --oneline -5` — what was the last thing deployed?
- [ ] Check active branch (must be `develop` for all new work)
- [ ] `curl -D -` the affected domains — is what's live actually what we think?
- [ ] Ask: what is the user currently relying on that must not break?
- [ ] Only then: plan the new work

---

## Branch Model (CANONICAL — never deviate without Florin's explicit instruction)

```
develop  →  staging  →  main
                ↑
           sandbox  (scratch only, never merged)
```

| Branch | Who commits | Purpose | Vercel |
|---|---|---|---|
| `develop` | AI (coder) | All task work lands here. Test versions here. | Preview — always live |
| `staging` | AI (coder, when cutting a version) | Final pre-release check. Cut a semver tag here. | Staging environment |
| `sandbox` | AI (scratch only) | Risky experiments. Nothing durable. Deleted freely. | Not deployed |
| `main` | **Florin only** | Sacred. Production. Only version promotion from staging lands here. | Production |

### Rules

1. **All task work commits directly to `develop`.** No per-task feature branches. No `feature/*` or `bugfix/*` branches for routine hardening work. Those clutter Vercel previews and add friction with no benefit at this stage.

2. **`main` is untouchable by AI.** Under no circumstances does the AI push, merge, or rebase into `main`. Not even a hotfix. Florin promotes staging → main.

3. **Cutting a release:**
   - When `develop` is stable and ready for pre-release: `git checkout -b staging && git push origin staging` (or reset the existing `staging` branch to the current `develop` HEAD).
   - Smoke-test on the Vercel staging environment.
   - Tag the commit: `git tag -a vX.Y.Z -m "Release description"` and push the tag.
   - Florin merges `staging` → `main` manually.

4. **`sandbox` is disposable.** Never merge sandbox work anywhere without first verifying it compiles and passes lint. Treat it as a throwaway.

5. **After a production release**, sync `develop` with the new main: `git checkout develop && git merge main && git push origin develop`.

6. **SEPARATION OF POWERS — `board-v2.md` is the Planner's file ONLY.** The coding AI must NEVER edit `.agents/workflows/board-v2.md` (no "docs: update board" commits). The coder's status channel is the deterministic `TASK-ID:` commit name — that IS how it reports; the Planner reconciles the commit log into the board. **Why this is binding:** the board is edited in the working tree by the Planner and is often UNCOMMITTED; the coder's frequent `develop`↔`main` checkouts/merges reset the working tree and silently wipe those uncommitted Planner edits (happened repeatedly 2026-06-07/08). Two consequences: (a) the coder leaves the board alone; (b) a Planner board update should be COMMITTED promptly (`git add .agents/workflows/board-v2.md` as its own commit) so branch operations can't discard it. One writer per artifact; ground truth = `git log --oneline` + the committed board.

---

## Known Premises That Have Already Been Validated (as of 2026-04-21)

| Premise | Status | Validated by |
|---|---|---|
| `coral-sys.coral-group.be` → store page | ✅ | `curl` → HTTP 200, `x-matched-path: /[locale]/store` |
| `app.coral-group.be/login` → login page | ✅ | `curl` → HTTP 200, `x-matched-path: /[locale]/login` |
| `auth()` wrapper in NextAuth v5 beta.30 auto-redirects before callback | ✅ | `curl` → 307 persisted despite `authorized: () => true` |
| Direct `decode()` from `next-auth/jwt` bypasses wrapper | ✅ | `curl` → HTTP 200 after middleware rewrite |
| `localePrefix: 'never'` — locale lives in `NEXT_LOCALE` cookie | ✅ | Code + deploy |
| Gate button on login (`?plan` absent) → points to `coral-sys` | ✅ | Code review |
| ESLint errors in any file block Vercel build silently | ✅ | Multiple failed deploys |
| PRO/ENTERPRISE seat cap removed — `PLAN_USER_LIMITS[PRO] = Infinity` | ✅ | 2026-05-18 code change |
| `BOOKKEEPING` role → sidebar: Financials, Contacts, Suppliers, Library | ✅ | 2026-05-18 `ROLE_SIDEBAR_ALLOW` + middleware gate |
| `TEAMLEAD` role → sidebar: Projects, Tasks, Calendar, HR | ✅ | 2026-05-18 `ROLE_SIDEBAR_ALLOW` + middleware gate |
| `PROJECT_MANAGER` role → sidebar: Projects, Tasks, Calendar, Contacts | ✅ | 2026-05-18 `ROLE_SIDEBAR_ALLOW` + middleware gate |
| `HR_OFFICER` role → sidebar: HR only | ✅ | 2026-05-18 `ROLE_SIDEBAR_ALLOW` + middleware gate |
| `OFFERTES` role → sidebar: Quotations, Contacts, Library, Projects (assigned) | ✅ | 2026-05-18 `ROLE_SIDEBAR_ALLOW` + middleware gate |
| `UserProjectAccess` table — many-to-many user↔project assignments | ✅ | 2026-05-18 Prisma `db push` |
| `/api/tenant/project-access` GET/PUT — project assignment CRUD | ✅ | 2026-05-18 |
| `ROLE_SIDEBAR_ALLOW` replaces `ACCOUNTANT_SIDEBAR_IDS` in AdminLayout | ✅ | 2026-05-18 — backward-compatible, ACCOUNTANT still in map |
| FREE-tenant activeModules default restricted to INVOICING only | ✅ | 2026-05-30 code change + DB count verification |
| Seat-billing wired into Stripe checkout & lifecycle with automatic quantity sync | ✅ | 2026-05-31 code change & checkout session validation |
| PDF Import integrations locked down under auth, plan checks, and quota metering | ✅ | 2026-05-31 parse-pdf route refactor + caller grace modals |
| FREE ticket scanning routed to client-side Tesseract OCR to completely bypass OpenAI fees | ✅ | 2026-05-31 code change & quota validation |
| Bestek database (db-bestek) read-only access enforced for PRO plan while allowing full editing for Enterprise | ✅ | 2026-05-31 code change & validation |
| CRM Sales page (crm/page) limits sales pipelines to 1 (db-crm) for PRO plan while allowing multiple for Enterprise | ✅ | 2026-05-31 code change & validation |
| FREE users on mobile viewport (<768px) are auto-redirected from AdminLayout to /m (client-side useEffect; no loop risk since /m uses MobileShell not AdminLayout) | ✅ | 2026-05-31 M1 implementation |
| /m bottom nav = Home/Invoices/Expenses/Clients/Quotes (5 tabs); Purchases removed from bar, still reachable at /m/purchases | ✅ | 2026-05-31 M1 MobileShell update |
| /m/expenses has two in-page tabs: Scans (default, Tesseract OCR) and Peppol Inbox (lazy-fetched from /api/peppol/inbox) | ✅ | 2026-05-31 M1 expenses page rebuild |
| /m/quotes page exists, reads from db-quotations via lockedDbIds, "New Quote" routes to full desktop engine | ✅ | 2026-05-31 M1 Part 6 |
| Profile completeness CTA on /m home hides when companyName+vatNumber+iban+(street or city)+logoUrl all present on tenant record | ✅ | 2026-05-31 M1 home page rebuild |
| PRO Users meter has NO hard cap (unlimited seats, Stripe-billed per extra seat); FREE hard-capped at 1 | ✅ | 2026-05-31 P8 billing UI fix |
| Billing upgrade CTA always reads "Upgrade to X"; no trial copy shown; immediate-billing note shown under button | ✅ | 2026-05-31 P8 + P10 billing UI |
| TRIAL_MODE_ENABLED = false in stripe.ts; checkout omits trial_period_days; cron routes early-return no-op; trial.ts + schema columns preserved for re-activation | ✅ | 2026-05-31 P10 implementation |
| isTrialing badge in BillingPageClient soft-fails to hidden when subscriptionStatus !== 'TRIAL' — no throw risk | ✅ | 2026-05-31 P10 measurement |
| Google Drive integrations secured: all endpoints (/api/drive, /api/drive/list, /api/drive/upload) require auth() validation & strict tenant folder/file traversal checks | ✅ | 2026-05-31 F1 implementation |

---

---

## Complete Module Registry (validated 2026-04-21)

The full set of modules enforced across middleware → AdminLayout → moduleGuard → superadmin toggle:

| Module key | Superadmin label | Routes gated |
|---|---|---|
| `INVOICING` | INV | financials, suppliers, library |
| `CRM` | CRM | contacts, email, tasks, sales, quotations |
| `DATABASES` | DB | databases |
| `PROJECTS` | PRJ | projects-management, files |
| `CALENDAR` | CAL | calendar |
| `HR` | HR | hr |
| `WEBSITES` | WEB | websites (frontend) |

**Rule**: any new module must be added to ALL FOUR locations simultaneously:
1. `src/middleware.ts` → `MODULE_GATE`
2. `src/components/AdminLayout.tsx` → `MODULE_MAP`
3. `src/lib/moduleGuard.ts` → route map
4. `src/app/[locale]/superadmin/TenantsGrid.tsx` → `MODULES` array

Missing from any one = invisible gap in enforcement.

---

## Tier Feature Tree (LOCKED — do not change without explicit user approval)

> **Last validated: 2026-05-13**
> This is the canonical reference. If code disagrees with this table, the code is wrong.
> FOUNDER and CUSTOM always bypass all gates (full access to everything).

### Plan Tiers

| | FREE | PRO (€29/mo) | ENTERPRISE (€99/mo) |
|---|---|---|---|
| **Billing** | Free forever | 3-month trial, then paid | 2-month trial, then paid |
| **Included seats** | 1 (hard cap) | Unlimited (Stripe-billed per seat) | Unlimited (Stripe-billed per seat) |
| **Workforce seats** | — | €4.99/seat | €1.99/seat |
| **Quarterly discount** | — | 5% (10% after 1yr) | 5% (10% after 1yr) |

> **Seat cap rule**: FREE plan hard-capped at 1 user in `PLAN_USER_LIMITS`. PRO/ENTERPRISE = Infinity — code never blocks. Stripe handles per-seat billing. Adding a seat mid-month invoices the current month; removing takes effect from next month.

---

### Module Access (`PLAN_MODULES` in stripe.ts)

| Module | FREE | PRO | ENTERPRISE |
|---|---|---|---|
| INVOICING | ✅ | ✅ | ✅ |
| CRM | ❌ | ✅ | ✅ |
| PROJECTS | ❌ | ✅ | ✅ |
| CALENDAR | ❌ | ✅ | ✅ |
| DATABASES | ❌ | ✅ | ✅ |
| TASKS | ❌ | ✅ | ✅ |
| HR | ❌ | ❌ | ✅ |
| WEBSITES | ❌ | ❌ | ✅ |
| EMAIL | ❌ | ❌ | ✅ |

**Enforcement**: middleware.ts → AdminLayout sidebar → moduleGuard.ts (server)

---

### Feature Flags (`FEATURE_FLAGS` in feature-flags.ts)

| Flag | FREE | PRO | ENT | Enforced in |
|---|---|---|---|---|
| `QUOTATION_LIBRARY_SEARCH` | ❌ | ✅ | ✅ | ClientQuotationEngine |
| `QUOTATION_SAVE_TO_LIBRARY` | ❌ | ✅ | ✅ | ClientQuotationEngine |
| `QUOTATION_PDF_IMPORT_LIBRARY` | ❌ | ✅ | ✅ | PDFImportModal |
| `QUOTATION_PDF_IMPORT_DEDUP` | ❌ | ✅ | ✅ | PDFImportModal |
| `PEPPOL_SEND` | ✅ | ✅ | ✅ | plan-limits.ts (volume-capped) |
| `PEPPOL_RECEIVE` | ✅ | ✅ | ✅ | plan-limits.ts (volume-capped) |
| `WHITELABEL` | ❌ | ❌ | ✅ | InvoicePDFTemplate, QuotationPDFTemplate |
| `WORKSPACE_USER_MANAGEMENT` | ❌ | ✅ | ✅ | Team settings |
| `CRM_PIPELINE` | ❌ | ✅ | ✅ | CRM page |
| `PROJECTS_GANTT` | ❌ | ✅ | ✅ | Projects page |
| `PROJECTS_BUDGET` | ❌ | ❌ | ✅ | Projects page |
| `CALENDAR_CUSTOM_ACCOUNTS` | ❌ | ❌ | ✅ | Calendar settings |
| `TASKS_ADVANCED` | ❌ | ❌ | ✅ | Tasks page |
| `HR_CONTRACTS` | ❌ | ❌ | ✅ | HR module |

---

### Volume Limits (`plan-limits.ts` + `stripe.ts`)

| Limit | FREE | PRO | ENTERPRISE |
|---|---|---|---|
| Peppol send/month | 5 | 20 | unlimited |
| Peppol receive/month | 10 | 30 | unlimited |
| Peppol docs/month (overage) | 50 | 250 | 1000 |
| Peppol overage price | €0.99/doc | €0.99/doc | €0.99/doc |
| OCR scan quota | 30 | 300 | unlimited |

**Peppol receive is NEVER blocked** — soft cap only, bookkeeping always continues.

---

### Component-Level Gates (hardcoded `planType` / `isPro` / `isEnterprise` checks)

| Component | What is gated | Gate type |
|---|---|---|
| `RecordDetailPage` | Full record detail view | `planType === 'FREE'` → locked |
| `NotionGrid` | Add Column button | `isPro \|\| isEnterprise` |
| `NotionGrid` | Row click → modal | `!isFree` |
| `FormulaColumn` | Edit formula | `isEnterprise` only |
| `AddColumnFlyout` | Enterprise column types | `enterpriseOnly && !isEnterprise` |
| `AdminLayout` | Upgrade CTA banner | `planType === 'FREE'` |
| `files/page` | File Manager | `isPro` |
| `library/articles/page` | Articles Library | `isPro` |
| `library/bestek/page` | Pricebook (Bestek) | `isPro` |
| `crm/page` | CRM module | `isPro` |
| `email/page` | Email module | `isEnterprise` |
| `DocumentTemplatesModule` | Stationery/templates | `planType: 'FOUNDER'` in preview |

---

### Schema Lock Rules

- **System databases** (invoices, expenses, contacts, suppliers, articles, bestek): schema is IMMUTABLE for all tiers
- **Custom databases**: schema editing requires `isPro || isEnterprise`
- **Schema self-healing**: `DatabaseClone useEffect` resets canonical properties on hydrate
- **4 entry points blocked**: Add column, Delete column, Rename column, Change type

### 🔴 HARD RULE — DATA SAFETY ON LIVE TENANT DATA (added 2026-07-12; Coral now holds real production books across tenants)
**Context:** Coral has 50+ real invoices + 295 receipts incoming + multiple tenants. A careless schema/data change now destroys real accounting data, for everyone. This rule BINDS the cron coder.
1. **Additive-only by default.** New system-DB properties are added ONLY by extending the canonical definition in `DatabaseClone` (additive; existing records read `null`), deployed via the gated pipeline. New Postgres columns must be **nullable, no destructive default backfill**. This is the ONLY sanctioned schema-growth path.
2. **NEVER, on a system DB / live data, without a fresh backup + explicit Florin approval:** drop / rename / re-type a canonical property or a Postgres column; transform or backfill existing rows; run `prisma migrate` against production; alter the self-healing canonical set in a way that overwrites existing tenant values. Self-healing + live data means a canonical-property change can silently wipe real data — treat it as radioactive.
3. **Migrations are Florin-gated (like develop→main).** The coder may WRITE a migration; it is RUN only by Florin, only AFTER a fresh DB snapshot, and only after a dry-run on a data copy (preview/branch). The cron coder NEVER runs a prod migration.
   - **3b. LOOPHOLE CLOSED (2026-07-27): the gate is on the OPERATION, not the word "migration".** No agent runs ANY schema-mutating Prisma command against ANY database — `db push`, `migrate dev`, `migrate deploy`, `migrate reset`, `--force-reset`, `--accept-data-loss`. `db push` bypassed this gate once already (the new `ClockEntry` columns went live with no migration file, leaving prod schema and repo history out of sync). Agents emit **reviewable SQL / a migration file**; Florin runs it.
   - **3c. `--accept-data-loss` is a STOP sign, never a convenience flag.** Prisma only demands it when the diff is **destructive**. "It's safe, the fields are additive" and "pass `--accept-data-loss`" cannot both be true — if the flag is needed, something is being dropped/re-typed and must be inspected before anything runs. Additive columns need no flag.
4. **Multi-tenant safety.** Any data migration is idempotent, dry-run on ONE tenant, verified, then rolled out — never a blind all-tenant transform. No cross-tenant bleed.
5. **Backup before any migration.** Take a Neon branch/PITR snapshot first; verify the restore path exists. No backup → no migration.
6. **UI rewrites that change how records are read/written** must preserve the existing on-disk shape (read old + new; never a save path that corrupts existing records). Verify against a copy of real data before shipping.
> **Posture shift:** the app has moved from "empty, move fast" to "real books, protect them." When a task's blast radius touches system-DB schema or existing rows, it stops being a normal coder task and becomes a Florin-gated, backup-first operation.

### 🔒 HARD RULE — TENANT-PARTITION ALL BROWSER-PERSISTED / SHARED CLIENT STATE (added 2026-07-12)
CoralOS leans heavily on **browser-persisted, browser-shared client state** — the IDB-persisted Zustand database store, the (planned) durable sync queue, the shared React-Query cache. Any of these that is made **more durable or more shared** becomes a **cross-tenant leak vector** unless it's bound to a tenant. Reflex rule for EVERY such change:
1. **Key/partition by `tenantId`** (and `userId` where per-user) — cache keys, store namespaces, queued-write tags. Never a generic key that spans tenants.
2. **Reset/clear on session boundary** — logout, tenant-switch, and impersonation start+stop must clear the store / queue / query cache so no previous tenant's state survives.
3. **Server writes trust the SESSION tenant** — every write + optimistic-concurrency read scoped `WHERE …tenantId = <session>`; never the client-supplied id alone.
4. **Impersonation isolation** — a superadmin impersonating a tenant must not let cached/queued state bleed back to the real tenant on exit.
#### ✅ TENANT + GATING CHECKLIST — run against EVERY feature before it ships (Florin, 2026-07-28: *"make sure ALL OF THIS is multi-tenant capable and properly gated"*)
Not optional, not per-spec prose. If a line can't be answered, the feature isn't done.
1. **Tenant from the session, never from the client.** No `tenantId` accepted as a query param, body field or header. On a fan-out/report endpoint a client-supplied tenant is a total-read primitive.
2. **Every read AND write scoped** `WHERE tenantId = <session>` — including each source in a multi-source query. `GlobalPage`-backed data scopes via `database.tenantId` (mirror `global-databases.ts:196-207`). *One unscoped source leaks that whole layer.*
3. **Settings and toggles are per-tenant** — never global, never per-deployment. (Applies to the approved-hours edit unlock, notification thresholds, scan quota, automation rules.)
4. **Persisted / shared client state keyed by tenant** and cleared on logout, tenant switch, and impersonation start+stop — IDB stores, Zustand persist names, React Query keys, sync queues. *(Past breaches: `calendar-storage-v1`, `coral-database-storage-v4`, untagged query keys.)*
5. **Intra-tenant RBAC, enforced server-side.** Isolation is necessary, not sufficient. Owner/admin · team lead (their team) · workforce (self only). Never enforced by hiding UI. Sensitive fields — **cost rates, other workers' absences, financials** — are role-gated on the server.
6. **Exports and downloads inherit the caller's scope.** A lead's "export all" silently means *their team*. An export that looks complete but isn't is worse than one that fails.
7. **Files, attachments, photos, documents** served through the authenticated route with a tenant check — never a bare blob key or public URL. *(Past: `RECEIPT-BONNETJE-LINK`.)*
8. **Deeplinks and record ids verified on open** — a foreign-tenant id must 404, not render.
9. **Outbound side-effects carry the right tenant** — email (protest, intake), Peppol sends, webhooks. Never another tenant's document on an outgoing mail.
10. **External account bindings are per (user × tenant)**, not per user — OAuth tokens (Google, Resend inbound) must not surface across tenants, and are **unavailable during impersonation**.
11. **Impersonation is a boundary**, not a convenience: nothing cached, queued or unlocked may bleed back to the real tenant on exit.
12. **Audit rows record `tenantId` + actor** — approvals, rate restamps, admin edits, protests, migrations.

> Rule of thumb: "durable OR shared client state" + "no tenant tag" = a leak. If a fix makes writes more reliable or a cache more shared, it MUST ship with the matching tenant partition + clear-on-switch, or it turns a data-loss bug into a data-leak bug (strictly worse). Applies to DATA-PERSIST-INTEGRITY, ADMIN-QUERYCLIENT-PROVIDER, and anything future touching the store/cache/queue.

### 🔔 HARD RULE — FORCING FUNCTIONS: THE SYSTEM MUST DO THE NOTICING (added 2026-07-27)
**Context (Florin):** *"the hand is quicker than the eye — some things, if nothing forces me to notice, will slip away."* Correct diagnosis. With a cron coder shipping faster than any human reviews, **vigilance is not a control.** Every defect class that has actually hurt this app was *silently wrong*, not loudly broken. So: wrongness must be made impossible to ignore, at the moment it happens.
1. **Fail loudly, never silently.** Any `.catch(console.error)` on a **user-visible action** is a defect. A setting that fails to save must toast/badge, not vanish. *(Origin: `syncDb` swallowed save failures — column visibility "didn't stick" for weeks with zero signal.)*
2. **Gate the build on typecheck.** `build` MUST run `tsc --noEmit`. Scripts that exist but aren't wired into the gate protect nobody. *(Origin: three separate missing-import/hook crashes took the app down while `test:compile` sat unused in `package.json`.)*
3. **Invariants ABORT, they don't warn.** On any structural write: assert and **refuse to persist** on violation — block-count + id-set before/after a drag; "a pure reorder must not change the document total"; a tenant mismatch **errors** rather than filtering to zero rows. Silently-wrong → loudly-broken is always the better trade.
4. **Visibility canary — DB truth vs UI truth.** A health check comparing **row counts in the database** against **what the app's own queries return**. *(Origin, 2026-07-27: 69 shifts + 20 clock entries sat intact in prod while the UI rendered 1 — a full day was spent believing the data had been destroyed. The bug class here is not data LOSS, it is data becoming INVISIBLE: identity mismatches, over-broad filters, tenant scoping, hydration races. A count gap should scream on the morning after a deploy.)*
5. **Absence of state ≠ never configured.** Never infer user intent from missing data during hydration; record an explicit marker instead. *(Origin: mount-time default-seeding re-hid columns the user had unhidden — and persisted it.)*
6. **Characterization tests before touching money paths.** Pin CURRENT behaviour first (totals, VAT per regime, `brutoPrice→marge→verkoopPrice`, block-tree flatten/build round-trip, the OCC merge matrix), then change code and prove them green. There are currently **zero tests** — `test:compile`/`test:lint` check shape, not meaning, and every bug this codebase has produced typechecks perfectly.
> **Rule of thumb:** if a defect could survive a busy week without anyone noticing, the fix isn't "look harder" — it's a check that stops the process. Prefer a loud failure now over a quiet corruption discovered at year-end.

### 🔁 HARD RULE — READ BACK WHAT YOU WROTE, THEN SELF-DEBUG (added 2026-07-27) — BINDS THE CRON CODER
**Context:** the single most expensive defect class here is not hard logic — it's **the coder's own mechanical mistakes shipping unread**: three missing-import/hook crashes took the app down (`useEffect is not defined`), a broken import produced React #130 in both engines, a TDZ error killed the quotations engine. All were visible in the file. Nobody looked.
**Before reporting ANY file edit as done:**
1. **Re-READ the post-edit file** — the actual current content, not your memory of the intended change. **Diff-blindness is the failure mode:** an agent believes the edit applied as designed. Verify the code that is *there*.
2. **Run the mechanical checklist** over what you touched:
   - **Imports:** every symbol used is imported; every import path resolves to a real export; **default vs named** matches the source *(→ React #130)*.
   - **Hooks/react:** `useEffect`, `useState`, `useMemo`… actually imported *(→ the WorkHub crash)*.
   - **Declaration order:** nothing referenced before it is defined *(→ the TDZ crash)*.
   - **Dangling references:** after deleting code, no leftover use of a variable/prop/import that no longer exists.
   - **JSX balance:** removing a wrapper element leaves tags matched *(high risk when stripping `<Droppable>`/providers)*.
   - **Prop contracts:** if a component's props changed, **every call site** is updated.
3. **Then** run `npx tsc --noEmit` and `eslint`. In that order — read-back first, because a typecheck confirms *shape*, not that your edit landed as intended, and a **half-applied edit can still compile**.
4. **Never report a change you have not verified in the file.** Claiming "the blind reload was already removed" when `GlobalDatabaseSyncer.tsx:149` still contained it cost a full review cycle. If output truncation forced a partial edit, **say so plainly** and stop — a truncated file reported as complete is worse than an unfinished task.
5. **Same rule for claims about the codebase.** Before asserting a file/line/behaviour exists, open it. Assertions from memory are how wrong plans get approved.
> **Copy-paste directive for the coder:** *"After every file you edit: re-read the file as it now stands, check your own imports, hook imports, declaration order, dangling references, JSX balance and prop call-sites, then run `tsc --noEmit` and lint. Report what you verified, not what you intended. If an edit was truncated or partially applied, say so and stop."*

### 🌐 DIRECTIVE — LOCALISATION: A STRING NEVER SHIPS WITHOUT A VALUE (Florin, 2026-07-29)
> *"The first translation will be good, acceptable or replaceable — but there IS one, and we can always edit one key."*

**The rule:** a rough Dutch word is fine. A raw key on screen (`Hr.timesheets.title`) is a shipped defect. Perfection is optional; **presence is not**. Recurred three times in two days (timesheets page, entry-detail labels, untranslated toasts) — so it is enforced by mechanism, not intention.

**The how — four mechanisms, in order of strength:**
1. **Definition of done.** A UI change is not done until every `t()` key it introduces has a value in **en + nl + fr**. Same commit, no follow-up ticket. English written properly; NL/FR may be a first-pass draft — mark doubtful ones for Florin's review, but never leave them absent.
2. **Automated guard — `tests/i18n.test.ts` (built, running).** Fails the suite when:
   - any `t('…')` in `src/` resolves to a key that exists in **no** locale file *(this is the check that matters — parity was green while the timesheets page rendered every label as its own variable name, because the keys existed nowhere at all)*;
   - `en`/`nl`/`fr` key sets drift apart;
   - any locale contains an empty string value.
   `ro` is tracked and reported but not enforced (currently 104 keys behind). Promote it by adding `'ro'` to `ACTIVE_LOCALES`.
3. **Fallback chain, not key-path output.** Configure next-intl's `getMessageFallback` so a missing key renders the **English** string, never the dotted path. Worst case becomes an untranslated word — noticeable but usable — instead of debug output in front of a client.
4. **No hardcoded user-facing strings.** Every visible string goes through `t()`. Half-translated is worse than either extreme: it looks correct in EN and broken in NL. *(Seen live: "Period", "All Workers", "Flat", "By worker" hardcoded beside translated siblings; toast `Verplaatsen mislukt: document integriteit geschonden` untranslated.)*
> **Also applies to toasts, errors, empty states, confirmations and PDF/export labels** — not just visible chrome. Error paths are the least-translated and the most-seen-under-stress.

### 🧭 DESIGN PRINCIPLE — THE USER IS THE AUTHORITY (Florin, 2026-07-28)
> *"Automation is good, but the user remains the ultimate authority. The software is the tool, not the other way around. We build software for human use, not inviting humans for software use."*

This governs every *"should the system decide this?"* question. The answer is: **the system surfaces, the person decides.**
1. **Surface, don't filter.** Don't suppress information because the software judged it unimportant (a price change below some delta, a "probably fine" duplicate, a low-confidence scan). Show it; let Florin dismiss it in a second. A hidden signal can't be reconsidered.
2. **No hard-coded thresholds or policies.** If a cut-off is ever wanted, it is a **user setting**, never a constant compiled into behaviour. Ship without it until asked.
3. **Automate the work, not the judgement.** Matching, extracting, aggregating, drafting — automate freely. **Deciding** — approving hours, posting to the books, repricing the library, sending a protest, paying an invoice — stays a human action. (Already applied: receipts never auto-post; protests never auto-send; articles never auto-reprice; invoice lines never auto-match.)
4. **Defaults must be the least-destructive option**, and reversible where possible.
5. **Don't infer intent from how something was phrased.** If a requirement is ambiguous, ask plainly or implement the literal reading and say which. Reading between the lines of the person you're building for is not analysis, it's presumption.
> Practical test: if a feature would be described as *"the system will handle that for you"* on something with money, hours, or a client attached — stop. It should read *"the system shows you, you decide."*

### ✅ PRE-PROMOTION BACKUP CHECKPOINT (run every time before develop→main)
Muscle-memory checklist — do this before promoting to production, no exceptions:
1. **Snapshot.** Take a Neon branch / PITR snapshot of prod. Note its name + timestamp.
2. **Note the commits.** Record the commit hash being promoted (the known-green one) AND the current `main` hash (your rollback target).
3. **Green?** Confirm that exact commit is build-green on develop/preview — never promote a mid-red intermediate.
4. **Blast-radius check.** Does this promotion include any schema/data change? Additive-only (new nullable field via canonical def) → OK. Drop/rename/re-type/backfill/`prisma migrate` → STOP: that's a Florin-gated, backup-first migration, not a promotion.
5. **Promote** develop→main.
6. **Smoke test on prod.** Load it and watch it work: an invoice opens, a receipt opens, login/gating for a workforce user. "Nothing is done until I watch it work."
7. **Rollback ready.** If broken: revert `main` to the noted previous hash; if data was touched, restore from the step-1 snapshot.

---

### PDF Watermark Rules

- FREE + PRO: "Powered by CoralOS" watermark on all generated PDFs
- ENTERPRISE: watermark removed (`WHITELABEL` flag)
- FOUNDER + CUSTOM: watermark removed (bypass all gates)

---

*Written: 2026-05-13. Author: Florin + Antigravity.*
*This file is a living document. Update the premises table after each validated change.*

