# CORAL — CODER REPORT — HR-SERAPH-1

### 0 · Header
```
Item:            HR-SERAPH-1
Directive:       .agents/workflows/CODER-QUEUE.md (§7 · HR-SERAPH-1)
Plan:            .agents/plans/HR-SERAPH-1.md (with Planner Reviews 1 & 2)
Branch:          develop
Date:            2026-10-08
Status:          DONE — All 10 files migrated, ratchet lowered 88 -> 78, B1-B8 enforced, verified green
```

---

### 1 · Outcome
`DONE — HR-SERAPH-1 executed, verified, and committed across 13 atomic steps. The HR read side, timesheet reporting, timesheet export, rate restamping & undo, audit logs, team scoping, HR admin dashboard, leave management, and HR server actions have all been migrated from raw prisma to the tenant-scoped client (scopeFromSession() from @/lib/data/scope). All unscoped ID-list lookups in leave/page.tsx (users and employees) and hr-announcements.ts (author users) are closed. All 8 bindings (B1–B8) from Planner Reviews 1 & 2 are strictly satisfied: team-scoping asserts session tenant equality or throws TenantMismatchError (B1), timesheet-rates uses findFirst by id (B2), interactive transaction forms are used throughout (B3), upserts preserve compound unique keys without casts (B4), exact query shapes and throw proofs are pinned in tests/hr-seraph.test.ts (B5), leave page dates format in locale via formatCalendarDay and zonedParts (B6), timesheet business period filters and rollups remain identical (B7), and timesheet rate undo batches entries by distinct oldRate to prevent transaction timeouts (B8). The Seraph allowlist in eslint.config.mjs shrank by exactly 10 entries, and CEILING in tests/seraph-gate.test.ts was lowered from 88 to 78.`

---

### 2 · Atomic Commits Sequence

| Step | Commit | Description | Allowlist / CEILING |
|---|---|---|---|
| Step 1 | `12521a8d` | `test(hr): add HR-SERAPH-1 exact query contract tests` | 88 |
| Step 2 | `48a095b1` | `feat(hr): migrate timesheet-reports to scoped client` | 87 |
| Step 3 | `251241e7` | `feat(hr): migrate timesheet-export to scoped client` | 86 |
| Step 4 | `a5a9cb09` | `feat(hr): migrate timesheet-rates to scoped client` | 85 |
| Step 5 | `f9ef7664` | `feat(hr): migrate timesheet-rates/undo to scoped client` | 84 |
| Step 6 | `96699421` | `feat(hr): migrate audit-logs to scoped client` | 83 |
| Step 7 | `448eaafe` | `feat(hr): migrate team-scoping to scoped client with B1 check` | 82 |
| Step 8 | `2fda10fd` | `feat(hr): migrate admin/hr/page.tsx to scoped client` | 81 |
| Step 9 | `03612fc5` | `feat(hr): migrate admin/hr/leave/page.tsx to scoped client` | 80 |
| Step 10 | `0e75d8a3` | `feat(hr): migrate hr-documents actions to scoped client` | 79 |
| Step 11 | `dc526d3b` | `feat(hr): migrate hr-announcements actions to scoped client` | 78 |
| Step 12 | `48d9625a` | `fix(hr): use locale-aware formatCalendarDay and zonedParts in leave page (B6)` | 78 |
| Step 13 | `6e11df35` | `fix(hr): batch undo updateMany by distinct rate and add invariant test (B8)` | 78 |

---

### 3 · Verification of Planner Bindings (B1–B8)

1. **B1 · `team-scoping.ts` Session Tenant Assertion:**
   `getAccessibleUserIds(tenantId, userId)` resolves session from session auth; if `sessionTenantId !== tenantId`, throws `TenantMismatchError('HrTeamMember', ...)`. Pinned with unit test and throw proof in `tests/hr-seraph.test.ts` (test 8). Callers in `actor-reach.ts` and `[entity]/route.ts` remain untouched.
2. **B2 · `timesheet-rates/route.ts`:**
   Reference entry lookup uses `db.clockEntry.findFirst({ where: { id: referenceEntryId } })` instead of `findUnique`, preventing extended-unique ambiguity.
3. **B3 · Interactive `$transaction` Only:**
   Both `timesheet-rates` and `undo` run interactive transactions (`await db.$transaction(async (tx) => { ... })`). In `undo`, the previous array-of-promises form was converted into the interactive form.
4. **B4 · VIA Upserts (`hr-documents.ts` / `hr-announcements.ts`):**
   `HrDocumentAcknowledgment` and `HrAnnouncementRead` upserts keep compound unique keys (`userId_documentId` and `userId_announcementId`) in `where` while naming parent IDs (`documentId` / `announcementId`) in `create`. Verified clean compile under `tsc --noEmit` with zero casts (`as any` / `as never`).
5. **B5 · Exact Query Shape Pins in `tests/hr-seraph.test.ts`:**
   Pins exact query rewrites with line references:
   - `ClockEntry` `findFirst` by id (`timesheet-rates/route.ts:44`)
   - `User` `findMany` id-in (`leave/page.tsx:22`, `hr-announcements.ts:33`)
   - `Employee` `findMany` userId-in (`leave/page.tsx:26`, `timesheet-export:100`)
   - `RateChangeAudit` `update` by id (`undo/route.ts:57`)
   - `HrTeamMember` `findMany` via team (`team-scoping.ts:10, 22`)
   - `HrDocumentAcknowledgment` upsert (`hr-documents.ts:55`)
   - `HrAnnouncementRead` upsert (`hr-announcements.ts:62`)
   - B1 mismatch throw test
6. **B6 · Leave Page Date Formatting:**
   `leave/page.tsx` dropped `formatDate` and raw `toLocaleDateString('en-GB')`. Calendar date bounds `startDate` and `endDate` are formatted using `formatCalendarDay(ymd, locale)` imported directly from `shift-editor/model.ts`. Creation timestamp `createdAt` is extracted via `zonedParts(req.createdAt).date` and rendered through `formatCalendarDay`.
7. **B7 · Timesheet Period & Rollup Invariants:**
   `inBusinessPeriod` filters and rollup mapping structures in `timesheet-reports` and `timesheet-export` were left strictly intact.
8. **B8 · Batched Rate Undo (`timesheet-rates/undo/route.ts`):**
   Exported pure helper `groupSnapshotByRate(snapshot)` groups entries by distinct `oldRate`. The interactive transaction runs one `updateMany({ where: { id: { in: entryIds } } })` per distinct rate, preventing Prisma 5 s transaction timeouts on large restamp undos. Test 9 in `tests/hr-seraph.test.ts` proves that every entry is covered exactly once with throw proof against double-counting or omissions.

---

### 4 · Test Suite Verification Results

- **`test:compile` (`tsc --noEmit`):** Clean (0 errors).
- **`tests/seraph-gate.test.ts`:** 3/3 passed. Ceiling = 78. Allowlist = 78. 0 stale entries, 0 escapes.
- **`tests/hr-seraph.test.ts`:** 9/9 passed.
- **`tests/tenant-isolation.test.ts`:** 19/19 passed.
- **`tests/scope-args.test.ts`:** 14/14 passed.
- **`tests/i18n.test.ts`:** 7/7 passed.
- **`npm run test:lint` (`eslint src`):** 0 errors.
