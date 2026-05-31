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

## Staged Release Workflow (Develop → Test → Release)

All development and release operations must adhere to this structured flow to prevent production regressions:

1. **Active Development**:
   - All feature work, bug fixes, and refactoring occur exclusively on the `develop` branch.
   - **Never push directly to `main`**.
   - Pull Requests (PRs) from topic branches (e.g., `feature/*` or `bugfix/*`) must target and merge into `develop`.

2. **Testing & Staging**:
   - When a version is ready, branch a release candidate: `git checkout -b release/vX.Y.Z develop`.
   - Vercel automatically deploys the release candidate to the Staging environment.
   - Run full manual and automated sanity checks in Staging before final approval.

3. **Release & Production**:
   - Merge `release/vX.Y.Z` into `main` using a non-fast-forward merge: `git merge --no-ff release/vX.Y.Z`.
   - Tag the release commit with its semver tag: `git tag -a vX.Y.Z -m "Release description"`.
   - Push `main` and its tags: `git push origin main --tags`.
   - Vercel automatically deploys `main` to the Production environment.
   - Merge `main` back into `develop` to sync release tags and hotfixes: `git checkout develop && git merge main && git push`.

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

---

### PDF Watermark Rules

- FREE + PRO: "Powered by CoralOS" watermark on all generated PDFs
- ENTERPRISE: watermark removed (`WHITELABEL` flag)
- FOUNDER + CUSTOM: watermark removed (bypass all gates)

---

*Written: 2026-05-13. Author: Florin + Antigravity.*
*This file is a living document. Update the premises table after each validated change.*

