# CORAL — CODER DIRECTIVE — `SCH-8` · the series scope is decorative · `HR-TS-8` · the manual-entry project — Planner 2026-09-29

```
BLAST RADIUS — only these files may change in this pass.
  src/components/time-tracker/components/admin/ScheduleManagement.tsx
  src/components/time-tracker/hooks/useScheduledShifts.ts
  src/app/api/hr/[entity]/route.ts                (PATCH + DELETE, shifts only)
  src/app/[locale]/admin/hr/timesheets/ManualEntryModal.tsx
  src/components/time-tracker/hooks/useProjects.ts
Anything else: STOP AND REPORT. Do not change it, even if it is wrong.
A better idea is a report, not a commit.
No branch move, no promotion, no deploy, no migration run, no schema change.
```

---

# `SCH-8` · 🔴 "SAVE FOR ALL" DOES NOTHING — and the compiler agreed it was fine

**Florin: editing the first shift of a recurring series and saving for all has no effect.**

## THE CHAIN — the scope is dropped at the first hop
```ts
// EditShiftDialog.tsx:361 — the dialog passes it
}, editScope);

// EditShiftDialog.tsx:68,70 — and the prop type declares it
onUpdateShift: (shiftId: string, updates: {...}, scope?: EditScope) => Promise<void>;
onDeleteShift: (shiftId: string, scope?: EditScope) => Promise<void>;

// ScheduleManagement.tsx:137 — 🔴 TWO PARAMETERS
const handleUpdateShift = async (shiftId: string, updates: ...) => {
    await updateShift(shiftId, updates);          // ← the third argument vanishes
};

// ScheduleManagement.tsx:89 — 🔴 ONE PARAMETER
const handleDelete = async (shiftId: string) => { await deleteShift(shiftId); };

// useScheduledShifts.ts:229 — 🔴 no scope in the hook either
const updateShift = useCallback(async (id: string, data: Partial<ScheduledShift>) => …

// api/hr/[entity]/route.ts — 🔴 grep "seriesId" → NOTHING. The API has no concept of a series.
```

## 🔴 WHY NOTHING CAUGHT THIS
**TypeScript permits a function with FEWER parameters to satisfy a signature with more.** `(a, b) => void` is assignable to `(a, b, c) => void`, and JavaScript discards extra arguments in silence. **So the prop type is honest, the handler is legal, the build is green, and the feature does nothing.**

🟢 **This is `pd.md` 4w question five in its purest form: the UI is complete, the types are satisfied, and the wrong state — a scope chosen and ignored — is fully representable.**

- [ ] 🔴 **`ScopePicker` offers `occurrence` · `following` · `series` and ONLY `occurrence` has ever worked.** **Delete affects one shift too.** **Both the edit and the delete path are dead for the other two.**

## THE FIX — 🔴 SERVER-SIDE. Not a client loop.
- [ ] 🛑 **Do NOT implement this by looping over shifts in the browser.** **A partial failure mid-loop leaves a series half-edited with no way to tell which half.** *(And `updateShift` does an optimistic `setRawShifts` per call — a client loop would repaint N times and leave inconsistent state on the first error.)*
- [ ] **`PATCH /api/hr/shifts?id=X&scope=occurrence|following|series`.**
  ```
  occurrence  where: { id, tenantId }
  following   where: { seriesId, tenantId, shiftDate: { gte: <this shift's shiftDate> } }
  series      where: { seriesId, tenantId }
  ```
- [ ] 🔴 **`updateMany`, ALWAYS with `tenantId` in the where.** **Never `seriesId` alone** — `seriesId` is `Math.random().toString(36).substring(2,9)` (`CreateShiftForm:438`), **seven characters, not a cuid, and NOT tenant-scoped.** 🛑 **A collision across tenants would edit another tenant's shifts.** *(See `SCH-8b`.)*
- [ ] **Return the affected count** and surface it: *"12 shifts updated."* 🔴 **Florin had no way to tell it had failed. A count makes silence impossible.**
- [ ] **`scope` absent → `occurrence`.** **Existing callers keep working unchanged.**
- [ ] **DELETE takes the same `scope`**, same rules, same count.
- [ ] 🟨 **Which FIELDS may be edited series-wide is a real question.** `shiftDate` must not be — **editing the date for a whole series would collapse every occurrence onto one day.** **Report which fields you propose to exclude; do not decide it silently.**

## 🔴 `SCH-8b` — `seriesId` IS NOT SAFE AS AN IDENTIFIER
```ts
Math.random().toString(36).substring(2, 9)      // CreateShiftForm:438, 491 · EditShiftDialog:317
```
**Seven base-36 characters from `Math.random()`.** 🛑 **Report the collision count before relying on it:**
```sql
SELECT "seriesId", count(DISTINCT "tenantId") AS tenants, count(*) AS shifts
FROM "ScheduledShift" WHERE "seriesId" IS NOT NULL
GROUP BY "seriesId" HAVING count(DISTINCT "tenantId") > 1;
```
- [ ] **If that returns rows, STOP and report.** 🛑 **Do not change the generator in this pass** — existing rows carry the old form. **The `tenantId` in every where-clause is the mitigation; the generator is a separate item.**

---

# `HR-TS-8` · 🟢 THE MANUAL-ENTRY PROJECT SELECT — measured and settled

**Florin: no projects available. Two causes, both confirmed.**

## 8a · 🔴 IT READS A DEAD TABLE
```ts
// ManualEntryModal.tsx:46
hrList<any>('projects')        // → hrProject
```
```sql
SELECT count(*) FROM "HrProject" WHERE "tenantId" = 'cmneyas…';   →  0
```
**`HrProject` is EMPTY.** Every other timesheet surface already reads `erp-projects`:
```
TimesheetFilterBar.tsx:32     erp-projects
timesheets/[id]/page.tsx:63   erp-projects
TimesheetEntryDetail.tsx:47   erp-projects
ManualEntryModal.tsx:46       projects        ← 🔴 alone on the dead source
```
- [ ] **Read `erp-projects`.** 🟢 **Same source as the filter bar on the same screen** — today the filter offers projects the modal cannot.

## 8b · WRONG COMPONENT — Florin asked, and he is right
- [ ] **Replace shadcn `Select` with `SearchableSelect`.** 🟢 **It is inside a `Dialog`, which is exactly what `CSF-1` fixed** — it now self-resolves its portal target, so **no `portalContainer` prop is needed.**
- [ ] **Keep the "— Geen project —" option.** 🔴 **`handleSubmit:62` maps `'none'` → `null`. Preserve that mapping exactly.**

## 8c · 🟢 `HrProject` IS DEAD — retire the merge
`useScheduledShifts:125` fetches **both** `projects` and `erp-projects` and merges them with an `[ERP]` prefix. **With `HrProject` at zero, the `projects` half contributes nothing and costs a round trip on the crew's phone.**
- [ ] **Drop `hrList('projects')` from `fetchAll`** and the `[ERP] ` prefix with it. 🟢 **One fewer endpoint that can fail on a phone** — directly serves `WHS-1` §1.
- [ ] **`useProjects.ts:25` also reads `'projects'`.** **Point it at `erp-projects` or report what still uses it.**
- [ ] 🛑 **Do NOT drop the `projects` entity from the API's `ENTITY_MAP`, and do NOT delete the `HrProject` model or table.** **Retiring the model is Florin's `db-projects-hr` decision and needs a migration.** **This pass only stops READING it.**

---

# VERIFY
1. **Create a 5-shift recurring series. Edit the first, choose "all in series", save.** 🔴 **All five change, and the UI reports "5 shifts updated."**
2. **Same with "this and following" from the third:** shifts 3–5 change, **1 and 2 do not.**
3. **"This occurrence only" changes exactly one** — unchanged behaviour.
4. **Delete with each of the three scopes. Counts match.**
5. 🔴 **As a second tenant, confirm a series edit touches NOTHING of yours.** **Report the collision query's result either way.**
6. **Add manually → the project list is populated and searchable**, and matches the filter bar's list.
7. **Save with no project: `projectId` is `null`, not the string `'none'`.**
8. **The workhub still loads shifts with projects named correctly** after the merge is dropped.
9. `test:compile` · `test:lint` · suite — exit 0.

## PROHIBITIONS
- 🛑 **No client-side loop for series edits.**
- 🛑 **No `updateMany`/`deleteMany` without `tenantId`.**
- 🛑 **Do not change the `seriesId` generator in this pass.**
- 🛑 **Do not delete the `HrProject` model, table or entity mapping.**
- 🛑 **Do not decide which fields are series-editable — report and ask.**
