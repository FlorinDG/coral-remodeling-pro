# CORAL — WORKHUB · THE STRUCTURE — Planner 2026-09-27

> **Florin:** *"keep in mind and plan for, what needs to be kernel, core, seraph, because all of this is tenant aware. it is also meant to work as a standalone onto the crew phone, with zero visible connection with the actual erp."*

Governed by `coral-workhub-scope.md` (the measurement) and `coral-kernel-system-databases.md` (the layering).

---

# 0 · THE SENTENCE THAT DETERMINES THE STRUCTURE

> **Two products, one core.**
> **WorkHub** is the crew's phone app. **HR** is the employer's back office. **They share records and share nothing else.**

Today they are one tangled module, which is why a worker's logout button lived in a file the employer's timesheet page also imports. **Separating them is the structure.**

## What "zero visible connection with the ERP" demands
| Requirement | State |
|---|---|
| own PWA manifest | ✅ `public/manifest-workhub.json`, served on the `work.` subdomain |
| own route tree | ✅ `/workhub/**`, distinct from `/admin/**` |
| own shell, no ERP chrome | ✅ `WorkHubShell` |
| own language set | ✅ own i18next instance — **en · nl · fr · ro · ru** *(the crews)* |
| 🔴 **no ERP vocabulary in payloads** | **NOT DONE** — the HR API returns enriched objects shaped for the back office |
| 🔴 **no ERP surface reachable by URL** | **UNAUDITED** |
| 🔴 **offline-first** | **partial** — the phone is on a site with no signal |
| 🔴 **a worker cannot reach the tenant's other data, even by hand** | **actor reach is not enforced structurally** |

🟢 **The shell of the standalone product exists. The boundary does not.**

---

# L0 · KERNEL — pure, tenant-free, no I/O

**The kernel of this module is TIME.** Not shifts, not schedules — the arithmetic of worked time.

- [ ] **`duration`** — clock-in/out → payable minutes, **including the break rule** *(>4h ⇒ deduct 30 min, `noBreak` suppression, the 4h boundary)*. 🟢 **Already pure and already tested** — `tests/duration.test.ts`. **This is the model for everything else.**
- [ ] **Identity minting** — ids for shift, entry, attachment. Server-side, opaque *(`KERN-3b`, `KERN-5`)*.
- [ ] **The offline intent queue** — *"record this action locally, replay it when there is signal."* **A write primitive, not an HR feature.** The ERP store needs the same thing *(`R2-4`)*. 🔴 **One queue, or the phone and the desk will disagree about what happened.**
- [ ] 🛑 **A negative duration is a kernel refusal, not a UI check.** *(`CLEAN-11`: entry `cmrm3n2rd` holds **−2.00 hours and is approved**. Nothing refused it.)*

🛑 **No tenant, no user, no Prisma in the kernel.** If it needs to know who is asking, it is not kernel.

---

# SERAPH · the tenant gate — unchanged, and it already covers this
`scope` carries the tenant privately; the tenant is never a parameter *(`TSC-0 D3`)*.
- Every workhub record is Class A or B: `ScheduledShift`, `ClockEntry`, `TimeOffRequest`, `WorkerSchedule` are **direct**; `ShiftTask`, `ShiftAttachment`, `HrTeamMember`, `TimeEntry` are **via parent** *(`TSC-9`'s table already classifies all of them)*.
- 🟢 **Nothing new is needed here.** The workhub is an ordinary consumer of the gate — **which is the point of having built it.**

---

# THE TWO PEER GATES BELOW THE SERAPH

**Florin's original map: *"kernel → core → TENANT GATE → module → other gates → submodule → leaves."*** These are the other gates. **Both sit below the tenant gate and beside each other.**

## GATE 1 · ENTITLEMENT — *what did this tenant buy?*
`scope.may('HR', 'shifts')` — designed in `coral-submodule-entitlement.md`. HR's submodules: **employees · shifts · timesheets · leave**.
- 🟨 **WorkHub is not a submodule of HR — it is the SURFACE on which HR's submodules appear to a worker.** A tenant with HR gets both surfaces; entitlement decides which submodules exist on each.
- **Open:** does WorkHub need its own entitlement, or is `HR` sufficient? *(Florin's call — `ENT` open item.)*

## GATE 2 · 🔴 ACTOR REACH — *whose data may THIS PERSON see?*
**This is the gate the crew app cannot work without, and it does not exist structurally.**

A worker may see **their own** shifts and entries. A team lead may see **their team's**. An HR officer may see **the tenant's**. **Same tenant, three reaches.**

### The primitive exists and is broken
```ts
// src/app/api/hr/lib/team-scoping.ts
export async function getAccessibleUserIds(tenantId: string, userId: string) {
    const ledTeams = await prisma.hrTeamMember.findMany({
        where: { userId, role: 'lead' },        // 🔴 no tenant
    });
    const teamMembers = await prisma.hrTeamMember.findMany({
        where: { teamId: { in: teamIds } },     // 🔴 no tenant
    });
}
```
🔴 **`tenantId` is a parameter and is never used.** `HrTeamMember` has no `tenantId` of its own (Class B via `team`), so neither query is tenant-constrained. **Decorative tenancy — the exact anti-pattern `TSC-0 D3` forbids**, sitting in the function that decides who sees whose hours.

### What it must become
```ts
scope.reach(): 'self' | 'team' | 'tenant'          // derived, never asserted
scope.reachableUserIds(): Promise<string[]>        // from the scope, no tenantId parameter
```
- [ ] **Derived from the scope, not handed a tenantId.** `where: { team: { tenantId } }` is expressible — `HrTeamMember.team` **is** declared *(it is the relation `TSC-4` held up as the correct example)*.
- [ ] 🛑 **Reach is asked for, never asserted.** No `if (role === 'WORKFORCE')` at a call site. *(`pd.md` 5a — a component must not decide its own privilege.)*
- [ ] 🛑 **Enforced server-side, on every read AND write.** A worker crafting a request by hand must get their own reach, not the tenant's. **The crew app is the one surface where the user is not trusted** — they are an employee, on their own phone, with an interest in their own hours.
- [ ] 🔴 **`R1-4` must expose reach alongside tenancy**, or every workhub route improvises it — and `TSC-4`/`HRA` are the record of what improvisation produces.

---

# L1 · CORE — the shared records
**One core, read by two modules.**
- [ ] **`ClockEntry`** — the payroll fact. 🟢 `ClockEntry.shift` relation now declared *(`WORKHUB-CLOCKLINK`)*; `onDelete: SetNull` so hours outlive the schedule.
- [ ] **`ScheduledShift`** — the plan. Children declared *(`TSC-4`)*.
- [ ] **`TimeOffRequest` · `HrApprovalRequest`** — the approval chain.
- [ ] **`ProjectRef`** — a page in `scope.systemDatabase('projects')`; `SetNull` on the workforce side *(`coral-decision-one-project.md` `D-B`)*.
- [ ] **ONE write path.** Clock-in from the phone and a manual entry from the back office are **the same intent**, differing only in actor and reason. *(`R2-1`: five doors collapse to one. Two more doors here is how the phone and the desk start disagreeing.)*
- [ ] **Employee identity: pick one.** 🔴 *"Employee" currently exists three times — `User`, the `Employee` model, and `db-hr`'s virtual pages synthesised from `User` at read time.* **The core must name one. The other two become projections or die.**

---

# L2 · THE TWO MODULES

## `workhub` — the crew phone app
**Surfaces:** clock in/out · my schedule · my timesheet · request leave · my documents · my tasks on a shift.
- [ ] **Offline-first, not offline-tolerant.** A site has no signal. **Clock-in must succeed on a dead network and reconcile later** — via the kernel queue, not a component's `try/catch`.
- [ ] 🛑 **The worker's hours are never lost and never refused.** *(The `HRA` rule, already applied: an unresolvable shift drops the linkage, never the entry.)*
- [ ] **Reach is `self`.** Payloads carry the worker's own data and nothing else — **not filtered in the client.**
- [ ] 🔴 **No ERP vocabulary crosses the boundary.** No `[ERP]` prefixes, no project *database* ids, no tenant plumbing. A worker sees *a job name*.
- [ ] **ro · ru are first-class.** Not an afterthought — they are why the separate i18n exists.

## `hr` — the employer's back office
**Surfaces:** scheduler · approvals · timesheet reports and export · employees · leave management.
- [ ] **Reach is `team` or `tenant`**, by role, asked of the gate.
- [ ] 🛑 **Timesheet export feeds payroll.** Any change is figure-verified: a named worker, a named week, numbers before and after.

## The boundary, stated
> **The two modules may share the CORE. They may not share COMPONENTS.**
**A file imported by both is a boundary violation** — and it is exactly how the crew's logout ended up in a file the employer's timesheet page imports.

---

# THE PLAN — ordered, and the first phase is independent of every decision

## `WH-1` · EXTRACT THE PLUMBING — do now, decides nothing *(spec'd in `coral-workhub-scope.md`)*
`cn()` → `src/lib/utils.ts` (**52 importers**) · `use-toast`, `use-mobile` → `src/hooks/` · `ThemeContext` → `src/context/` · `hr-api` → `src/lib/`.
🟢 **Removes 73% of the apparent coupling. Moves and repoints, no logic. Zero throwaway.**

## `WH-5` · DRAW THE BOUNDARY — the audit that makes "standalone" true
- [ ] **List every file imported by BOTH `/workhub/**` and `/admin/**`.** That list is the work.
- [ ] **Audit what the HR API returns to a workhub caller.** Any field a worker should not see is a leak, whether or not the UI renders it.
- [ ] **Audit reachability:** from a workhub session, can any `/admin/**` route or ERP payload be reached by hand?
- [ ] 🔴 **This is a measurement, not a refactor.** It sizes `WH-6` and it is how "zero visible connection" stops being an aspiration.

## `WH-6` · ACTOR REACH INTO THE GATE
Fix `getAccessibleUserIds` → `scope.reachableUserIds()`. **Rides with `R1-4`**; it is the same client.

## `WH-7` · REBUILD THE SHIFT EDITOR — option `B`
`CreateShiftForm` (1,967) + `EditShiftDialog` (915) + `ShiftViewDialog` (626) = **3,508 lines, 22% of the module**, and where every defect this week clustered. **Against the corrected kernel:** one project database, declared relations, camelCase, one write path.

## `WH-8` · THE DISPLAY LAYER — repaired in place, opportunistically
The other 78% is mostly presentation. **The ratchet holds the line; `@ts-nocheck` (21) only falls.**

---

# 🔴 WHAT MUST LAND FIRST, AND WHY
```
WH-1 plumbing        ← independent, do now
   ↓
WH-5 boundary audit  ← a measurement; sizes everything after it
   ↓
KERN-6/7/8 · PROJ-0 · R1-1b · R1-2/3 · R1-4+WH-6
   ↓
WH-7 editor rebuild  ← needs the corrected kernel, or it rebuilds the defects
   ↓
WH-8 display layer
```
🛑 **`WH-7` before `PROJ-0` and `R1-4` rebuilds the `[ERP]` prefix and the 74 id-parse sites into new code.** *That is the "fix it twice" failure, and it is the whole reason the batch march is parked.*

## FLORIN'S DECISIONS
- [ ] **Does WorkHub need its own entitlement, or is `HR` enough?**
- [ ] **Which "employee" is canonical** — `User`, `Employee`, or the `db-hr` projection?
- [ ] **Is a team lead's reach a role or a team membership?** *(today: membership with `role: 'lead'` — which means reach is data, not identity. **That is the better answer**; confirm it.)*
- [ ] **Offline scope on the phone:** clock-in only, or the full schedule? *(Determines how much the queue must carry.)*
