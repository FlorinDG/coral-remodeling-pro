# CODER DIRECTIVE — WH-7 · rebuild the shift editor — PLAN REQUEST

**Planner 2026-10-04. Gate 1 only: write the PLAN (`.agents/plans/WH-7.md`) per `coder-report-protocol.md` §0, push,
STOP.** §3a (THROW PROOF) and §3b (a fence is a wall) are binding. Roadmap: `WH-7` (decision WH-2: rebuild the
editor, repair the rest — TD-0 measured it, 2026-10-03).

## Why
`CreateShiftForm.tsx` (2,035 lines) and `EditShiftDialog.tsx` (939 lines) carry the WorkHub's remaining type debt
(91 snake_case occurrences), a time model of their own, and the scheduler's recurring bugs. They are rewritten,
not repaired. **The server is NOT rewritten** — every rule already lives there (`src/app/api/hr/[entity]/route.ts`:
write policy, actor reach, signed-work-order lock, audit, series scope SCH-8).

## 🔴 Canonical logic — kernel → core → seraph (Florin: work that bypasses it is rejected)
- **Time** only through the kernel: `src/lib/kernel/shift-time.ts` (`shiftMoment`, `localDateKey`, `zonedParts`,
  `shiftWindow`, `BUSINESS_TIME_ZONE`). No `toISOString()` near a date the user sees, no `new Date('YYYY-MM-DD')`,
  no offset arithmetic, no own parsing of `HH:mm` (Florin 2026-10-03: build on the kernel functions now — the
  storage change KERN-TIME must stay invisible to the new editor).
- **Rules** are pure modules with tests that can fail. The editor's own rules — validation, the series of dates a
  repeating shift produces, what is sent on save — go in ONE pure model (see M1), not in components.
- **Writes** go through the existing doors only: the five actions `ScheduleManagement.tsx` passes today
  (`onCreateShift`, `onUpdateShift(id, updates, scope)`, `onDeleteShift(id, scope)`, `onStatusChange`,
  `onCreateProject`) — they reach the server through `useScheduledShifts`. Files: `src/lib/data/shift-files.ts`
  (`addShiftFile`), not `useScheduleAttachments`. No new API route, no direct `fetch` to `/api/hr`.
- **NO ad-hoc shifts** (Florin 2026-10-04): the editor creates PLANNED shifts only. Selecting an existing shift
  stays possible everywhere it is today.
- **A signed work order is locked** (WO-3): the server refuses changes (`work_order_signed`); the new editor SHOWS
  it as locked (read-only, with the reason) instead of letting a save fail. Say in the plan where the editor learns
  that a shift is signed (read path; do not add a write door).

## What the new editor must keep (inventory of today — measure it again, add what this list misses)
| Area | Today |
|---|---|
| Repeat / series | single · recurring (weekdays × N weeks) · leave; edit/delete scope occurrence / following / series (server applies it) |
| Templates | create · load · delete (`shift-templates`) — create form only |
| Tasks | create a task and link it (`shift-tasks`) |
| Attachments | upload, add from the project, delete |
| Fields | worker(s), project, client (order giver), date, start/end, role, notes (planner), site address, materials on/off, status, colour |
| Work order | several workers created together = ONE work order (`seriesId` per day, WO-2) |
| Shortcuts | create a project inline |

## Milestones (suggested — propose your own if better)
- **M1 · the pure model** — a module next to the editor, e.g. `src/components/time-tracker/components/schedule/shift-editor/model.ts`
  (no React, no fetch): form state → validation errors; a repeating shift → its list of dates (DST-safe, through the
  kernel — the spring clock change must not move a date); form state → the exact payload(s) for the five actions.
  `tests/shift-editor-model.test.ts`, every test with a throw proof.
- **M2 · the edit dialog** on the model (new file in `shift-editor/`), locked state for a signed work order.
- **M3 · the create form** on the model: templates, several workers → one work order, repeat.
- **M4 · the switch** — `ScheduleManagement.tsx` imports the new editor (the only importer); delete
  `EditShiftDialog.tsx`, `CreateShiftForm.tsx`, `useScheduleAttachments.ts` (verify no other importer, show the grep).
  Then the SUPA-2 allowlist in `eslint.config.mjs` loses those three entries.

## 🛑 FENCE
May create: `src/components/time-tracker/components/schedule/shift-editor/**`, `tests/shift-editor-*.test.ts`, the plan
and report. May change at M4 only: `ScheduleManagement.tsx` (the import), `eslint.config.mjs` (allowlist entries),
and delete the three files above. Everything else read-only — the server route, `useScheduledShifts.ts`, the kernel,
`lib/data/**`. If you find you need a change there: STOP and say so in the plan (§3b) — the Planner makes it.
No new dependency.

## Your plan must contain
1. The model's exported functions (signatures) and what each test proves + how it fails.
2. How the editor learns a shift is signed, and how the locked state looks.
3. The full feature inventory you measured (file:line), each mapped to its place in the new editor — nothing dropped silently.
4. The milestones with what Florin can click through after each.
5. Open questions.
