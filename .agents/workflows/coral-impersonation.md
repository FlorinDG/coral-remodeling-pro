# CORAL — IMPERSONATION — the one door through the seraph — Planner 2026-09-19

**Florin, 2026-09-19:**
> *"This will have to become a solid solution, with clear visual indicator for the operator which tenant is impersonated, and that the impersonation is actually active. Guards and safety measures. We need to plan it. We do not move until it is properly planned: what do we need in the kernel, what do we need in the core, and so on. If easier to implement, we can view it as a module, or a standalone."*

**Planned, not scheduled.** Sits with `R1` — see ORDER.

---

## 📌 FIRST, THE ANSWER TO "MODULE OR STANDALONE": **NEITHER.**

**Impersonation belongs IN the seraph.** It is not a feature that *uses* the gate — it is **the gate answering its own question**: *which tenant is acting?* Normally the answer comes from the session. Under impersonation it comes from a grant. **Same question, second source.**

Built as a module it would sit **beside** the gate rather than inside it — which is precisely the `time-tracker` mistake (`coral-locale-dates.md`): a component that arrived next to the primitives instead of below them, and kept its own copies. **A module that can change the acting tenant is not a module; it is a hole in the gate with a menu on it.**

So: **`R1` builds the resolver, and impersonation is one of its two inputs.** Not an add-on, not a wrapper, not a standalone.

---

## WHAT EXISTS TODAY — the foundation is sound, the semantics are backwards

```ts
superadmin.ts:132  impersonateTenant(tenantId)
  → verifySuperadmin()
  → cookie IMPERSONATION_COOKIE = tenantId, httpOnly, secure, sameSite:lax, maxAge 4h
superadmin.ts:157  stopImpersonation() → delete cookie
```
**Good:** httpOnly · secure · a 4-hour cap already exists · guarded by `verifySuperadmin` · `session.user.isImpersonating` is typed and plumbed through.

### 🔴 THE DEFECT OF PRINCIPLE — impersonation currently grants MORE, not less
```ts
tenant/users/route.ts:103   if (!isAccountantInvite && maxUsers !== Infinity && !isImpersonating)   // skips the seat limit
tenant/expenses/approve:33  if (!isImpersonating && !['ENTERPRISE','FOUNDER','CUSTOM'].includes(plan)) // skips the plan gate
```
**An impersonating operator can do things the tenant themselves cannot.** That is backwards, and it breaks the promise the service model is sold on — *"I work in their environment"*. If the operator can exceed the tenant's plan, they are not working in that environment; they are working above it.

> **RULE: impersonation is a CHANGE OF IDENTITY, NEVER AN ELEVATION OF PRIVILEGE.**
> The operator sees and does exactly what that tenant's plan and role permit. **Less, never more.**

### Also missing
- **No audit entry.** `AuditLog` exists with `actorUserId` — **nothing writes to it on impersonate/exit.**
- **No consent.** A superadmin enters any tenant unilaterally.
- **No attribution on writes.** A quote written during impersonation is indistinguishable from one the client wrote.
- **Indicator unverified** — `admin/layout.tsx:175` passes `isImpersonating` onward; what it renders needs checking.

---

# THE WALK DOWN THE STACK

## 🔑 TWO ROLES, AND THEY MUST BE TWO **MODES** — Florin, 2026-09-19

> *"It will have two roles — operator and system admin. The system admin WILL HAVE unlimited access to be able to perform needed operations; operator will have the tenantID.current use access."*

**Correct, and it corrects the spec:** my prohibitions below were written as *"whoever you are"*, which would have blocked legitimate platform work — a broken tenant, a billing correction, a stuck provisioning.

| | **OPERATOR** | **SYSTEM ADMIN** |
|---|---|---|
| What it is | **Acts AS the tenant.** Identity swap. | **Acts ON the tenant.** Platform administration. |
| Sees / does | Exactly what that tenant's plan and role allow. **Less, never more.** | Whatever the operation needs. |
| Typical work | Writing quotes, entering documents, doing the client's work | Fixing provisioning, billing, plan changes, repairing data |
| Prohibitions below | **Apply in full** | **Do not apply** — this mode exists precisely for them |
| Audit | `impersonate.*` — entering someone's workspace | `admin.*` — an operation performed on a tenant. **Different act, different record.** |

### ✅ SUPERSEDED — FLORIN'S BETTER VERSION: **SEPARATE USER SCOPES, NOT MODES** (2026-09-19)

> *"What if we split them as logic? Impersonation stays as operator role and is always invariably limited in scope to the current environment on which the operator is active at the specific moment, and admin keeps that impersonation 'mode', stays admin, and the two do not mix in any way? Avoid having to make any sort of determination, just keep them in separate user scope."*

**Take this over the two-modes design below.** Two modes on one account still requires a **determination at runtime** — which mode is this, was it chosen correctly, is the indicator right. **Two user scopes remove the question entirely.** Same principle as the identity directive: *do not guard the bad path; remove the ability to express it.*

| | **OPERATOR account** | **ADMIN account** |
|---|---|---|
| Relationship to a tenant | Acts **AS** it — impersonation, scoped to the one tenant currently active | Acts **ON** it — by id, from the platform surface |
| Impersonation | **This is its only capability** | **Never impersonates at all** |
| Can it elevate? | **No** — its role has no admin capability to reach for | n/a — it is already the admin |
| Surface | The tenant's own ERP | The superadmin panel |
| Audit actor | that operator user | that admin user |

### 🟢 THE CODEBASE ALREADY WORKS THIS WAY — and that is the strongest argument for it
**All 11 functions in `superadmin.ts` already take `tenantId` as a parameter** — `updateTenantSubscription(tenantId, …)`, `deleteTenant(tenantId)`, `setTenantOcrEngine(tenantId, …)`. **The admin has never needed to *become* a tenant to administer one.** It operates on tenants by id and always has.

**So `impersonateTenant` does not belong in `superadmin.ts` at all.** It is the operator's capability, sitting in the admin's file because that was the only privileged place to put it. Moving it out is not a refactor — **it is the design becoming what the code already implies.**

- [ ] **New platform role: `TENANT_OPERATOR`.** Its only privilege is to start an impersonation into a tenant that has granted access. **It has no superadmin capability to be bypassed, because it does not have one.**
- [ ] **`impersonateTenant` / `stopImpersonation` move out of `superadmin.ts`** into the seraph, guarded by the operator role.
- [ ] **Admin accounts cannot impersonate.** Not "should not" — **cannot**. Remove the capability from that role entirely.
- [ ] **Florin holds two accounts.** Daily client work happens on the operator account.
- [ ] 🟢 **The friction is the feature.** Having to switch accounts to change a plan means that act is deliberate, separately authenticated and separately logged — instead of one click away while writing someone's quote.
- [ ] **`acting-scope` gets simpler, not harder:** the operator's scope is *the granted tenant*, the admin's is *the platform*. **Nothing asks "which mode".**
- [ ] The indicator now only ever has one thing to say: **which tenant the operator is inside.** No mode to display, no mode to get wrong.

**What this costs:** account switching, and a genuine edge case — an operator meets something only an admin can fix, and must switch. **That is the correct outcome**, not a workaround.

---

### 🔴 THE TRAP THIS AVOIDS — *(kept for the record; the modes design below is superseded)*
**If system admin is built as "impersonation, plus more", the elevation defect comes straight back** — and every `if (!isImpersonating)` bypass we are removing returns wearing a better name. That is exactly how `tenant/users:103` and `expenses/approve:33` came to exist.

> **RULE: ROLE decides what you MAY do. MODE decides what you ARE doing.**
> **They are two separate entries, not two values of one flag.**

- [ ] **Two distinct entry points**, chosen explicitly. **Never inferred from the role.**
- [ ] 🔴 **Florin will hold both roles.** So the mode must be a **deliberate choice at entry** — otherwise he is permanently in the powerful one by accident, and "operator" never actually gets exercised. **Defaulting to the weaker mode is the safety feature.**
- [ ] **No switching modes mid-session.** Exit, then re-enter. A session is one mode from start to finish.
- [ ] **The indicator states the MODE, not just the tenant** — and the two look unmistakably different. *"OPERATOR — Acme BV"* vs *"SYSTEM ADMIN — Acme BV"*, different colours. **Knowing which one you are in is the whole point.**
- [ ] `acting-scope` returns the mode as part of the scope. **Business logic never asks "am I impersonating"; it asks the scope what is permitted.**
- [ ] **System-admin sessions are shorter, not longer.** Unlimited power, minimal duration.

---

## L0 · KERNEL — one primitive
- [ ] **`lib/kernel/acting-scope.ts`** — resolves *who is acting* from **one** of two sources:
  1. the session's own tenant, or
  2. a **valid, unexpired, consented impersonation grant**.
- [ ] **It returns a scope, never a boolean.** `isImpersonating` as a flag is what produced the elevation defect — **a flag invites `if (!isImpersonating)`, a scope does not.**
- [ ] The grant is **signed and expiring**. A cookie holding a bare tenantId is a bearer token for someone else's company. **Sign it, bind it to the operator's session, keep the 4h cap.**
- [ ] **Nothing else.** No storage, no messaging.

## L1 · ERP CORE — two capabilities, both mostly present
- [ ] **Grant lifecycle** — create · read · revoke · expire. Stored, not just a cookie: **the client must be able to see and revoke it from their side.**
- [ ] **Audit, using `AuditLog` as it stands.** `actorUserId` + `tenantId` + `action: 'impersonate.start' | 'impersonate.end'` + `reason`. **No new table.**
- [ ] 🔴 **Attribution on every write.** A record created under impersonation carries the **real operator**, not only the tenant. *(This is what makes Florin's "perfectly traceable" true rather than aspirational — and it is the same actor-stamping `LOCK-6` already added to the accountant export. One mechanism, two callers.)*

## ⛨ SERAPH — where it lives
- [ ] **`resolveActingTenant()` is the only place impersonation exists.** Every scoped read and write goes through it and **cannot tell** which of the two sources answered.
- [ ] **Fail closed:** an expired, revoked, unsigned or unmatched grant resolves to **the operator's own tenant**, never to the target. **Never to "no tenant" either** — that is how an unscoped query gets born.
- [ ] 🛑 **Prohibited in OPERATOR mode** *(system admin mode exists for exactly these — see the two-modes section above)*: change billing or plan · delete the tenant · change the owner's credentials · invite or remove users · export the full dataset · **start a nested impersonation.**
  **These are the acts of an owner, not an operator.** If one is genuinely needed, the tenant does it, or it happens outside impersonation with its own audit.
- [ ] **`tenant-isolation.test.ts` gets impersonation cases**: an expired grant reaches nothing; a grant for tenant A gives no access to tenant B; **an operator inside tenant A cannot read their own tenant's data** — the swap is total.

## ⛨ MODULE GATE — who may, and into which tenants
- [ ] **Who:** platform roles only (`verifySuperadmin` today). **Correct as it stands.**
- [ ] 🔴 **Which tenants: the ones that have granted it.** Not "all of them".
  **This is the design decision that makes the business model defensible.** Under quoting-as-a-service the client has *asked* for the work — **so a consent artifact already exists in the real world.** Make it exist in the software: the tenant grants support access, sees that it is active, and can revoke it.
  **And it is a selling point, not a constraint:** *"nobody can enter your workspace without your grant, and you can see every time it happened."* **A competitor's superadmin can silently read everything. Yours cannot.**
- [ ] **Scope of grant:** open-ended-until-revoked, or per-session with a duration. **🛑 Florin decides.** *(Planner leans: granted open-ended for service clients, but each entry still audited and still expiring at 4h — so the grant is standing, the session is not.)*

## 🔴 OPERATOR SESSION LOGGING — Florin, 2026-09-19

> *"Operator sessions in impersonation mode must be tracked. We need a very precise log of everything done, stamped with all possible recognition stamps. It is on tenant liability, and it is a guarantee for the tenant."*

**Both halves of that sentence matter, and they pull the same direction.** The records belong to the tenant and carry *their* legal exposure — an invoice written by an operator is the tenant's invoice. So the log is **not** an internal safeguard that happens to be visible; **it is a deliverable, and the tenant is its audience.**

### What is logged
- [ ] **The session:** start, end, operator identity, tenant, grant used, duration, IP, user agent. `AuditLog` with `action: 'impersonate.start' | 'impersonate.end'`.
- [ ] 🔴 **Every WRITE, individually.** Not "an operator was here for 40 minutes" — **which record, which field, before and after, at what time, by whom.** `AuditLog` already has exactly this shape (`entityType`, `entityId`, `action`, `field`, `before`, `after`, `reason`). **Use it as it stands; add no second table.**
- [ ] **Every outbound act**, because those leave the building and cannot be undone: invoice sent · Peppol transmitted · quote sent · accountant export run · document archived. **Who triggered it, to whom, when.**
- [ ] **Attribution on the record itself**, not only in the log — so a page shows *"prepared by Florin (operator), 19/09"* without anyone querying an audit table.
- [ ] **Reads of sensitive collections** are worth recording too — the accountant export, a full CSV. **Not every page view**; a log nobody can read is not a guarantee.

### The rules that make it trustworthy
- [ ] 🛑 **Append-only. No edit, no delete, by anyone — operator, admin, or superadmin.** A log the operator could alter is worth nothing to the tenant, and worth less than nothing to Florin the day it is questioned.
- [ ] 🛑 **If the log write fails, the action fails.** Same ordering as `DOC-ARCH-1` (archive before send) and `BLOB-4`: **never perform an act you cannot record.** An unlogged operator write is exactly the case this exists to prevent.
- [ ] **The tenant can see it, unprompted and unfiltered** — their own surface, their own language, readable by a builder rather than a developer. **Exportable**, since it may be evidence.
- [ ] **Retention outlives the engagement.** The log must survive the operator's access being revoked and the relationship ending. *(Belgian accounting records run to 7 years; worth aligning and worth confirming with an accountant.)*
- [ ] **Clock stamps in UTC, displayed in local time** — `LOC-1`. A disputed timestamp that shifts with DST is a disputed timestamp.

### 🔵 THE OPERATOR ROLE IS NOT HYPOTHETICAL — Florin, 2026-09-19
> *"By the time we need to handle scaling, I will have a trained junior for mid-level admin tasks."*

**That junior IS the operator role.** Not a shared login, not Florin's account used by someone else — **a separate user with operator scope**, which is precisely why the separate-user-scope design matters more than the two-modes one. It stops being theoretical on the first hire.

- [ ] **The junior gets an operator account and no admin account** — so the capability they lack is the one nobody can pressure them into using "just this once".
- [ ] 🟢 **The append-only log protects the junior most of all.** It proves what they did **and what they did not**. When a tenant queries something, the answer is not one person's word against another's — it is a record neither party can alter. **That is what makes it safe to give a junior real access instead of hovering over every action.**
- [ ] Every log entry already carries `actorUserId`, so junior and Florin are distinguishable from day one **without any additional work.**

### Why this is a selling point and not overhead
**"Every action taken in your workspace by anyone other than you is recorded, visible to you, and cannot be altered — including by us."** That is a stronger guarantee than most SaaS can make about their own support staff, and it is the natural companion to consent-based access. **The liability argument and the marketing argument are the same argument.**

## L3 / L4 · THE LEAF — the indicator
- [ ] 🔴 **Impossible to miss, impossible to dismiss.** A persistent band — not a toast, not a badge tucked in a corner. **Every page, including mobile.**
- [ ] It states **three things at once**: that impersonation is **active**, **which tenant** by name, and **how long remains**. *(Florin's own requirement: "which tenant is impersonated, and that the impersonation is actually active.")*
- [ ] **Exit is always one click from anywhere**, in the band itself.
- [ ] **Visually unmistakable** — a distinct colour reserved for this state and used for nothing else.
- [ ] **The client's side too:** the tenant sees a support-access log — when, who, how long. *"Florin prepared this quote on 19/09."* **Traceability is only a feature if the client can see it.**
- [ ] 🛑 **If the band cannot render, impersonation must not start.** A silent impersonation is the failure mode that ends the business.

---

## ORDER
**This is `R1` work, not a successor to it.** `acting-scope` *is* the resolver's second input — building the resolver without it means opening it again immediately.

1. **`R1-2`** fail-closed resolver — built with **both** inputs from the start.
2. **Grant lifecycle + audit** (L1) — small, `AuditLog` already exists.
3. **Remove the elevation** — `isImpersonating` stops bypassing limits. **This is a bug fix and could go earlier; it does not depend on anything.**
4. **The indicator** — before the first real client, not after.
5. **Consent + the client-side log** — before the first *external* tenant.

**Nothing here starts before promotion.**

## PROHIBITIONS
- **No `isImpersonating` boolean in business logic.** Resolve a scope.
- **No privilege elevation under impersonation. Ever.**
- **No impersonation without an audit entry.**
- **No nested impersonation.**
- **No unsigned grant.**
- **No impersonation without the indicator rendered.**
