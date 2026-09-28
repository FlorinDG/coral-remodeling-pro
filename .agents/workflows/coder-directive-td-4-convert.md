# CORAL — CODER DIRECTIVE — `TD-4` · convert the remaining shape — Planner 2026-09-28

**`TD-4` ran once without a spec** *(Florin's queue line read `CSF-1 → SEND-2 → TD-4 → KERN-7b`, which was a reasonable reading)*. It converted the 63 marked lines correctly and stopped there, because **only marked lines were in scope.** This is the spec for the rest.

---

# 0 · 🔴 THE METRIC CHANGED — and the new one is better

**`@ts-expect-error` is 0 and cannot come back.** It was never a complete counter:

> `TimesheetView.tsx` and `Performance.tsx` declare **local interfaces in snake_case**. Reading `entry.clock_in_time` against a local type that declares `clock_in_time` **type-checks perfectly.** `tsc` never saw them, so `TD-3` never marked them.

🟢 **The `SUPA-2` ESLint allowlist is the honest metric — 37 files.** The rule matches the *pattern*, including a `TSPropertySignature` inside a local interface, so **a locally-declared wrong shape cannot hide from it.**

**From here: the allowlist is the worklist, and it only falls.**

---

# 1 · THE SURFACE, MEASURED

```
  0   ×9 files   already converted — allowlist entry only
 1–19 ×17 files  the tail, mechanical
 68   TimesheetView.tsx            local snake_case interfaces
 52   EditShiftDialog.tsx     ┐
 39   CreateShiftForm.tsx     ┘    WH-7 REBUILDS BOTH — do not convert
 36   ShiftViewDialog.tsx          WH-UI-1 §8.0 DELETES IT
 62   useScheduledShifts.ts   ┐
 30   useScheduleAttachments.ts│   the INC-1 BRIDGES — TD-5, last
 15   app/actions/timesheets.ts┘
```

---

# 2 · THE BATCHES

## `TD-4.0` · The nine already-clean files — one commit, free
```
ClockButton · DailySummary · MySchedule · NotificationSettings · QuickLinks
AllSchedulesView · useApprovalRequests · useClockEntries · Index
```
- [ ] **Zero snake_case remaining in each. Verify, then remove from the allowlist.** No code change.
- [ ] **Allowlist 37 → 28.** 🛑 **If a file is not actually at zero, leave it and say so.**

## `TD-4.1` · The tail — 17 files, ascending
```
ScheduleManager 1 · ScheduleCalendar 2 · useWorkerSchedules 2 · TimeOff 2 · UserCard 3
ScheduleTable 4 · Profile 4 · useProjectAssignments 5 · useAnnouncements 6
Announcements 7 · LateEntryForm 7 · useProjectAttachments 7 · Schedule 7
UserManager 8 · LateEntryCard 9 · Documents 14 · AuthContext 14
```
- [ ] **One file per commit**, allowlist entry removed in the same commit.
- [ ] **Allowlist 28 → 11.**

## `TD-4.2` · The local-interface files — read the model, do not rename
```
Performance 17 · ScheduleMatrixView 18 · UserDetailView 19 · TimesheetView 68
```
🔴 **These declare their own snake_case types.** A rename that keeps the local declaration just moves the problem.
- [ ] **Delete the local interface. Import the shared type**, or derive from the Prisma shape.
- [ ] 🛑 **`TimesheetView` is 68 occurrences and shows PAYABLE HOURS.** Its own commit, and **verify a real week's figures before and after — identical to the minute.**
- [ ] **Allowlist 11 → 7.**

## `TD-4.3` · 🛑 SKIPPED ON PURPOSE
- **`CreateShiftForm` (39) · `EditShiftDialog` (52)** — `WH-7` rebuilds both against the current shape. **Converting 91 occurrences that a rebuild deletes is the "fix it twice" failure.**
- **`ShiftViewDialog` (36)** — deleted by `WH-UI-1` §8.0.
- [ ] **Leave all three on the allowlist with a comment naming the item that clears them.**
- [ ] **Allowlist stays 7 until `WH-7` and `WH-UI-1` land, then → 4.**

## `TD-5` · The bridges come out — LAST, and only then
```
useScheduledShifts 62 · useScheduleAttachments 30 · actions/timesheets 15
```
🔴 **These are the `INC-1` bridge.** Removing them is what broke production on 28 Sep.
- [ ] **Only when every other file is off the allowlist.** `grep` for each field across `src`: **zero readers, then the write goes.**
- [ ] **One field at a time**, not one file. `shift_date` fully gone before `shift_start` starts.
- [ ] **Allowlist 4 → 0.** *(`pd.md`: a write is removed only in the commit that converts its last reader.)*

---

# 3 · THE SEMANTIC ONES — still not renames
```
file_path → ShiftAttachment.url      file_name → name      file_size → size
full_name → User.name                 (Employee splits it: firstName + lastName)
```
- [ ] 🛑 **Read the Prisma model for every attachment and name field.** **No find-and-replace, ever.**
- [ ] **`source_project_id` exists in no model** — `TD-2`, Florin's decision. **Leave it.**

---

# 4 · VERIFY — every commit
1. `npm run test:compile` exit 0 · `test:lint` exit 0 · suite exit 0.
2. **Report the allowlist length.** It must be lower than the previous commit and never higher.
3. **Walk the surface** — loaded is not enough; use it.
4. 🔴 **`TD-4.2` `TimesheetView` only:** a named worker, a named week, total hours before and after. **Identical.**
5. 🛑 **`@ts-nocheck` stays at 2** (the shadcn vendor files). **Never add one.**

## PROHIBITIONS
- 🛑 **Do not re-introduce `@ts-expect-error` as a counter.** It cannot see local snake_case types. The allowlist is the metric.
- 🛑 **Do not touch `CreateShiftForm`, `EditShiftDialog` or `ShiftViewDialog`.**
- 🛑 **Do not remove a bridge write before its last reader is converted.**
- 🛑 **Do not widen the allowlist.** A file that newly matches was already carrying the shape — convert it or report it.
