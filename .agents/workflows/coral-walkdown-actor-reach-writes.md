# CORAL — WALKDOWN — `RBAC-CE-1` · who may write whose hours — Planner 2026-09-30

> **Florin:** *"follow the canonical logic. is anything destined for kernel, core, seraph? write where it belongs. … cross-tenant issues — when established, fix it."*

Governed by `coral-workhub-structure.md` (Gate 2 · actor reach) and `pd.md` 5a (one authority).

---

# 0 · VERDICT — measured from the code, not inferred

| Question | Answer | Evidence |
|---|---|---|
| Can a user READ another tenant's hours? | 🟢 **No** | every GET adds `tenantId: ctx.tenantId` (`[entity]/route.ts:108-110`); team reach is intersected with it |
| Can a user WRITE into another tenant? | 🟢 **No** | POST forces `data.tenantId = ctx.tenantId` (`:428`); PATCH/DELETE `findFirst({ id, tenantId })` first (`:676`, `:909`) |
| Can a user write an entry that REFERENCES a foreign user? | 🔴 **Was yes → fixed** | `ClockEntry.userId` has no FK and POST took any `userId` |
| Is the team-reach primitive tenant-constrained? | 🔴 **Was no → fixed** | `getAccessibleUserIds` ignored its `tenantId` — both `HrTeamMember` queries unscoped |
| Can a worker act on a COLLEAGUE's hours, same tenant? | 🔴 **Yes — open** | POST accepts any `userId`; PATCH checks tenant only, never reach |
| Can a worker APPROVE hours? | 🔴 **Yes — open** | POST with `approvalStatus:'approved'` → server stamps `approvedBy = ctx.userId` (`:450-456`); PATCH does the same (`:719`); PATCH has no role check |

🟢 **The seraph held.** Nothing crosses tenants — which is what building the tenant gate first bought.
🔴 **The hole is one layer down, in Gate 2 (actor reach), which is not built.** It is intra-tenant, and it is on payroll: **a crew member with devtools can approve their own hours, or clock a colleague in.**

---

# 1 · WHERE EACH PIECE BELONGS

## L0 · KERNEL — nothing
**No tenant, no user, no role in the kernel.** "Who may approve" needs to know who is asking → not kernel. *(One kernel item stays open and unrelated: `CLEAN-11`, a negative duration is a kernel refusal.)*

## L1 · CORE — the ClockEntry write path owns its SERVER-ONLY fields
`approvalStatus` (to `approved`) · `approvedBy` · `approvedAt` · `costRateApplied` · `source` · `createdBy` · `editedAfterApproval`.
- 🔴 **These are facts the SYSTEM records about an act — never values a client supplies.** `createdBy` is already protected (`PROTECTED_FIELDS`); the rest are not.
- **Shape:** the generic create/update drops them from a client payload; **the approval intent is the only door that sets them** — and it asks Gate 2 whether the actor may approve. *(`coral-workhub-structure.md` L1: "ONE write path … the same intent, differing only in actor and reason".)*

## SERAPH · the tenant gate — two gaps, both FIXED in this pass
- [x] **An entry's subject must be a user of the scope's tenant.** POST `clock-entries` now 404s a `userId` that is not a `User` of `ctx.tenantId`. *(Checklist item 8: a foreign-tenant id must 404, not be stored.)*
- [x] **`getAccessibleUserIds` is tenant-constrained** — `team: { tenantId }` on both `HrTeamMember` queries. *(Decorative tenancy, `TSC-0 D3`, as recorded in `coral-workhub-structure.md` Gate 2.)*
- 🟢 Neither changes behaviour for valid data. Both remove a way for invalid data to travel.

## GATE 2 · ACTOR REACH — the open work, and where it goes
**Destination (unchanged):** `scope.reach(): 'self' | 'team' | 'tenant'` and `scope.reachableUserIds()`, exposed by `R1-4` beside tenancy (`WH-6`).

**Today there is no single authority — there are SIX, and they disagree** *(`pd.md` 5a: "a privilege check written more than once will disagree with itself" — it does)*:
| Site | Who counts as "admin" |
|---|---|
| `[entity]/route.ts:114` · `timesheet-export:53` · `timesheet-reports:36` | 8 roles, incl. `TENANT_ADMIN`/`TENANT_OWNER`/`TENANT_ENTERPRISE_ADMIN` (not in `ROLES`) and **`ACCOUNTANT` — an external, read-only role with full HR reach**; **excludes `TENANT_ENTERPRISE_MANAGER`, `HR_OFFICER`** |
| `timesheet-rates:22` · `timesheet-rates/undo:21` | 7 roles (same minus `TENANT_ENTERPRISE_ADMIN`) |
| `[entity]/route.ts:218` (`erp-tasks`) | 3 roles: `TENANT_ADMIN`, `SUPERADMIN`, `ACCOUNTANT` — **the tenant owner is NOT admin here** |
| `[entity]/route.ts:461` (leave reroute) | `'admin'` / `'owner'` — **matches no real role, so every admin-created leave lands `pending`** |
| `src/lib/roles.ts` `isOwnerOrAdminRole` | a sixth definition, incl. `role.includes('OWNER'/'ADMIN')` |
| `src/lib/access-control.ts` `getModuleAccess` | a seventh model: per-module `ALL`/`OWN`/`ASSIGNED_AND_OWN` |

### The bridge — measured, named, with an exit condition
- [ ] **`src/app/api/hr/lib/actor-reach.ts`** — **the one HR authority** until `R1-4`:
  ```ts
  resolveReach(ctx): Promise<{ kind: 'tenant' | 'team' | 'self'; userIds: Set<string> | null /* null = whole tenant */; mayApprove: boolean }>
  canActOn(reach, subjectUserId): boolean
  ```
- [ ] **All six HR copies call it.** `team-scoping.ts` becomes its private helper.
- [ ] **Enforced on every clock-entry WRITE:** POST — subject in reach; PATCH/DELETE — existing entry's `userId` in reach; approval fields — only if `mayApprove`.
- [ ] **Exit condition:** deleted when `R1-4` exposes `scope.reach()`; its callers switch in one commit.
- 🛑 **It asks; it never decides from a component.** No role string outside this file.

## L2 · MODULES — consumers only
`workhub` and `hr` call Gate 2. **Neither evaluates a role.** `WorkHubShell`'s `isWorkforce` (client) is the same violation on the display side — recorded, cosmetic, not a security boundary.

---

# 2 · 🔴 FLORIN DECIDES — the bridge cannot be written without these
1. **Who may APPROVE hours?** (a) tenant-reach roles only · (b) also a team lead, for their own team.
2. **Which roles have TENANT reach in HR?** The six lists disagree. Planner's proposal: `SUPERADMIN, APP_MANAGER, TENANT_FREE, TENANT_PRO_OWNER, TENANT_ENTERPRISE_OWNER, TENANT_ENTERPRISE_MANAGER, HR_OFFICER` + `ACCOUNTANT` **read-only** — i.e. adds `TENANT_ENTERPRISE_MANAGER` and `HR_OFFICER`, drops the non-existent `TENANT_ADMIN`/`TENANT_ENTERPRISE_ADMIN`.
3. **Self-approval** stays allowed for approvers (your earlier call, `HR-TS-7`) — confirming it survives the move.

🟨 **Behaviour changes the bridge WILL cause, stated so none is a surprise:** the `erp-tasks` branch starts treating the tenant owner as admin; admin-created leave starts landing `approved` as SCH-1 intended; `TENANT_ENTERPRISE_MANAGER`/`HR_OFFICER` (if you agree to 2) gain tenant reach in HR.

---

# 3 · ✅ DECIDED AND BUILT — 2026-09-30
**Florin:** *"only tenant enabled roles. tenant admin, director, hr."* — and: *"the signature approves the hours and file freezes together with attachments, notes and all there is."*

| Florin's word | `ROLES` |
|---|---|
| tenant admin | `APP_MANAGER`, `TENANT_FREE`, `TENANT_PRO_OWNER`, `TENANT_ENTERPRISE_OWNER` (+ legacy spellings `TENANT_ADMIN`, `TENANT_OWNER`) |
| director | `TENANT_ENTERPRISE_MANAGER` |
| HR | `HR_OFFICER` |

🔴 **Consequences, stated:** `SUPERADMIN` and `ACCOUNTANT` **lose** HR tenant reach and approval (they are not tenant roles). `TENANT_ENTERPRISE_MANAGER` and `HR_OFFICER` **gain** them. An accountant's timesheet export now returns only their own (empty) reach.

**Two approval doors, not one:** internal approval = these roles (`actor-reach.ts`). **The client's signature on the werkbon is the other door** — a PORTAL actor that approves and freezes the entry with its attachments and notes (`WB-C` + `WB-D`). It is not a role and is not decided in Gate 2.

## Built
- `src/app/api/hr/lib/actor-reach.ts` — `resolveReach`, `isTenantHrRole`: **the one authority**. Exit: `R1-4`'s `scope.reach()`.
- `src/app/api/hr/lib/write-policy.ts` — **pure** policy table, `tests/hr-write-policy.test.ts` (22 cases: every crew call path passes; every escalation refused).
- Routed through it: `[entity]` GET reach · POST · PATCH · DELETE · leave reroute · `timesheet-export` · `timesheet-reports` · `timesheet-rates` · `timesheet-rates/undo`. **Five of the six copies are gone.**
- Server-only fields stripped from every clock-entry write: `approvedBy`, `approvedAt`, `costRateApplied`, `editedAfterApproval`.

## Still open
- `[entity]` `erp-tasks` keeps its own 3-role list — **Tasks module visibility, not hours**; belongs to the Tasks module's entitlement (`access-control.ts`), not Gate 2.
- **Gate 2 phase 2:** `shifts`, `shift-tasks`, `shift-attachments` — crew self-service on their own shifts needs reach-on-parent (rides with `R1-4`).
- 🔴 **Live clock-in trusts the client's `clockInTime`.** A crew member can backdate a live clock-in. Late entries legitimately carry times (and are pending); a live clock-in should be stamped `now()` by the server. → `CE-TIME-1`.
