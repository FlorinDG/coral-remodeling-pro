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

### Rule 6 — No Build Blockers in Ship
> Before pushing: `npx eslint [changed files]`. Zero errors. Not warnings — errors.
A broken build deployed to Vercel serves the last good build silently.
That is the most dangerous failure mode: you think you fixed it, but you didn't.

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
- [ ] `curl -D -` the affected domains — is what's live actually what we think?
- [ ] Ask: what is the user currently relying on that must not break?
- [ ] Only then: plan the new work

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

---

---

## Complete Module Registry (validated 2026-04-21)

The full set of modules enforced across middleware → AdminLayout → moduleGuard → superadmin toggle:

| Module key | Superadmin label | Routes gated |
|---|---|---|
| `INVOICING` | INV | financials, quotations, suppliers, library |
| `CRM` | CRM | contacts, email, tasks, sales |
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

## On Tier-Based Feature Separation Within Modules

The toggle is **binary** (module: on / off). It answers: *can this tenant enter the module?*

Plan type (`FREE`, `FOUNDER`, `PRO`, etc.) answers: *what feature depth do they get inside?*

These are **orthogonal** — a 2D access matrix:

```
                FREE          FOUNDER/PRO
INVOICING ON:   Basic inv     Full + Peppol quota
CRM ON:         Contacts      + Email + Sales + Advanced
DATABASES ON:   Basic         + Advanced formulas
WEBSITES ON:    Single site   + Multi-site
```

**Current enforcement**:
- Module access (row): middleware + AdminLayout sidebar + moduleGuard
- Feature depth (column): `planType` checks inside individual pages/components

**Known gap**: `planType` checks are not consistently implemented across all module pages.
When a module is toggled ON for a FREE tenant, they may get FOUNDER-level features
because the component doesn't check `planType`. This is technical debt to address
module-by-module as each is hardened for production use.

---

*Written: 2026-04-21. Author: Florin + Antigravity.*
*This file is a living document. Update the premises table after each validated change.*
