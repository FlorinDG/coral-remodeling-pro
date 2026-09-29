# CORAL — CODER DIRECTIVE — `WHS-1` · WorkHub stabilisation — Planner 2026-09-29

```
BLAST RADIUS — only these files may change in this pass.
Anything else: STOP AND REPORT. Do not change it, even if it is wrong.
A better idea is a report, not a commit.
No branch move, no promotion, no deploy, no migration run.
```


> **Florin:** *"we are against real situations, and a day is already failed to go to a signed document. We stay on workhub until it works flawlessly."*

🔴 **A crew could not clock in for a working day.** **Nothing else ships until the workhub is reliable.** 🛑 **No feature work. No refactors. No `TD-*`.**

**Cause of today's outage — for the record:** `ClockEntry.notes` shipped in `schema.prisma` while its migration was unapplied. `prisma generate` runs at build, so the client selected a column the database lacked, and **every `clockEntry.findMany()` threw P2022.** Fixed by Florin applying the migration.

---

# 0 · 🔴 THE DEPLOY-ORDER RULE — binding, effective immediately

> ## A Prisma schema change breaks production AT DEPLOY TIME, before any migration runs.
> `postinstall: prisma generate` builds the client from `schema.prisma`. **A field in the schema is selected on every query whether or not the column exists.**

- [ ] 🔴 **The migration is applied to the database BEFORE the commit carrying the schema change is deployed.** For an additive nullable column the old code ignores the extra column, **so there is no broken window in that order. There is always one in the reverse order.**
- [ ] 🛑 **Never ship a `schema.prisma` change and defer its migration.** *(The Planner's `HR-TS-7` instruction — "migration written, NOT run" — was incomplete: it protected the DATA and not the DEPLOY. This supersedes it.)*
- [ ] **Florin still runs every migration.** **The coder writes it, hands it over, and WAITS for confirmation before the schema commit is promoted.**

---

# 1 · 🔴 ONE FAILED CALL MUST NOT EMPTY THE WORKHUB

```ts
// useScheduledShifts.ts:116 — fetchAll
const [shiftsData, projectsData, erpProjectsData, employeesData, timeOffData] =
  await Promise.all([ hrList('shifts'), hrList('projects'), hrList('erp-projects'),
                      hrList('employees'), hrList('time-off') ]);
```
**`hrList` throws on any non-OK response. `Promise.all` rejects on the first.** 🔴 **`setRawShifts` never runs, so a failure in `time-off` or `erp-projects` erases every shift** — and the crew sees an empty week with no explanation. **That is what amplified today's single broken endpoint into a blank app.**

- [ ] **`Promise.allSettled`.** **Shifts render if the shifts call succeeded, whatever the other four did.**
- [ ] **Degrade per concern:** no projects → shifts show without a project name. No employees → the worker's own name only. **🔴 Never an empty list because a secondary lookup failed.**
- [ ] 🔴 **Surface the failure visibly** — a banner naming what did not load. 🛑 **Silent partial data on a payroll surface is worse than an error.** *(Today the UI showed a spinner forever and said nothing.)*
- [ ] **`error` must not be a single slot.** It is currently overwritten by whichever call failed last.

---

# 2 · 🔴 THE CLOCK BUTTON MUST NEVER SPIN FOREVER

Florin's screenshot: **a grey pill with a spinner, indefinitely.** **A crew member standing on site cannot clock in and is told nothing.**

- [ ] **Every loading state needs a terminal branch** — loaded, empty, or failed. 🛑 **`loading === true` with no timeout is not a state, it is a hang.**
- [ ] 🔴 **The clock-in-WITHOUT-shift path must not depend on the shifts fetch.** *"can't clock in without shift"* — **clocking in without a shift is precisely the fallback for when shift data is unavailable. It must be the most robust path in the app, not the most coupled.**
- [ ] **Failed to load → the button still offers clock-in-without-shift**, with a visible note that shifts could not be loaded.
- [ ] **Verify with the network throttled and with `/api/hr/shifts` forced to 500.**

---

# 3 · 🟨 REVERT THE UNREQUESTED TIMER REWRITE

`f051147` rewrote `useTimer` from per-component state into a **module-level singleton** — `startTimeRef`, `intervalId` and `currentSnapshot` are module variables shared by every consumer.

🔴 **The directive asked the row to DISPLAY the same value the button shows. It did not ask for the hook to be rewritten.** **Shared mutable module state on the clock-in path, shipped inside a UI commit, is not a change that belongs in a styling pass.**

- [ ] **Revert `useTimer` to per-component state.**
- [ ] **Achieve the shared display the simple way:** `MySchedule` already has the active entry — **derive the elapsed string from `activeEntry.clockInTime`.** 🟢 **No shared store, no second interval, no coupling.**
- [ ] 🛑 **If the coder believes the singleton is correct, SAY SO AND STOP.** **Do not re-land it inside another commit.**

---

# 4 · WHAT ELSE IS VISIBLY WRONG — from Florin's screenshot
- [ ] **`Files` is absent from the bottom nav** although it is in the nav array unconditionally. **Find out why and fix it, or remove it from the array.** 🛑 **No third state.**
- [ ] **The drawer has no Schedule / My Shifts entry** — Dashboard · Time Off · My Tasks · Timesheets. 🔴 **The shift list is the crew's primary surface and it is unreachable from the menu.**
- [ ] 🟢 **The bottom bar is now correctly sized and persian-green.** **`WH-UI-1` §9 landed. Leave it alone.**

---

# 5 · 🔴 WORKHUB HOME IS THE ADMIN DESKTOP DASHBOARD — record, do not fix here
```tsx
// src/app/[locale]/workhub/page.tsx
import Index from "@/components/time-tracker/pages/Index";
import "@/app/[locale]/admin/hr/time-tracker/time-tracker.css";
<div className="max-w-4xl mx-auto …"><Index embedded={true} /></div>
```
**The crew's home screen is the admin HR component with a flag, in a desktop container, importing the admin stylesheet.** 🔴 **This is why it reads as "a desktop version" and why font-size passes never fixed it.**
- [ ] 🛑 **NOT IN THIS PASS.** **Stabilise first.** **Recorded as `WH-2`, and this settles repair-versus-rebuild: rebuild.**

---

# 6 · VERIFY — 🔴 ON A PHONE, AS A WORKFORCE USER, NOT AS AN ADMIN
1. **Shifts load and render for the week.**
2. **Force `/api/hr/time-off` to fail. Shifts STILL RENDER**, with a banner.
3. **Force `/api/hr/shifts` to fail. The clock-in-without-shift button STILL WORKS**, with a banner.
4. 🔴 **Clock in without a shift. Clock out. The entry exists in the database.**
5. **Clock into a shift. The elapsed timer runs on the button AND on the row, and they agree.**
6. **Nothing spins for longer than 10 seconds under any failure.**
7. **Every nav item leads somewhere; the shift list is reachable from the menu.**
8. **Reload mid-shift: the running timer resumes at the correct elapsed value.**
9. `test:compile` · `test:lint` · suite — exit 0.

## PROHIBITIONS
- 🛑 **No schema change in this pass. None.**
- 🛑 **No `TD-*`, no `HR-TS-*`, no feature work until §1–§4 are verified on a phone.**
- 🛑 **Do not rewrite a hook that was not asked to be rewritten.**
- 🛑 **Do not rebuild WorkHub Home here.**
