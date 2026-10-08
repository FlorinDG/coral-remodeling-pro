# PLAN — HR-SERAPH-1 · HR Read Side & Timesheets onto Scoped Client

### 0 · Header
```
Item:            HR-SERAPH-1 (HR MVP Close Step 3/5)
Directive:       .agents/workflows/CODER-QUEUE.md (§7 · HR-SERAPH-1)
Workspace:       coral-remodeling-pro
Branch:          develop
Date:            2026-10-08
Status:          PLAN DRAFTED — Awaiting Review & GO
```

---

### 1 · Objectives & Invariants

- **Goal:** Migrate the HR read side, timesheet reporting & export, timesheet rate stamping & undo, audit logs, team scoping, HR admin dashboard & leave pages, and HR server actions to the tenant-scoped client (`scopeFromSession()` from `@/lib/data/scope`).
- **Invariants:**
  1. **Unscoped Lookups Closed:** Eliminates all cross-tenant lookup vulnerabilities where entities were fetched by ID list without tenant constraints:
     - `leave/page.tsx`: `user.findMany({ where: { id: { in: userIds } } })` and `employee.findMany({ where: { userId: { in: userIds } } })`
     - `actions/hr-announcements.ts`: `user.findMany({ where: { id: { in: userIds } } })`
     - `timesheet-rates/route.ts`: `clockEntry.findUnique({ where: { id: referenceEntryId } })`
     - `timesheet-rates/undo/route.ts`: `rateChangeAudit.update({ where: { id: audit.id } })`
  2. **Secondary Wall Permitted:** Existing manual `where: { tenantId }` filters remain as defense-in-depth, but are never the sole line of defense; `TenantScopedClient` enforces the session tenant by construction.
  3. **Identical Behavior & Payloads:** Zero change to response payloads, JSON schemas, calculations, or exported spreadsheets/PDFs. Timesheets and exports produce identical rows and totals.
  4. **Strict Ratchet (One File = One Commit):** Each migrated file is removed from the allowlist in `eslint.config.mjs` and decrements `CEILING` in `tests/seraph-gate.test.ts` (dropping from 88 to 78 across the 10 files).
  5. **Unit Test per Surface with Throw Proof:** A dedicated test suite in `tests/hr-seraph.test.ts` asserting that foreign tenant records are never returned or modified, with throw proofs.
  6. **STOP after the Plan:** No code changes until this plan is formally reviewed.

---

### 2 · Audited Target Files & Scope (10 Files)

#### 2.1 · `src/app/api/hr/timesheet-reports/route.ts`
- **Current Queries:**
  - `prisma.clockEntry.findMany` (lines 114–117)
  - `prisma.clockEntry.count` (lines 122–124)
  - `prisma.user.findMany` (lines 127–130)
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `GET(req)`: `const db = await scopeFromSession();`.
  - Replace all queries with `db.clockEntry.findMany`, `db.clockEntry.count`, `db.user.findMany`.
- **Ratchet:** Remove `"src/app/api/hr/timesheet-reports/route.ts"` from `eslint.config.mjs`, decrement `CEILING` (88 → 87).

#### 2.2 · `src/app/api/hr/timesheet-export/route.tsx`
- **Current Queries:**
  - `prisma.clockEntry.findMany` (lines 91–94)
  - `prisma.employee.findMany` (lines 100–103)
  - `prisma.user.findMany` (lines 109–112)
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `GET(req)`: `const db = await scopeFromSession();`.
  - Replace all queries with `db.clockEntry.findMany`, `db.employee.findMany`, `db.user.findMany`.
- **Ratchet:** Remove `"src/app/api/hr/timesheet-export/route.tsx"` from `eslint.config.mjs`, decrement `CEILING` (87 → 86).

#### 2.3 · `src/app/api/hr/timesheet-rates/route.ts`
- **Current Queries & Vulnerability:**
  - Line 44: `prisma.clockEntry.findUnique({ where: { id: referenceEntryId } })` — **UNSCOPED LOOKUP** by ID! An attacker from Tenant B passing a `referenceEntryId` from Tenant A could inspect entry timestamps across tenants.
  - Line 60: `prisma.clockEntry.findMany({ where, ... })`
  - Lines 75–88: `prisma.$transaction(async (tx) => { ... tx.rateChangeAudit.create ... tx.clockEntry.updateMany ... })`
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `POST(req)`: `const db = await scopeFromSession();`.
  - Line 44: `db.clockEntry.findFirst({ where: { id: referenceEntryId } })` (or `db.clockEntry.findUnique({ where: { id: referenceEntryId } })`), automatically scoped to `tenantId`.
  - Line 75: `await db.$transaction(async (tx) => { ... })`. Scoped client delegates transactions to scoped models.
- **Ratchet:** Remove `"src/app/api/hr/timesheet-rates/route.ts"` from `eslint.config.mjs`, decrement `CEILING` (86 → 85).

#### 2.4 · `src/app/api/hr/timesheet-rates/undo/route.ts`
- **Current Queries & Vulnerability:**
  - Line 33: `prisma.rateChangeAudit.findUnique({ where: { id: auditId, tenantId: ctx.tenantId } })`
  - Line 46: `prisma.clockEntry.updateMany`
  - Line 57: `prisma.rateChangeAudit.update({ where: { id: audit.id } })` — updated by ID alone without scoped where constraint!
  - Line 62: `prisma.$transaction([...updates, revertAudit])`
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `POST(req)`: `const db = await scopeFromSession();`.
  - `await db.$transaction(async (tx) => { ... })` or scoped promises passed to `db.$transaction`.
- **Ratchet:** Remove `"src/app/api/hr/timesheet-rates/undo/route.ts"` from `eslint.config.mjs`, decrement `CEILING` (85 → 84).

#### 2.5 · `src/app/api/hr/audit-logs/route.ts`
- **Current Queries:**
  - `prisma.auditLog.findMany({ where: { tenantId, entityId, entityType }, orderBy: { createdAt: 'desc' } })`
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `GET(req)`: `const db = await scopeFromSession();`.
  - `const logs = await db.auditLog.findMany({ where: { entityId, entityType }, orderBy: { createdAt: 'desc' } });`.
- **Ratchet:** Remove `"src/app/api/hr/audit-logs/route.ts"` from `eslint.config.mjs`, decrement `CEILING` (84 → 83).

#### 2.6 · `src/app/api/hr/lib/team-scoping.ts`
- **Current Queries:**
  - `prisma.hrTeamMember.findMany` (lines 10–13 and 22–25).
- **Seraph Transition:**
  - Replace `import { prisma } from '@/lib/prisma'` with `import { systemScope, type TenantScopedClient } from '@/lib/data/scope'`.
  - Update function signature:
    `export async function getAccessibleUserIds(tenantId: string, userId: string, db?: TenantScopedClient): Promise<string[]>`
  - Instantiate `const client = db ?? systemScope(tenantId, 'hr-team-scoping');`.
  - `HrTeamMember` is Class B (via `team`). The scoped client automatically injects `{ team: { tenantId } }` on `client.hrTeamMember.findMany`.
- **Ratchet:** Remove `"src/app/api/hr/lib/team-scoping.ts"` from `eslint.config.mjs`, decrement `CEILING` (83 → 82).

#### 2.7 · `src/app/[locale]/admin/hr/page.tsx`
- **Current Queries (Server Component):**
  - Lines 79–81: `prisma.user.count` (3 queries)
  - Lines 82–83: `prisma.timeOffRequest.count` (2 queries)
  - Line 84: `prisma.scheduledShift.count`
  - Line 87: `prisma.clockEntry.findMany`
  - Line 93: `prisma.timeOffRequest.findMany`
  - Line 99: `prisma.user.findMany`
  - Line 108: `prisma.clockEntry.findMany`
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In server component `HRDashboardPage`: `const db = await scopeFromSession();` and pass `db` to `getHRData(db)`.
  - All 10 queries run on `db`.
- **Ratchet:** Remove `"src/app/*locale*/admin/hr/page.tsx"` from `eslint.config.mjs`, decrement `CEILING` (82 → 81).

#### 2.8 · `src/app/[locale]/admin/hr/leave/page.tsx`
- **Current Queries & Vulnerability:**
  - Line 12: `prisma.timeOffRequest.findMany`
  - Lines 22–25: `prisma.user.findMany({ where: { id: { in: userIds } } })` — **UNSCOPED LOOKUP**!
  - Lines 26–29: `prisma.employee.findMany({ where: { userId: { in: userIds } } })` — **UNSCOPED LOOKUP**!
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In server component `AdminHRLeavePage`: `const db = await scopeFromSession();` and pass `db` to `getLeaveData(db)`.
  - `db.timeOffRequest.findMany`, `db.user.findMany`, and `db.employee.findMany` are all strictly scoped to session tenant.
- **Ratchet:** Remove `"src/app/*locale*/admin/hr/leave/page.tsx"` from `eslint.config.mjs`, decrement `CEILING` (81 → 80).

#### 2.9 · `src/app/actions/hr-documents.ts`
- **Current Queries:**
  - Line 17: `prisma.hrDocument.findMany({ where: { tenantId } })`
  - Line 22: `prisma.hrDocumentAcknowledgment.findMany({ where: { userId, documentId: { in: ... } } })`
  - Line 55: `prisma.hrDocumentAcknowledgment.upsert(...)`
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `getHrDocuments()` and `acknowledgeHrDocument()`: `const db = await scopeFromSession();`.
  - Run reads and upsert on `db`.
- **Ratchet:** Remove `"src/app/actions/hr-documents.ts"` from `eslint.config.mjs`, decrement `CEILING` (80 → 79).

#### 2.10 · `src/app/actions/hr-announcements.ts`
- **Current Queries & Vulnerability:**
  - Line 17: `prisma.hrAnnouncement.findMany({ where: { tenantId } })`
  - Line 23: `prisma.hrAnnouncementRead.findMany({ where: { userId, announcementId: { in: ... } } })`
  - Line 33: `prisma.user.findMany({ where: { id: { in: userIds } } })` — **UNSCOPED LOOKUP** of author users!
  - Line 62: `prisma.hrAnnouncementRead.upsert(...)`
- **Seraph Transition:**
  - Replace `import prisma from '@/lib/prisma'` with `import { scopeFromSession } from '@/lib/data/scope'`.
  - In `getHrAnnouncements()` and `markHrAnnouncementRead()`: `const db = await scopeFromSession();`.
  - Run reads and upsert on `db`.
- **Ratchet:** Remove `"src/app/actions/hr-announcements.ts"` from `eslint.config.mjs`, decrement `CEILING` (79 → 78).

---

### 3 · Test Suite Design (`tests/hr-seraph.test.ts`)

A new test suite `tests/hr-seraph.test.ts` will verify the scoping guarantees for all models involved across the 10 files using pure scope-args rewriting and simulated queries:
1. **ClockEntry Scoping:**
   - `findMany` query without `tenantId` is strictly injected with session tenant.
   - `findUnique` / `findFirst` by ID is scoped to session tenant — foreign entry ID cannot match.
   - `updateMany` cannot target foreign tenant records even if foreign ID is supplied.
2. **User & Employee Resolution Scoping (closing `leave/page.tsx` & `hr-announcements.ts` holes):**
   - `user.findMany({ where: { id: { in: foreignUserIds } } })` is rewritten to `{ id: { in: foreignUserIds }, tenantId: sessionTenant }`.
   - `employee.findMany({ where: { userId: { in: foreignUserIds } } })` is rewritten to `{ userId: { in: foreignUserIds }, tenantId: sessionTenant }`.
3. **RateChangeAudit Scoping (closing `timesheet-rates` & `undo` holes):**
   - `create` automatically receives session `tenantId`.
   - `update` by `audit.id` cannot mutate a record of a different tenant.
4. **HrTeamMember Scoping via Parent (`team-scoping.ts`):**
   - Transitive scoping via `{ team: { tenantId } }` is enforced; team members of another tenant cannot be returned.
5. **HrDocument & HrAnnouncement Scoping (`actions`):**
   - `HrDocumentAcknowledgment` and `HrAnnouncementRead` upserts and reads strictly verify parent ownership under session tenant.
6. **Throw Proofs:**
   - Proving that an attempt to query or update with a mismatched tenant throws `TenantMismatchError`.
   - Proving that unauthenticated or tenant-less sessions throw when attempting `scopeFromSession()`.

---

### 4 · Execution Plan & Atomic Commits

Each step is atomic, passes `npm run test:compile` and `tests/seraph-gate.test.ts`:

- **Step 1:** Create `tests/hr-seraph.test.ts` (test contract covering the 10 files/surfaces).
- **Step 2:** Migrate `src/app/api/hr/timesheet-reports/route.ts` → update `eslint.config.mjs` → `CEILING: 87`.
- **Step 3:** Migrate `src/app/api/hr/timesheet-export/route.tsx` → update `eslint.config.mjs` → `CEILING: 86`.
- **Step 4:** Migrate `src/app/api/hr/timesheet-rates/route.ts` → update `eslint.config.mjs` → `CEILING: 85`.
- **Step 5:** Migrate `src/app/api/hr/timesheet-rates/undo/route.ts` → update `eslint.config.mjs` → `CEILING: 84`.
- **Step 6:** Migrate `src/app/api/hr/audit-logs/route.ts` → update `eslint.config.mjs` → `CEILING: 83`.
- **Step 7:** Migrate `src/app/api/hr/lib/team-scoping.ts` → update `eslint.config.mjs` → `CEILING: 82`.
- **Step 8:** Migrate `src/app/[locale]/admin/hr/page.tsx` → update `eslint.config.mjs` → `CEILING: 81`.
- **Step 9:** Migrate `src/app/[locale]/admin/hr/leave/page.tsx` → update `eslint.config.mjs` → `CEILING: 80`.
- **Step 10:** Migrate `src/app/actions/hr-documents.ts` → update `eslint.config.mjs` → `CEILING: 79`.
- **Step 11:** Migrate `src/app/actions/hr-announcements.ts` → update `eslint.config.mjs` → `CEILING: 78`.
- **Step 12:** Full test suite run & verification (`test:compile`, `seraph-gate.test.ts`, `hr-seraph.test.ts`, `i18n.test.ts`).

---

## PLANNER REVIEW — 2026-10-08 · 🟩 GO with the bindings below (they override the plan where they differ)

Checked against the code (`scope-args.ts`, `actor-reach.ts`, the 10 files). The file list, one-file-one-commit ratchet
(88 → 78) and the "manual tenantId may stay as a second wall" rule are right.

**B1 · `team-scoping.ts` — NO `systemScope` fallback.** `systemScope(tenantId, reason)` is the door for work WITHOUT a
session (jobs, webhooks). Every caller of `getAccessibleUserIds` runs inside a request whose `ctx` came from the session
(`actor-reach.resolveReach`, `[entity]/route.ts:290`). Building a tenant scope from a parameter is edge-made tenancy
(pd.md, canonical kernel → core → seraph). Do this instead: keep the signature `(tenantId, userId)` — the two callers are
in Planner-fenced files and stay untouched — and inside use `const db = await scopeFromSession()`; if the session's tenant
differs from `tenantId`, throw `TenantMismatchError` (never silently use either). Test with throw proof: a mismatched
`tenantId` throws.

**B2 · `timesheet-rates/route.ts`: `findFirst({ where: { id } })`, not `findUnique`.** Same result on the scoped client,
no reliance on extended-unique semantics. The rest of the file's `where` stays as is.

**B3 · `$transaction`: the interactive form only** (`db.$transaction(async tx => …)`) — in `timesheet-rates` AND in
`undo` (which today passes an ARRAY of promises; convert it). `records.ts` proves the interactive form keeps the scope;
the array form is not proven on the extended client — do not be the first.

**B4 · Upserts in `hr-documents.ts` / `hr-announcements.ts`** (`HrDocumentAcknowledgment`, `HrAnnouncementRead` are
VIA models): `scopeArgs` rewrites the upsert's `where` and requires the parent id in `create` (it verifies the parent's
tenant). Keep the compound unique key in `where` exactly as today and make sure `create` names `documentId` /
`announcementId`. If tsc rejects the scoped `where` on the unique input, STOP and report — do not cast it away
(`as never` / `as any` on a scoped call is a refusal reason).

**B5 · Tests.** `scopeArgs` itself is already pinned by `tests/scope-args.test.ts` and `scopeFromSession()`-without-tenant
by `tests/tenant-isolation.test.ts` — do NOT duplicate those. `tests/hr-seraph.test.ts` pins the EXACT query shapes these
files run (name the file:line each case comes from): ClockEntry `findFirst` by id · User `findMany` id-in · Employee
`findMany` userId-in · RateChangeAudit `update` by id · HrTeamMember `findMany` (via team) · the two upserts — each
asserting the rewritten args carry the session tenant, plus B1's mismatch throw. Throw proof per case (break the rule,
show red, restore), per protocol §3a.

**B6 · Add to scope (the leftover recorded at LOC-HR-1's acceptance):** `leave/page.tsx` shows dates with
`toLocaleDateString('en-GB')` (English month names in a Dutch screen) and formats `createdAt` on the UTC server. Dates:
`startDate`/`endDate` are calendar strings → format from parts in the user's locale (same as `formatCalendarDay` in
`shift-editor/model.ts` — import it, do not copy it); `createdAt` → `zonedParts(...).date` first, then the same formatter.
Its own commit.

**B7 · Behaviour identical** — for the two timesheet routes do NOT touch the period logic added today
(`lib/records/business-period.ts`, the `.filter(inBusinessPeriod)` after `findMany`) or the rollups; only the client changes.

Order unchanged (Step 1 tests → Steps 2–11 → B6 → full run). Report `.agents/reports/HR-SERAPH-1.md`, push develop, STOP.

## PLANNER REVIEW 2 — 2026-10-08 · commits 12521a8d..03612fc5 accepted, ONE fix before the item closes

Reviewed: reports, export, rates (B2, B3 ✓), audit-logs, team-scoping (B1 ✓ — session tenant asserted), dashboard,
leave page (scoped lookups ✓), the contract tests. Behaviour unchanged where it must be (period filter and rollups intact).

**B8 · `timesheet-rates/undo` — no per-entry round trip inside the transaction.** The converted loop runs one
`updateMany` per snapshot entry inside ONE interactive transaction: an undo of an ALL-scope restamp (hundreds of entries)
spends a network round trip per entry and can exceed Prisma's 5 s interactive-transaction timeout — the old array form
did not. Group the snapshot by `oldRate` and run ONE `updateMany({ where: { id: { in: ids }, accountantExportedAt: null } })`
per distinct rate (a handful at most), then the audit update — same transaction. Its own commit; a test that the
grouping covers every entry once (throw proof). The Planner holds promotion to main until this lands.
