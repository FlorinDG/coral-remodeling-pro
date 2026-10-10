# SCHED-WINDOW-1 — the scheduler loads a date window, not all of history (Planner plan, unattended run 2026-10-10)

## What is wrong (verified in the code)
- `components/time-tracker/hooks/useScheduledShifts.ts:135` calls `hrList('shifts')` with no range, so every shift the
  tenant ever had is loaded. It also loads all `time-off` (`:139`), on mount and again on every focus / tab return
  (`:245`).
- `api/hr/[entity]/route.ts` GET `shifts` takes no date range.
- Each list has a **9 s timeout** (`:128-135`). As history grows, `shifts` will time out, and the scheduler AND the
  crew's screens get nothing. This is a slow-growing outage, not a speed nicety.

## Who reads the hook (all must keep what they show)
- **Office:** `ScheduleManagement`, `ScheduleMatrixView`, `ScheduleTable`, the shift editor (`EditShiftDialog`,
  `CreateShiftForm`, `model.ts`).
- **Crew (WorkHub):** `ClockButton` (today's shift: the clock-in path), `MySchedule`, `DailySummary`, `LateEntryForm`,
  `LateEntryCard` (past shifts for a late entry).

## The plan
1. **The window rule in core**, `lib/records/shift-window.ts` (pure, tested): given a surface and today's business day
   (kernel `zonedParts`), it returns `{ from, to }` as calendar days.
   - The matrix: the weeks shown ± 1 week.
   - Crew today / MySchedule: today − 1 to today + 28.
   - Late entry: today − 31 to today. This is the limit late entries already allow; check `LateEntryForm`.

   No surface asks for "all".
2. **The door:**
   - GET `shifts` and `time-off` accept `from` / `to` (calendar days, validated with `isCalendarDay`) and filter on
     `shiftDate` / the leave's overlap.
   - Without a range they return a bounded default (today − 31 … today + 90), never all of history.
   - This is in `[entity]/route.ts`, so do it together with HR-ENTITY-SERAPH (same daytime slot, same preview test).
3. **The hook** takes the window from its caller. The matrix passes its visible weeks; moving to another week fetches
   that window, and a page of shifts is cached per window.
4. **Tests:**
   - the window rule (week edges, DST, year change);
   - the door refuses a malformed range;
   - a census that no caller of `hrList('shifts')` omits a range.
   Throw proofs for each.

## Verification (daytime, on the preview)
- Matrix: week back and forward, and a month view.
- Crew: today's shift and clock-in, MySchedule four weeks ahead, a late entry for last week.
- Leave shows in every window it overlaps.

Owner: the Planner (the hook and the route are fenced from the coder). **BUILT 2026-10-10 with HR-ENTITY-SERAPH — on develop; waiting for the preview test before main.**
