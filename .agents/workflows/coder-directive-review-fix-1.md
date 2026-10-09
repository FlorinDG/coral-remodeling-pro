# REVIEW-FIX-1 — corrections from the Planner's review of 2026-10-09

**Read first:** `coder-report-protocol.md` §3a (a test must exercise the REAL code) and §3b (a blocked step is STOPPED,
never worked around). Every location below was checked against `develop` at `12986ec4`.

**Why this file exists.** Three items were reviewed and ACCEPTED: `EMP-PROFILE-1`, `R2-1-B M4`, `GRID-SURFACE-1`.
Each one left something that breaks a standing rule. The rules are the same everywhere:
- **Layers:** kernel → core (`lib/records`, pure) → doors (`lib/data`) → screens. A lower layer never imports a higher
  one. A rule is written ONCE, in its layer, and every caller imports it.
- **Tests test the real code.** A function copied into a test file proves nothing.
- **Dates:** a calendar day is `YYYY-MM-DD` (business day, Brussels). Never `toISOString()` for a day; never `'en-US'`.

**Order:** A → B → C. **One commit per numbered step.** Each new test gets a THROW PROOF: break the real code, paste
the failing output in the report, restore. After each part, push `develop` and continue. After C, write
`.agents/reports/REVIEW-FIX-1.md` and STOP.

🛑 **Fence (whole file):** touch ONLY the files named in each step. No schema change, no package change, no change to
`lib/data/records.ts` beyond the import moves in B1, no change to `saveRecord`'s behaviour. If a step needs anything
else, STOP and write why in the report.

---

## A · EMP-PROFILE-1 — the birth date is checked, and the tests run the real code

### What is wrong
1. **The tests test a copy.** `tests/employee-profile.test.ts:26` defines `validateCalendarBirthDate` and `:52` defines
   `mapEmployeeResponse` INSIDE the test file. The app never runs either function, so throw proofs 1 and 2 break a
   copy, not the app.
2. **Nothing validates `birthDate`.** Both routes take it from the body and store it unchecked:
   - `src/app/api/tenant/employees/route.ts:116` (read), `:169` / `:190` (written);
   - `src/app/api/tenant/employees/[employeeId]/route.ts:37` (read), `:104` / `:124` (written).

   Any string is stored: `"banana"`, `"2026-02-30"`, an ISO timestamp.
3. **The response is built twice, by hand.** The five profile fields are mapped separately in
   `route.ts:83-87` (GET list) and `:208-212` (POST), and in `[employeeId]/route.ts:142-146` (PUT). One shape, three
   copies.

### What to do
- **A1 · Kernel: what a calendar day is.** In `src/lib/kernel/shift-time.ts`, ADD (don't change anything else):
  ```ts
  /** A calendar day 'YYYY-MM-DD' that exists (no 2026-02-30). Anything else, including an ISO timestamp, is not one. */
  export function isCalendarDay(v: unknown): v is string
  ```
  Check the format with `/^\d{4}-\d{2}-\d{2}$/`, then that the day exists: month 1–12, and day 1 up to the month's
  length (leap years included). Use plain arithmetic; no `new Date(v)`, which shifts by timezone.
  - Two copies of the regex exist today: `lib/records/business-period.ts:11` and `lib/kernel/absence.ts:32`. Do NOT
    change them in this item. List them in the report as candidates.
- **A2 · Core: the employee's profile as the API returns it.** New file `src/lib/records/employee-profile.ts`, pure, no
  imports outside `lib/kernel` and `lib/records`:
  ```ts
  export const EMPLOYEE_PROFILE_FIELDS = ['department', 'employmentType', 'address', 'birthDate', 'notes'] as const;
  export function profileOf(employee: Partial<Record<(typeof EMPLOYEE_PROFILE_FIELDS)[number], string | null>> | null | undefined): Record<(typeof EMPLOYEE_PROFILE_FIELDS)[number], string | null>
  export function profileInput(body: Record<string, unknown>): { ok: true; data: Partial<Record<(typeof EMPLOYEE_PROFILE_FIELDS)[number], string | null>> } | { ok: false; error: 'INVALID_BIRTH_DATE' }
  ```
  - `profileOf` returns the five fields, each `?? null`.
  - `profileInput` takes from a request body only the fields that are PRESENT (absent = untouched, as the PUT does
    today). Empty string becomes null. `birthDate` must pass `isCalendarDay` or be empty/null, otherwise
    `{ ok: false, error: 'INVALID_BIRTH_DATE' }`. The other four are trimmed strings or null.
- **A3 · Both routes use it.**
  - `route.ts` (GET list): `...profileOf(u.employee)` replaces `:83-87`.
  - `route.ts` (POST) and `[employeeId]/route.ts` (PUT): call `profileInput(body)` first. On `ok: false` return
    `NextResponse.json({ error: 'INVALID_BIRTH_DATE' }, { status: 400 })` before any write; on `ok: true` spread
    `data` into the create / update.
  - The returned object uses `profileOf(...)`.
  - The page needs no change. If it shows the 400 as a toast today, keep it; if not, list it in the report and don't
    fix it here.
- **A4 · The tests import the real code.** In `tests/employee-profile.test.ts`, DELETE the local
  `validateCalendarBirthDate` and `mapEmployeeResponse`. Import `isCalendarDay` from the kernel and
  `profileOf` / `profileInput` from core. Cover:
  - `2026-02-28` ✓, `2028-02-29` ✓, `2026-02-29` ✗, `2026-13-01` ✗, `1990-05-12T00:00:00.000Z` ✗, `'banana'` ✗,
    `''` → null, absent → untouched.
  - **Throw proofs:** make `isCalendarDay` accept any string, so a test fails; restore. Make `profileOf` drop `notes`,
    so a test fails; restore.
  - Keep the schema / migration test and the localStorage test; they already read real files.

**Files A may touch:** `src/lib/kernel/shift-time.ts` (add only), `src/lib/records/employee-profile.ts` (new),
`src/app/api/tenant/employees/route.ts`, `src/app/api/tenant/employees/[employeeId]/route.ts`,
`tests/employee-profile.test.ts`.

---

## B · R2-1-B M4 — core imports nothing from the doors; a due date is a day

### What is wrong
1. **Core imports from the door layer** (upside down). `lib/records` may import only `lib/kernel` and `lib/records`,
   but four core files import TYPES from `lib/data/records`:
   - `src/lib/records/portal-export-intents.ts:12`: `CreateIfMissing` (added by M4);
   - `src/lib/records/actions-record-intents.ts:11`: `RecordMeta, CreateIfMissing`;
   - `src/lib/records/peppol-scan-intents.ts:14`: `RecordMeta, CreateIfMissing`;
   - `src/lib/records/cron-record-intents.ts:13`: `RecordMeta, CreateIfMissing`.

   BOUNDARY-1 check 1 would fail on all four.
2. **A due date stored as a UTC instant.** `src/lib/records/portal-export-intents.ts:109` and `:149` write
   `prop-task-due` as `new Date(input.dueDate).toISOString()`. `prop-task-due` is a `date` field
   (`lib/kernel/system-schemas.ts:450`), and a date field stores a calendar day `YYYY-MM-DD`
   (`lib/records/date-cell.ts`). A due date of 10 Oct typed in Brussels before 02:00 becomes 9 Oct.

### What to do
- **B1 · The types live in core.** Move `CreateIfMissing` and `RecordMeta` (their declarations, unchanged) from
  `src/lib/data/records.ts` into `src/lib/records/record-intent.ts`. Then:
  - `lib/data/records.ts` imports them from there and **re-exports** them (`export type { CreateIfMissing, RecordMeta }
    from '@/lib/records/record-intent'`), so no other caller changes;
  - the four core files import them from `./record-intent`.
  - `CreateIfMissing` uses `Series` from `lib/records/series`, which is fine: core → core.
  - **Test** (add to `tests/portal-export-door.test.ts`): no file under `src/lib/records/` contains
    `from '@/lib/data` or `from '../data`. **Throw proof:** re-add the old import in one file and show the failure.
- **B2 · A due date is a day.** In `portal-export-intents.ts:109` and `:149`, replace
  `new Date(input.dueDate).toISOString()` with `normaliseDateValue(String(input.dueDate))` from
  `lib/records/date-cell` (core → core). Empty stays `''`.
  - **Test:** `'2026-10-10'` stays `'2026-10-10'`; `'2026-10-09T23:30:00.000Z'` becomes `'2026-10-10'` (the Brussels
    day); `''` stays `''`. **Throw proof:** put the `toISOString()` back and show it fail.
  - The route's read-back (`api/portals/tasks/route.ts:115`) needs no change.
- 🛑 **Not yours:** the accountant export used to stamp all exported documents in ONE transaction; M4 made it a loop of
  `saveRecord` calls (`api/financials/export/route.ts:420-431`), so a failure halfway would leave some documents
  stamped. The fix is a batch save in the door, which is the Planner's. Do not touch it.

**Files B may touch:** `src/lib/records/record-intent.ts`, `src/lib/data/records.ts` (the type move + re-export
only), the four `src/lib/records/*-intents.ts` files (import line only, plus B2 in `portal-export-intents.ts`),
`tests/portal-export-door.test.ts`.

---

## C · GRID-SURFACE-1 — dates in the user's format, one colour list

### What is wrong
1. **`'en-US'` dates.** `src/components/time-tracker/components/schedule/schedule-grid-model.ts:54` defaults
   `formatSchedulerDate(dateStr, locale = 'en-US')` and `:78` falls back to `'en-US'`. `:56` formats with
   `toLocaleDateString(locale, …)`. LOC-1 (`lib/format/date.ts` header): `'en-US'` is prohibited, and the locale is
   resolved through `resolveLocale`. Date display has one home, `lib/format/date`.
2. **A second copy of the project colour list.** `schedule-grid-model.ts:12` declares `NOTION_COLORS`, a copy of
   `src/components/time-tracker/hooks/useScheduledShifts.ts:9`. The fallback "unknown colour → teal (index 6)" is
   also written twice: `schedule-grid-model.ts:49-51` (`getNotionProjectColor`) and `ScheduleMatrixView.tsx:42-47`
   (`getNotionColor`).

### What to do
- **C1 · Dates through `lib/format/date`.**
  - Remove the `'en-US'` default and fallback; take the locale as given and pass it through `resolveLocale`.
  - Format through `lib/format/date`: if no existing function gives "weekday, day month", ADD one there,
    `formatWeekdayDayMonth(d, locale)`, following the file's rules (calendar parts, no timezone shift, `resolveLocale`).
    `formatSchedulerDate` calls it.
  - **Test:** `'2026-10-09'` in `nl` reads as a Friday in Dutch (`vr`), and in `en` with no `en-US` order. A day near
    midnight never shifts. **Throw proof:** restore `'en-US'` and show the test fail.
- **C2 · One colour list, one resolver.**
  - Delete `NOTION_COLORS` from `schedule-grid-model.ts`; import it from `hooks/useScheduledShifts.ts`.
  - Export ONE resolver next to it, `projectColorOf(nameOrHex)`. It returns the palette entry; a `#hex` returns
    `{ name: 'custom', value: hex, bg: hex + '20' }`; unknown returns teal.
  - `schedule-grid-model.ts` (`getNotionProjectColor`) and `ScheduleMatrixView.tsx` (`getNotionColor`) both call it;
    their own lookups go.
  - **Test:** the palette is declared once under `src/` (a source search for `name: 'teal'` finds exactly one file),
    plus the resolver's three cases. **Throw proof:** re-declare the list in the model and show the census fail.

**Files C may touch:** `schedule-grid-model.ts`, `ScheduleMatrixView.tsx`, `hooks/useScheduledShifts.ts` (export the
resolver only), `src/lib/format/date.ts` (add only), `tests/scheduler-grid-mapping.test.ts`, `tests/date-format*.test.ts`
(if one exists; otherwise the scheduler test).

---

## Done means
- `npx tsc --noEmit` clean, the full `node --test` suite green, `npm run lint` with no new error.
- One commit per step (A1 … C2) with the step ID in the message, e.g. `fix(review-fix-1): A1 — isCalendarDay in the
  kernel`.
- `.agents/reports/REVIEW-FIX-1.md` per `coder-report-protocol.md`: per step, the commit, the files, the throw-proof
  output, and anything listed for the Planner (A1's regex copies, A3's toast).
- Push `develop`, STOP.
