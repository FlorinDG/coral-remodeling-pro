# CORAL — CODER DIRECTIVE — `WH-5a` · the last wire between the ERP and the crew app — Planner 2026-09-27

**`WH-1` took the workhub's inbound imports from 71 to 13. Twelve of the thirteen are host routes mounting workhub screens — that is what they are for. This is the thirteenth.**

```ts
// src/components/admin/database/components/ProjectDetailView.tsx:12-13
import { useClockEntries }     from '@/components/time-tracker/hooks/useClockEntries';
import { useScheduledShifts }  from '@/components/time-tracker/hooks/useScheduledShifts';
```

**The ERP's project cockpit reaches into the crew app's data hooks to compute labour on a project.** Per `coral-workhub-structure.md`: *the two modules may share the CORE; they may not share COMPONENTS.* **This is the only violation left.**

---

# 1 · WHAT IT DOES TODAY — and it is worse than a misplaced import

```ts
// ProjectDetailView.tsx:250-275
const { entries: clockEntries } = useClockEntries();     // 🔴 ALL entries, whole tenant
const { shifts: allShifts }     = useScheduledShifts();  // 🔴 ALL shifts, whole tenant

const projectShifts = allShifts.filter(s => s.projectId === pageId || s.project_id === pageId);
const projectEntries = clockEntries.filter(e => e.shiftId && shiftIds.has(e.shiftId));
const actualLaborHours = …;
const actualLaborCost  = actualLaborHours * quotationFinancials.avgLabourRate;
```

| | |
|---|---|
| 🔴 **Loads the tenant's ENTIRE clock-entry and shift history into the browser** to compute one project's labour. Every project, every open. |
| 🔴 **`s.projectId \|\| s.project_id`** — the last Supabase-shape site outside the time-tracker, and a both-spellings fallback that hides which one is populated *(`SUPA-2` outlier)*. |
| 🟨 **Labour cost is `hours × avgLabourRate`** — an average, not each worker's `hourlyCost`. **Not this directive's job to change**, but report it: the cockpit's cost figure is an approximation and does not say so. |

---

# 2 · THE FIX — a core accessor, not a moved import

```ts
// src/lib/data/project-labour.ts
export async function labourForProject(scope, projectRef): Promise<{
    hours: number;
    entryCount: number;
    shiftCount: number;
    byWorker: { userId: string; hours: number }[];
}>;
```
- [ ] **Server-side aggregate.** 🟢 **The browser receives a figure, not a table.**
- [ ] **Scoped, not filtered.** Tenancy comes from the scope; the project from the `ProjectRef`. 🛑 **No `tenantId` parameter** *(`TSC-0 D3`)*.
- [ ] **Traverse the declared relation** — `ClockEntry.shift` exists now *(`WORKHUB-CLOCKLINK`)*. **One query through `shift.projectId`, not two fetches and a client-side join.**
- [ ] **`byWorker` is returned** so `WH-8`/`PROJ-6` can show crew hours without a second accessor. **Compute it once, here.**
- [ ] 🔴 **`projectId` only. Never `project_id`.** `PROJ-0` is decided — the project is the page in `scope.systemDatabase('projects')`, and its id is a page id. **The fallback goes.**
- [ ] **Until `R1-4` exists**, take the scope-shaped argument the other `lib/data` functions take and adapt with one line when the client lands. 🛑 **One door either way — do not write a second.**

## Then
- [ ] **`ProjectDetailView` imports `labourForProject` and nothing from `time-tracker`.**
- [ ] **Delete the two hook imports and the two client-side filters.**
- [ ] **Remove `ProjectDetailView.tsx` from the `SUPA-2` allowlist.** 🟢 **40 → 39, and the last outlier outside the time-tracker is gone.**

---

# 3 · VERIFY
1. 🔴 **The figure is identical.** Pick a project with recorded labour. **Record `actualLaborHours` and `actualLaborCost` before. They must match to the cent after.** *(Money on screen — the same rule as the timesheet export.)*
2. **A project with zero labour** → `0`, not `NaN`, not blank.
3. **A project whose shifts have entries spanning a deleted shift** → those entries are excluded, no crash. *(`shiftId` is `SetNull` now; eleven such entries exist in production.)*
4. 🟢 **Network: the project page no longer fetches all clock entries or all shifts.** **Report the request count and payload size before and after** — that is the real win.
5. `grep -rn "time-tracker" src/components/admin/database/components/ProjectDetailView.tsx` → **nothing.**
6. **Inbound workhub imports: 13 → 12**, and the twelve remaining are all host routes:
   ```
   grep -rlE "from ['\"]@/components/time-tracker" --include='*.ts' --include='*.tsx' src \
     | grep -v "^src/components/time-tracker/" | wc -l
   ```
7. **`SUPA-2` allowlist 40 → 39.** `eslint src --quiet` exit 0.
8. `npm run test:compile` exit 0 · suite 0 fail / 13 todo · `@ts-nocheck` unchanged at 21.

## PROHIBITIONS
- 🛑 **Do not move the hooks into `lib/`.** The point is an aggregate, not a relocated fetch of everything.
- 🛑 **Do not change how labour COST is computed.** The `avgLabourRate` approximation is reported, not fixed here.
- 🛑 **Do not touch anything else in `ProjectDetailView`** — it is 2,000+ lines of cockpit and not in scope.
- 🛑 **No `project_id` anywhere in the new code.**

## 🟢 WHAT THIS CLOSES
**After this, the workhub has zero non-mount inbound dependencies** — it is a genuine leaf, and the repair-versus-rebuild decision *(`WH-2`)* becomes reversible in either direction. **It is also `PROJ-6` — crew and hours on the project — finally answered by the core instead of by borrowing the phone app's data.**
