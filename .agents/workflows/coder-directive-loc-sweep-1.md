# CODER DIRECTIVE — LOC-SWEEP-1 · Belgian dates, times and numbers in the ERP screens
**Planner 2026-10-01. Mechanical. One commit set. Report: `.agents/reports/LOC-SWEEP-1.md` per `coder-report-protocol.md`.**

Florin: *"you are formatting time and date in US. We are in BELGIUM."* The WorkHub was fixed on 2026-10-01
(`3a89a2d`). This sweeps the remaining ERP screens.

## The rule
- Dates and times are shown through **`src/lib/format/date.ts`** (`formatDate`, `formatDateTime`,
  `formatDateLong`, `formatDayMonth`, `formatWeekdayDayMonth`, `formatMonthYear`, `formatTime`), passing
  the UI locale where the component has one (`useLocale()` from next-intl in the ERP). No locale →
  the helper's default `nl-BE`. **Never** a bare `toLocaleDateString()` / `toLocaleTimeString()` /
  `toLocaleString()`, never a date-fns pattern with `MM/dd`, `MMM d`, or `h:mm a`.
- **Numbers**: a bare `n.toLocaleString()` prints `1,234.5` (US). Use `n.toLocaleString(locale)` with
  the same locale (Belgian: `1.234,5`). Money keeps whatever currency formatter the file already uses —
  if it uses none, `Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })`.
- 24-hour clock everywhere. No `toISOString()` for anything a person reads.
- A value that is **not** shown to a person (sort keys, file names, API payloads) is left alone — list it in the report.

## The sites (measured 2026-10-01 — re-grep, the list may have moved)
```bash
grep -rnE "\.toLocale(Date|Time)?String\(\s*\)" src --include=*.ts --include=*.tsx
grep -rnE "'(MM/dd[^']*|M/d[^']*|MMM d[^']*|MMMM d[^']*|[^']*h:mm a[^']*|MMM dd, yyyy|EEE, MMM[^']*)'" src --include=*.ts --include=*.tsx
```
```
src/app/[locale]/portal/[slug]/page.tsx:133:                                                    <span className="text-sm font-bold text-neutral-900 dark:text-wh
src/app/[locale]/portal/[slug]/page.tsx:137:                                                    <span className="text-sm font-bold text-neutral-500">€{display
src/app/[locale]/portal/[slug]/page.tsx:163:                                                    <span className="text-[10px] font-mono text-neutral-400 uppercas
src/app/[locale]/admin/projects-management/planning/ProjectTimelineView.tsx:135:                                                title={`Planned: ${project.plann
src/app/[locale]/admin/projects-management/planning/ProjectTimelineView.tsx:150:                                                title={`Actual: ${project.actual
src/app/[locale]/admin/portals/[id]/page.tsx:100:                                            {new Date(update.createdAt).toLocaleDateString()}
src/components/portal/TaskManager.tsx:151:                                        {new Date(task.dueDate).toLocaleDateString()}
src/components/ui/chart.tsx:214:                          {item.value.toLocaleString()}
src/components/admin/LeadList.tsx:180:                                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium upper
src/components/admin/BookingList.tsx:180:                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 
src/components/admin/database/formulaEngine.ts:119:                if (v instanceof Date) return v.toLocaleString();
src/components/admin/database/formulaEngine.ts:164:                if (!fmt) return date.toLocaleDateString();
src/components/admin/database/formulaEngine.ts:245:        if (result instanceof Date) return result.toLocaleDateString();
src/components/admin/database/components/SpreadsheetImportModal.tsx:673:                                    Detected {previewData.length.toLocaleString()} rows
src/components/admin/database/components/SpreadsheetImportModal.tsx:735:                                                ? `Processing ${importProgress.current.t
src/components/admin/database/components/SpreadsheetImportModal.tsx:740:                                        <><Database className="w-4 h-4" /> Import {previ
src/components/admin/database/components/PageFinancialAnalysis.tsx:64:                            tickFormatter={(value) => `€${value.toLocaleString()}`}
src/components/admin/database/components/PageFinancialAnalysis.tsx:99:                            <p className="text-xl font-black text-purple-700 dark:text-pur
src/components/admin/database/components/PageFinancialAnalysis.tsx:103:                            <p className="text-xl font-black text-yellow-700 dark:text-ye
src/components/admin/database/components/PageFinancialAnalysis.tsx:107:                            <p className="text-xl font-black text-emerald-700 dark:text-e
src/components/admin/database/components/PageFinancialAnalysis.tsx:118:                            <p className="text-xl font-black text-orange-700 dark:text-or
src/components/admin/database/components/PageFinancialAnalysis.tsx:123:                                <p className="text-xl font-black text-purple-700 dark:tex
src/components/admin/database/components/PageFinancialAnalysis.tsx:129:                                <p className="text-xl font-black text-emerald-700 dark:te
src/components/admin/database/components/PageFinancialAnalysis.tsx:134:                            <p className="text-xl font-black text-yellow-700 dark:text-ye
src/components/admin/database/components/PageFinancialAnalysis.tsx:139:                                {deficit > 0 ? `-€${deficit.toLocaleString()}` : `€${
src/components/admin/tasks/TaskDetailPanel.tsx:601:                        ✅ Completed {new Date(completedAt).toLocaleDateString()}
src/components/admin/dashboard/DashboardProjectsTable.tsx:98:                                            {budget ? `€${budget.toLocaleString()}` : 'No Budget'
src/components/admin/notifications/NotificationBell.tsx:139:                                                    {new Date(notif.createdAt).toLocaleString()}
src/lib/email.ts:65:            subject: `Visit Confirmed: ${booking.clientName} - ${booking.date.toLocaleDateString()}`,
src/lib/email.ts:71:                <p><strong>Date:</strong> ${booking.date.toLocaleDateString()}</p>
src/components/admin/database/views/BoardView.tsx:185:                                            dateStr = format(new Date(dVal), 'MMM d, yyyy');
src/components/admin/database/views/KanbanView.tsx:331:        if (dVal) { try { dateStr = format(new Date(dVal), 'MMM d'); } catch { /* */ } }
src/components/admin/file-manager/FileManager.tsx:76:                                {format(new Date(node.updatedAt), 'MMM d, yyyy')}
src/components/admin/email/EmailReader.tsx:194:                                                    {format(new Date(email.sentDate), 'MMM d, h:mm a')}
src/components/admin/email/EmailReader.tsx:234:                                                {format(new Date(email.sentDate), 'MMM d, h:mm a')}
```

## 🛑 FENCE — do not touch
- `src/components/workhub/**`, `src/components/time-tracker/**`, `src/lib/kernel/**` (already done / Planner's area)
- `src/components/admin/database/components/ProjectCockpit.tsx` (prohibited by the execution order — it is being replaced)
- `src/app/api/hr/**`, `src/app/actions/timesheets.ts`, `src/lib/data/**`, `prisma/**`, `package.json`, lock files
- `src/lib/format/date.ts` — use it, do not change it. A missing helper → say so in the report.

## Done when
- both greps return only fenced files (and the cockpit) · `npm run test:compile` · `npm run test:lint` (0 errors)
  · `node --import ./tests/register.mjs --test 'tests/*.test.ts'` green
- report lists every site: file:line → helper used / left alone (why)
