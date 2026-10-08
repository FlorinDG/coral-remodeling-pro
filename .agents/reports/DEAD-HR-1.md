# CORAL — CODER REPORT — DEAD-HR-1

### 0 · Header
```
Item:            DEAD-HR-1
Directive:       .agents/plans/DEAD-HR-1.md
Start SHA:       e44c104ba1327150c184d081f964095aa7e44ca6
End SHA:         9425159508dfd7d2c140411b0e00f91b7e4efc02
Branch:          develop
Date:            2026-10-08
```

---

### 1 · Outcome
`DONE — DEAD-HR-1 executed, verified, and committed. 18 dead and unreachable files across the HR module (3,993 lines of legacy code) were deleted. All 5 unreachable routes (documents, performance, profile, time-off, workhub/schedule), 4 obsolete time-tracker pages, 1 dead calendar subcomponent, 7 dead admin management components, and 1 dead server action (hr-admin.ts) have been eliminated. PWA manifest shortcut in manifest-workhub.json was redirected to canonical /workhub home. Planner items (useProjects.ts under fenced hooks/, and 'projects': 'hrProject' entity slug in fenced clock-in route) are documented for Planner cleanup. TypeScript compilation compiles with 0 errors; full unit test suite passes green (625 tests across 56 suites, 0 failures).`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `94251595` | `refactor(hr): DEAD-HR-1 — delete unreachable HR pages and components` | 19 | +1/−3996 |

---

### 3 · Deleted Inventory

#### Unreachable Page Routes (5 files)
- `src/app/[locale]/workhub/schedule/page.tsx` (26 lines): zero incoming navigation links. Renders legacy Schedule component.
- `src/app/[locale]/admin/hr/time-tracker/documents/page.tsx` (37 lines): zero incoming links.
- `src/app/[locale]/admin/hr/time-tracker/performance/page.tsx` (3 lines): zero incoming links.
- `src/app/[locale]/admin/hr/time-tracker/profile/page.tsx` (3 lines): zero incoming links.
- `src/app/[locale]/admin/hr/time-tracker/time-off/page.tsx` (3 lines): zero incoming links.

#### Dead Time-Tracker Pages (4 files)
- `src/components/time-tracker/pages/Schedule.tsx` (547 lines): imported only by `workhub/schedule/page.tsx`.
- `src/components/time-tracker/pages/Performance.tsx` (457 lines): imported only by `performance/page.tsx`.
- `src/components/time-tracker/pages/Profile.tsx` (255 lines): imported only by `profile/page.tsx`.
- `src/components/time-tracker/pages/TimeOff.tsx` (295 lines): imported only by `time-off/page.tsx`.

#### Dead Schedule Component (1 file)
- `src/components/time-tracker/components/schedule/ScheduleCalendar.tsx` (404 lines): imported only by `pages/Schedule.tsx`.

#### Dead Admin Components (7 files)
- `src/components/time-tracker/components/admin/UserManager.tsx` (233 lines): 0 importers.
- `src/components/time-tracker/components/admin/UserDetailView.tsx` (563 lines): imported only by `UserManager.tsx`.
- `src/components/time-tracker/components/admin/UserCard.tsx` (79 lines): imported only by `UserManager.tsx`.
- `src/components/time-tracker/components/admin/RoleManager.tsx` (190 lines): 0 importers.
- `src/components/time-tracker/components/admin/AllSchedulesView.tsx` (125 lines): 0 importers.
- `src/components/time-tracker/components/admin/ApprovalManager.tsx` (606 lines): 0 importers.
- `src/components/time-tracker/components/admin/CostRateEditor.tsx` (97 lines): 0 importers.

#### Dead Server Action (1 file)
- `src/app/actions/hr-admin.ts` (70 lines): imported only by `UserDetailView.tsx`.

#### Config Cleanups (1 file)
- `public/manifest-workhub.json`: updated `Schedule` shortcut URL from `/workhub/schedule` to `/workhub` home.

---

### 4 · Planner-Fenced Items Noted for Planner
- `src/components/time-tracker/hooks/useProjects.ts`: 0 callers remain (was only used by `Schedule.tsx`), lives under fenced `hooks/`.
- `src/app/api/hr/[entity]/route.ts`: `'projects': 'hrProject'` entity slug (retired by `PROJ-SSOT-1`), lives in fenced clock-in route.

---

### 5 · Verification
- `npm run test:compile`: 0 errors.
- `node --import ./tests/register.mjs --test 'tests/*.test.ts'`:
  - **625 passed**, 0 failed, 12 todo across 56 test suites.
- Working tree clean.
