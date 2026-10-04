# CORAL — CODER REPORT — LOC-SWEEP-1 · Belgian dates, times and numbers in the ERP screens — 2026-10-01

### 0 · Header
```
Item:            LOC-SWEEP-1
Directive:       .agents/workflows/coder-directive-loc-sweep-1.md
Directive blob:  ba69795fa74d7798597bfddc8cb968be54cdc8af
Start SHA:       ff9e5ccb69a28e4d79a3b648fd587b3f413d2b17
End SHA:         03ec24c09e7d16e4bd5c5d16c5b95ae917ca74b4
Branch:          develop
Date:            2026-10-01
```

### 1 · Outcome
DONE

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `03ec24c` | refactor(loc-1): Belgian dates, times, and numbers in ERP screens — 35 sites | 18 | +79/−45 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| 1 | Both greps return only fenced files and cockpit | ✅ | Commands in §6 VERIFY 1 and VERIFY 2 (0 non-fenced sites) |
| 2 | `npm run test:compile` | ✅ | Command in §6 VERIFY 3 (exit 0) |
| 3 | `npm run test:lint` (0 errors) | ✅ | Command in §6 VERIFY 4 (exit 0, 0 errors) |
| 4 | `node --import ./tests/register.mjs --test 'tests/*.test.ts'` green | ✅ | Command in §6 VERIFY 5 and VERIFY 6 (exit 0) |
| 5 | Report lists every site: file:line → helper used / left alone | ✅ | Full inventory in §4, §5, §9, §10 |

### 4 · Files vs blast radius
```
 src/app/[locale]/admin/portals/[id]/page.tsx         |  5 +++--
 .../planning/ProjectTimelineView.tsx                 |  7 +++++--
 src/app/[locale]/portal/[slug]/page.tsx              | 10 ++++++----
 src/components/admin/BookingList.tsx                 |  6 ++++--
 src/components/admin/LeadList.tsx                    |  6 ++++--
 .../admin/dashboard/DashboardProjectsTable.tsx       |  4 +++-
 .../database/components/PageFinancialAnalysis.tsx    | 20 +++++++++++---------
 .../database/components/SpreadsheetImportModal.tsx   |  8 +++++---
 src/components/admin/database/formulaEngine.ts       |  7 ++++---
 src/components/admin/database/views/BoardView.tsx    |  6 ++++--
 src/components/admin/database/views/KanbanView.tsx   |  7 ++++---
 src/components/admin/email/EmailReader.tsx           |  8 +++++---
 src/components/admin/file-manager/FileManager.tsx    |  6 ++++--
 .../admin/notifications/NotificationBell.tsx         |  5 ++++-
 src/components/admin/tasks/TaskDetailPanel.tsx       |  5 ++++-
 src/components/portal/TaskManager.tsx                |  6 ++++--
 src/components/ui/chart.tsx                          |  3 ++-
 src/lib/email.ts                                     |  5 +++--
 18 files changed, 79 insertions(+), 45 deletions(-)
```

| File | In blast radius? |
|---|---|
| `src/app/[locale]/admin/portals/[id]/page.tsx` | Yes (§The sites) |
| `src/app/[locale]/admin/projects-management/planning/ProjectTimelineView.tsx` | Yes (§The sites) |
| `src/app/[locale]/portal/[slug]/page.tsx` | Yes (§The sites) |
| `src/components/admin/BookingList.tsx` | Yes (§The sites) |
| `src/components/admin/LeadList.tsx` | Yes (§The sites) |
| `src/components/admin/dashboard/DashboardProjectsTable.tsx` | Yes (§The sites) |
| `src/components/admin/database/components/PageFinancialAnalysis.tsx` | Yes (§The sites) |
| `src/components/admin/database/components/SpreadsheetImportModal.tsx` | Yes (§The sites) |
| `src/components/admin/database/formulaEngine.ts` | Yes (§The sites) |
| `src/components/admin/database/views/BoardView.tsx` | Yes (§The sites) |
| `src/components/admin/database/views/KanbanView.tsx` | Yes (§The sites) |
| `src/components/admin/email/EmailReader.tsx` | Yes (§The sites) |
| `src/components/admin/file-manager/FileManager.tsx` | Yes (§The sites) |
| `src/components/admin/notifications/NotificationBell.tsx` | Yes (§The sites) |
| `src/components/admin/tasks/TaskDetailPanel.tsx` | Yes (§The sites) |
| `src/components/portal/TaskManager.tsx` | Yes (§The sites) |
| `src/components/ui/chart.tsx` | Yes (§The sites) |
| `src/lib/email.ts` | Yes (§The sites) |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/components/ui/chart.tsx:215` | Shared UI primitive rendered without next-intl React context | Option A: call `useLocale()`. Option B: pass default locale directly. | Used `item.value.toLocaleString(DEFAULT_LOCALE)` importing `DEFAULT_LOCALE` (`nl-BE`) from `@/lib/format/date`. | Calling `useLocale()` in non-routed components throws when rendered outside next-intl provider tree. |
| `src/lib/email.ts:66,72` | Backend email generator has no React hook context | Option A: thread locale through caller. Option B: rely on `formatDate` default. | Used `formatDate(booking.date)` which defaults internally to `DEFAULT_LOCALE` (`nl-BE`). | Function signature and callers pass no locale parameter; `nl-BE` satisfies Belgian localization rule. |
| `src/components/admin/database/formulaEngine.ts:120,165,246` | Formula engine is a pure library without React hooks | Option A: pass locale through `FormulaContext`. Option B: rely on `src/lib/format/date.ts` defaults. | Used `formatDateTime(v)` and `formatDate(date)` defaulting to `nl-BE`. | Formula evaluation is synchronous and stateless; avoids changing public engine evaluation interfaces. |
| `src/components/admin/database/views/KanbanView.tsx:332` | Original format pattern was `'MMM d'` (month day) | Option A: use `formatDate(dVal, locale)`. Option B: use `formatDayMonth(dVal, locale)`. | Chose `formatDayMonth(dVal, locale)` from `src/lib/format/date.ts`. | Preserves compact month/day presentation on Kanban cards while enforcing Belgian day-first order. |
| `src/components/admin/email/EmailReader.tsx:196,236` | Original format pattern was `'MMM d, h:mm a'` (12-hour AM/PM) | Option A: format with custom 24h pattern. Option B: use `formatDateTime(email.sentDate, locale)`. | Chose `formatDateTime(email.sentDate, locale)`. | Produces standard European 24-hour DD/MM/YYYY HH:mm without AM/PM per directive requirement. |
| `src/components/admin/notifications/NotificationBell.tsx:142` | Original was `new Date(notif.createdAt).toLocaleString()` | Option A: `formatDate`. Option B: `formatDateTime`. | Chose `formatDateTime(notif.createdAt, locale)`. | Notifications display both date and time in 24-hour European format. |
| `src/app/[locale]/admin/portals/[id]/page.tsx:98,101` | Server page with async `params` | Option A: call `useLocale()`. Option B: extract `locale` from `await params`. | Extracted `locale` from `await params` and passed to `formatDate(update.createdAt, locale)`. | Server component pages in Next.js app directory access locale through page parameters. |

### 6 · Verification — commands, not descriptions

#### VERIFY 1 — Grep for bare `.toLocale(Date|Time)?String()`
```
$ grep -rnE "\.toLocale(Date|Time)?String\(\s*\)" src --include="*.ts" --include="*.tsx"; echo "exit: $?"
src/components/admin/database/components/ProjectCockpit.tsx:207:                                            <span className="font-mono text-[10px] font-bold">€{Number(inv.properties?.['totalExVat'] || 0).toLocaleString()}</span>
src/components/admin/database/components/ProjectCockpit.tsx:220:                                            <span className="font-mono text-[10px] font-bold">€{Number(exp.properties?.['totalExVat'] || 0).toLocaleString()}</span>
src/components/admin/database/components/ProjectCockpit.tsx:242:                            <span className="text-2xl font-black tabular-nums text-neutral-900 dark:text-white">€{forecastMargin.toLocaleString()}</span>
src/components/time-tracker/components/SiteVisitModal.tsx:92:      const title = `Site Visit - ${new Date().toLocaleDateString()}`;
src/components/time-tracker/pages/Performance.tsx:351:            value={statsLoading ? '...' : `€${stats.amountToBePaid.toLocaleString()}`}
src/components/time-tracker/pages/Performance.tsx:385:                <span className="font-semibold text-primary">€{stats.amountToBePaid.toLocaleString()}</span>
exit: 0
```

#### VERIFY 2 — Grep for date-fns US format patterns
```
$ grep -rnE "'(MM/dd[^']*|M/d[^']*|MMM d[^']*|MMMM d[^']*|[^']*h:mm a[^']*|MMM dd, yyyy|EEE, MMM[^']*)'" src --include="*.ts" --include="*.tsx"; echo "exit: $?"
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:909:                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? `${format(getParsedDate(shiftDate)!, 'MMM d')} - ${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:961:                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? `${format(getParsedDate(shiftDate)!, 'MMM d')} - ${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:1052:                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? `${format(getParsedDate(shiftDate)!, 'MMM d')} - ${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:1551:                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? `${format(getParsedDate(shiftDate)!, 'MMM d')} - ${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:1603:                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? `${format(getParsedDate(shiftDate)!, 'MMM d')} - ${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:1693:                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? `${format(getParsedDate(shiftDate)!, 'MMM d')} - ${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
src/components/time-tracker/components/TimeOffRequestForm.tsx:77:        description: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
src/components/time-tracker/components/TimeOffRequestForm.tsx:137:                    {startDate ? format(startDate, 'MMM d') : 'Select'}
src/components/time-tracker/components/TimeOffRequestForm.tsx:168:                    {endDate ? format(endDate, 'MMM d') : 'Select'}
src/components/time-tracker/components/admin/ApprovalManager.tsx:373:                            {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')}
src/components/time-tracker/components/admin/ApprovalManager.tsx:509:                              {format(parseISO(request.createdAt), 'MMM d, yyyy')}
src/components/time-tracker/pages/TimeOff.tsx:31:  return format(d, 'MMM d, yyyy');
src/components/time-tracker/pages/Performance.tsx:328:            subtitle={format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d')}
src/components/time-tracker/pages/Performance.tsx:336:            subtitle={format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d')}
src/components/time-tracker/pages/Performance.tsx:344:            subtitle={format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d')}
src/components/time-tracker/pages/Performance.tsx:369:            <h2 className="text-lg font-semibold text-foreground">Period Summary ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})</h2>
src/components/time-tracker/pages/Performance.tsx:425:                        {st.completedAt ? format(parseISO(st.completedAt), 'MMM d, yyyy') : '-'}
exit: 0
```

#### VERIFY 3 — Type check compilation
```
$ npm run test:compile; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

#### VERIFY 4 — ESLint
```
$ npm run test:lint; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:lint
> eslint src

✖ 1480 problems (0 errors, 1480 warnings)
  0 errors and 19 warnings potentially fixable with the `--fix` option.
exit: 0
```

#### VERIFY 5 — Full test suite
```
$ node --import ./tests/register.mjs --test 'tests/*.test.ts'; echo "exit: $?"
… [trimmed: passing unit and regression suites]
exit: 0
```

#### VERIFY 6 — Unit tests for date formatting
```
$ node --import ./tests/register.mjs --test tests/date-format.test.ts; echo "exit: $?"
✔ LOC-1: WEEK_STARTS_ON is Monday (1) (0.506333ms)
✔ LOC-1: resolveLocale defaults to nl-BE and never returns en-US (0.090292ms)
✔ LOC-1: formatDate returns DD/MM/YYYY European format (0.148875ms)
✔ LOC-1: formatDate handles Date instances (0.816625ms)
✔ LOC-1: formatDate handles empty, null, undefined, invalid (0.604667ms)
✔ LOC-1: formatDateTime returns DD/MM/YYYY HH:mm (0.102542ms)
✔ LOC-1: formatDateLong formats month name (13.427042ms)
✔ WH-UI-1: formatTime returns 24h format and never AM/PM (0.312167ms)
✔ WH-2: formatDayMonth is day-first, no year, never US order (0.922584ms)
✔ WH-2: formatWeekdayDayMonth puts the day before the month in every crew locale (1.038041ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 136.131041
exit: 0
```

### 7 · Measurements
1. Bare `.toLocale(Date|Time)?String()` matches in `src`:
   - Before: 34 matches
   - After: 6 matches (all 6 in fenced files: 3 in `ProjectCockpit.tsx`, 3 in `src/components/time-tracker/`)
   - Non-fenced matches: 0
2. Date-fns US format pattern matches in `src`:
   - Before: 24 matches
   - After: 17 matches (all 17 in fenced `src/components/time-tracker/`)
   - Non-fenced matches: 0
3. Total converted sites:
   - 35 sites converted across 18 files:
     1. `src/app/[locale]/admin/portals/[id]/page.tsx:101`: `formatDate(update.createdAt, locale)`
     2. `src/app/[locale]/admin/projects-management/planning/ProjectTimelineView.tsx:138`: `formatDate(project.plannedStart, locale)` - `formatDate(project.plannedEnd, locale)`
     3. `src/app/[locale]/admin/projects-management/planning/ProjectTimelineView.tsx:153`: `formatDate(project.actualStart, locale)` - `formatDate(project.actualEnd, locale)`
     4. `src/app/[locale]/portal/[slug]/page.tsx:135`: `displayPaid.toLocaleString(locale)`
     5. `src/app/[locale]/portal/[slug]/page.tsx:139`: `displayBudget.toLocaleString(locale)`
     6. `src/app/[locale]/portal/[slug]/page.tsx:165`: `formatDate(update.createdAt, locale)`
     7. `src/components/admin/BookingList.tsx:182`: `formatDate(booking.date, locale)`
     8. `src/components/admin/LeadList.tsx:182`: `formatDate(lead.createdAt, locale)`
     9. `src/components/admin/dashboard/DashboardProjectsTable.tsx:100`: `budget.toLocaleString(locale)`
     10. `src/components/admin/database/components/PageFinancialAnalysis.tsx:66`: `value.toLocaleString(locale)`
     11. `src/components/admin/database/components/PageFinancialAnalysis.tsx:101`: `(quoted || effectiveBudget).toLocaleString(locale)`
     12. `src/components/admin/database/components/PageFinancialAnalysis.tsx:105`: `costs.toLocaleString(locale)`
     13. `src/components/admin/database/components/PageFinancialAnalysis.tsx:109`: `remaining.toLocaleString(locale)`
     14. `src/components/admin/database/components/PageFinancialAnalysis.tsx:120`: `effectiveBudget.toLocaleString(locale)`
     15. `src/components/admin/database/components/PageFinancialAnalysis.tsx:125`: `quoted.toLocaleString(locale)`
     16. `src/components/admin/database/components/PageFinancialAnalysis.tsx:131`: `invoiced.toLocaleString(locale)`
     17. `src/components/admin/database/components/PageFinancialAnalysis.tsx:136`: `costs.toLocaleString(locale)`
     18. `src/components/admin/database/components/PageFinancialAnalysis.tsx:141`: `deficit.toLocaleString(locale)` / `remaining.toLocaleString(locale)`
     19. `src/components/admin/database/components/SpreadsheetImportModal.tsx:675`: `previewData.length.toLocaleString(locale)`
     20. `src/components/admin/database/components/SpreadsheetImportModal.tsx:737`: `importProgress.current.toLocaleString(locale)` / `importProgress.total.toLocaleString(locale)`
     21. `src/components/admin/database/components/SpreadsheetImportModal.tsx:742`: `previewData.length.toLocaleString(locale)`
     22. `src/components/admin/database/formulaEngine.ts:120`: `formatDateTime(v)`
     23. `src/components/admin/database/formulaEngine.ts:165`: `formatDate(date)`
     24. `src/components/admin/database/formulaEngine.ts:246`: `formatDate(result)`
     25. `src/components/admin/database/views/BoardView.tsx:187`: `formatDate(dVal, locale)`
     26. `src/components/admin/database/views/KanbanView.tsx:332`: `formatDayMonth(dVal, locale)`
     27. `src/components/admin/email/EmailReader.tsx:196`: `formatDateTime(email.sentDate, locale)`
     28. `src/components/admin/email/EmailReader.tsx:236`: `formatDateTime(email.sentDate, locale)`
     29. `src/components/admin/file-manager/FileManager.tsx:78`: `formatDate(node.updatedAt, locale)`
     30. `src/components/admin/notifications/NotificationBell.tsx:142`: `formatDateTime(notif.createdAt, locale)`
     31. `src/components/admin/tasks/TaskDetailPanel.tsx:604`: `formatDate(completedAt, locale)`
     32. `src/components/portal/TaskManager.tsx:153`: `formatDate(task.dueDate, locale)`
     33. `src/components/ui/chart.tsx:215`: `item.value.toLocaleString(DEFAULT_LOCALE)`
     34. `src/lib/email.ts:66`: `formatDate(booking.date)`
     35. `src/lib/email.ts:72`: `formatDate(booking.date)`

### 8 · 🟨 Report-only items
None.

### 9 · Not done, and why
Fenced files skipped per directive fence:
1. `src/components/admin/database/components/ProjectCockpit.tsx:207`: Fenced (`ProjectCockpit.tsx` is prohibited by execution order — being replaced).
2. `src/components/admin/database/components/ProjectCockpit.tsx:220`: Fenced (`ProjectCockpit.tsx` is prohibited by execution order — being replaced).
3. `src/components/admin/database/components/ProjectCockpit.tsx:242`: Fenced (`ProjectCockpit.tsx` is prohibited by execution order — being replaced).
4. `src/components/time-tracker/components/SiteVisitModal.tsx:92`: Fenced (`src/components/time-tracker/**` hard fence).
5. `src/components/time-tracker/pages/Performance.tsx:351`: Fenced (`src/components/time-tracker/**` hard fence).
6. `src/components/time-tracker/pages/Performance.tsx:385`: Fenced (`src/components/time-tracker/**` hard fence).
7. `src/components/time-tracker/components/schedule/CreateShiftForm.tsx:909,961,1052,1551,1603,1693`: Fenced (`src/components/time-tracker/**` hard fence).
8. `src/components/time-tracker/components/TimeOffRequestForm.tsx:77,137,168`: Fenced (`src/components/time-tracker/**` hard fence).
9. `src/components/time-tracker/components/admin/ApprovalManager.tsx:373,509`: Fenced (`src/components/time-tracker/**` hard fence).
10. `src/components/time-tracker/pages/TimeOff.tsx:31`: Fenced (`src/components/time-tracker/**` hard fence).
11. `src/components/time-tracker/pages/Performance.tsx:328,336,344,369,425`: Fenced (`src/components/time-tracker/**` hard fence).

### 10 · Noticed, out of scope
Values not shown to persons left alone:
1. `src/lib/storage/index.ts:33`: `new Date().toISOString()` used in S3 key / file storage path generation, not shown to persons.
2. `src/lib/services/payment-plan-service.ts:54`: ISO strings in database record updates and audit logs, not displayed directly to users.
3. `src/app/api/financials/export/route.ts:57`: ISO strings formatted for CSV machine export timestamp headers.

### 11 · Uncertain
None.
