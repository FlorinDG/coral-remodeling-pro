# PLAN — DEAD-HR-1 · Deleting Unreachable HR Code

### 0 · Header
```
Item:            DEAD-HR-1 (HR MVP Close Step 1/5)
Directive:       .agents/workflows/CODER-QUEUE.md (§5 · DEAD-HR-1)
Workspace:       coral-remodeling-pro
Branch:          develop
Date:            2026-10-08
Status:          PLAN DRAFTED — Awaiting Review & GO
```

---

### 1 · Context & Sequence
Florin requested executing the 5-item HR MVP Close pipeline:
1. **DEAD-HR-1:** Delete HR screens and components nothing reaches (deletions only). *(This plan)*
2. **LOC-HR-1:** Localize the HR module across en/nl/fr/ro (strings only).
3. **HR-SERAPH-1:** Move HR read side and timesheets onto scoped client (`scopeFromSession`).
4. **EMP-PROFILE-1:** Store employee profile in database via Prisma migration.
5. **GRID-SURFACE-1:** Reusable presentational grid surface for scheduler table view.

Per `CODER-QUEUE.md`, the protocol is: **plan → STOP for review → build → report → push develop → STOP**.

---

### 2 · Inventory of Dead HR Code (18 Files, 3,993 Lines)

Below is the verified inventory of every file scheduled for deletion, categorized with proof of unreachability.

#### Category A: Unreachable Page Routes (5 files)
No link, button, menu, or `href` anywhere in the codebase navigates to these routes:

| # | Route File | Lines | Proof of Unreachability |
|---|---|---|---|
| 1 | `src/app/[locale]/workhub/schedule/page.tsx` | 26 | Zero `href` links in WorkHub shell. Renders legacy `Schedule.tsx` which writes invalid shift statuses. Only reference was a PWA shortcut in `public/manifest-workhub.json` (will point to `/workhub` home). |
| 2 | `src/app/[locale]/admin/hr/time-tracker/documents/page.tsx` | 37 | Zero incoming links in navigation or `tabs.ts`. Only references its own back button. |
| 3 | `src/app/[locale]/admin/hr/time-tracker/performance/page.tsx` | 3 | Zero incoming links. Only renders legacy `pages/Performance.tsx`. |
| 4 | `src/app/[locale]/admin/hr/time-tracker/profile/page.tsx` | 3 | Zero incoming links. Only renders legacy `pages/Profile.tsx`. |
| 5 | `src/app/[locale]/admin/hr/time-tracker/time-off/page.tsx` | 3 | Zero incoming links. Only renders legacy `pages/TimeOff.tsx`. |

#### Category B: Dead Time-Tracker Pages (4 files)
Components originally from the grafted Vite time-tracker app, now replaced by canonical WorkHub screens (`WorkHubShell`, `TimeOffScreen`, `PlannedShiftsScreen`):

| # | File | Lines | Importer / Caller Proof |
|---|---|---|---|
| 6 | `src/components/time-tracker/pages/Schedule.tsx` | 547 | Only imported by `app/[locale]/workhub/schedule/page.tsx`. Writes obsolete statuses (`scheduled`) refused by kernel. |
| 7 | `src/components/time-tracker/pages/Performance.tsx` | 457 | Only imported by `app/[locale]/admin/hr/time-tracker/performance/page.tsx`. |
| 8 | `src/components/time-tracker/pages/Profile.tsx` | 255 | Only imported by `app/[locale]/admin/hr/time-tracker/profile/page.tsx`. |
| 9 | `src/components/time-tracker/pages/TimeOff.tsx` | 295 | Only imported by `app/[locale]/admin/hr/time-tracker/time-off/page.tsx`. |

#### Category C: Dead Schedule Sub-Component (1 file)
| # | File | Lines | Importer / Caller Proof |
|---|---|---|---|
| 10 | `src/components/time-tracker/components/schedule/ScheduleCalendar.tsx` | 404 | Only imported by `pages/Schedule.tsx`. Zero other references in codebase. |

#### Category D: Dead Admin Components (7 files)
Legacy management views replaced by Coral ERP Settings / Team and the new Workforce Scheduler (`ScheduleManagement.tsx`):

| # | File | Lines | Importer / Caller Proof |
|---|---|---|---|
| 11 | `src/components/time-tracker/components/admin/UserManager.tsx` | 233 | Zero importers across the entire repository. |
| 12 | `src/components/time-tracker/components/admin/UserDetailView.tsx` | 563 | Imported only by `UserManager.tsx`. |
| 13 | `src/components/time-tracker/components/admin/UserCard.tsx` | 79 | Imported only by `UserManager.tsx`. |
| 14 | `src/components/time-tracker/components/admin/RoleManager.tsx` | 190 | Zero importers across the entire repository. |
| 15 | `src/components/time-tracker/components/admin/AllSchedulesView.tsx` | 125 | Zero importers across the entire repository. |
| 16 | `src/components/time-tracker/components/admin/ApprovalManager.tsx` | 606 | Zero importers across the entire repository. |
| 17 | `src/components/time-tracker/components/admin/CostRateEditor.tsx` | 97 | Zero importers across the entire repository. |

#### Category E: Dead Server Action (1 file)
| # | File | Lines | Importer / Caller Proof |
|---|---|---|---|
| 18 | `src/app/actions/hr-admin.ts` | 70 | Imported only by `UserDetailView.tsx` (`resetEmployeePassword`, `deleteEmployee`). Zero callers once `UserDetailView` is deleted. |

**Total Volume to Delete:** 18 files, **3,993 lines of dead code**.

---

### 3 · Planner-Fenced Items (For Planner Execution)
Per `CODER-QUEUE.md` fence constraints (`src/components/time-tracker/hooks/**` and `src/app/api/hr/[entity]/route.ts` are Planner-only):
1. **`src/components/time-tracker/hooks/useProjects.ts` (36 lines):**
   - Verified: Only imported by `pages/Schedule.tsx`. Once `Schedule.tsx` is deleted, `useProjects.ts` has zero callers.
   - Handed to Planner to delete.
2. **`src/app/api/hr/[entity]/route.ts` (`'projects': 'hrProject'` slug):**
   - Retired by `PROJ-SSOT-1`.
   - Handed to Planner to remove from route entity map.

---

### 4 · Execution Plan (Once GO Received)
1. Update `public/manifest-workhub.json` shortcut `url` from `"/workhub/schedule"` to `"/workhub"`.
2. Delete the 5 unreachable page routes in `src/app/[locale]/`.
3. Delete the 4 dead pages in `src/components/time-tracker/pages/`.
4. Delete `ScheduleCalendar.tsx` in `src/components/time-tracker/components/schedule/`.
5. Delete the 7 dead admin components in `src/components/time-tracker/components/admin/`.
6. Delete `src/app/actions/hr-admin.ts`.
7. Verify `npm run test:compile` (0 errors).
8. Verify full test suite `node --import ./tests/register.mjs --test 'tests/*.test.ts'`.
9. Commit: `refactor(hr): DEAD-HR-1 — delete unreachable HR pages and components`.
10. Write report `.agents/reports/DEAD-HR-1.md`.
11. Push `origin develop`, STOP.
