# CORAL — BATCH 4: SCHEDULER (corrected plan) — Planner 2026-07-28

**Supersedes the coder's Batch 4 plan.** That plan was faithful in shape but missed three correctness items and would have created a second implementation of something that now already exists.

## STATE VERIFIED IN CODE (do not re-derive)
| Fact | Where |
|---|---|
| **Absence blocks ALREADY render — client-side.** `useScheduledShifts` expands approved `TimeOffRequest` rows into "shadow shifts" (30-day cap) | `useScheduledShifts.ts` ~:133+ |
| Admin leave is still written as **`ScheduledShift{status:'leave'}`**, single-day | `CreateShiftForm.tsx:482-496` |
| **No `seriesId`** on `ScheduledShift` — a recurring batch is N unlinked rows | `prisma/schema.prisma` |
| `shifts` already gets server-side `userName` enrichment (Batch 1) | `api/hr/[entity]/route.ts:257` |
| Delete previously crashed from a **nested `AlertDialog` inside `Dialog`**; fixed with `window.confirm` | `EditShiftDialog.tsx:497` |

---

## 🚨 THE ONE ARCHITECTURAL DECISION
Absence expansion must exist in **exactly one place**. It currently exists client-side; the coder's plan adds a server-side copy. **Two implementations of one concept is the defect this batch exists to remove.**

⇒ **Server-side is canonical.** One source, correct for every consumer (WorkHub, matrix, calendar aggregation later), and RBAC-scoped once.
⇒ **The client-side `shadowShifts` block in `useScheduledShifts` is DELETED in the same commit that adds the server version.** Never both, not even briefly.

---

## STEPS

### SCH-0 · SCHEMA (Florin runs; column FIRST, deploy SECOND)
Reviewable SQL — **run in the Neon SQL editor**, not `psql` (no extra dependency, and Florin is already working there). Show him this exact text; do not reference an unshown file:
```sql
ALTER TABLE "ScheduledShift" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
CREATE INDEX IF NOT EXISTS "ScheduledShift_seriesId_idx" ON "ScheduledShift"("seriesId");
```
Additive, nullable, idempotent — no `--accept-data-loss`, nothing dropped. Then add `seriesId String?` to `schema.prisma` and commit it as a migration file so repo history matches the database.

### SCH-1 · `TimeOffRequest` BECOMES CANONICAL 🟥
1. **Server-side expansion:** the `shifts` GET expands approved `TimeOffRequest` rows overlapping the requested range into shift-shaped absence records.
2. **Writes reroute:** creating/updating a shift with `status: 'leave'` writes a **`TimeOffRequest`** instead — auto-approved when created by an admin.
3. **DELETE the client-side `shadowShifts` expansion** in `useScheduledShifts` (same commit).
4. **Migrate existing `ScheduledShift{status:'leave'}` rows → `TimeOffRequest`.** Without this both models stay live and the duplication survives. **Dry-run + count first, backup before write, reversible** (`pd.md`). Report rows that can't be migrated rather than guessing.
5. **No silent truncation.** The current client code caps expansion at 30 days *"to avoid infinite loops on bad data"* — a six-week sick leave would render 30 days with no indication. Server-side: bound the loop by the **requested date range** (naturally finite), and if a request is implausibly long (>365 d), **surface it as a data warning**, never quietly shorten it.

**🔒 SYNTHETIC-RECORD GUARDRAILS (mandatory).** An absence record shaped like a shift is a mutation hazard — delete on an absence block must not attempt to delete a `ScheduledShift`:
- mark them: `isSynthetic: true`, `sourceType: 'timeoff'`, `sourceId: <timeOffId>`;
- **namespaced id**: `leave-<timeOffId>` — never a bare id that could collide with a real shift;
- **every** mutation path checks `isSynthetic` and either refuses or routes to the `TimeOffRequest` API;
- never persist a synthetic record back into `ScheduledShift`.

### SCH-2 · `seriesId` + RECURRING GENERATION 🟧
Stamp one generated `seriesId` on every shift created in a recurring batch. Pre-existing recurring shifts have `seriesId = null`, so "entire series" won't apply to them — **state this in the UI** rather than failing silently. Optional best-effort backfill: group by `(userId, shiftStart, shiftEnd, projectId)` within a narrow `createdAt` window; dry-run first, and only if Florin wants it.

### SCH-3 · SCOPE PICKER — SHARED COMPONENT 🟧
- Extract **`components/ui/ScopePicker.tsx`** — radios, mutually exclusive, default the **least-destructive** option. **Not** implemented inside `EditShiftDialog`; it is shared with `coral-timesheet-reporting.md` **TS-8** (cost-rate scopes). One component, two call sites.
- Shift scopes: **This occurrence · This and following · Entire series**. "This and following" partitions by **`shiftDate`**, not creation order.
- ⚠️ **Do NOT nest a dialog.** `SCHED-DELETE-CRASH` was a nested `AlertDialog` inside a `Dialog`. Render the scope options **inline within the existing dialog** (or a single confirm step containing the radios). Adding a modal-in-a-modal reintroduces the crash.
- Always state the effect before applying: *"Delete 12 shifts in this series?"*

### SCH-4 · CONVERT SINGLE → RECURRING 🟧
From an existing shift: **Make recurring** → pattern picker (reuse the existing `selectedDays` × `recurringWeeks` UI) → generates the occurrences and stamps the original **plus** the new ones with a shared `seriesId`. Show a **preview count** before creating.

### SCH-5 · DATE RANGES 🟧
- **Leave:** start → end in one action. Native once `TimeOffRequest` is canonical (`startDate`/`endDate` already exist).
- **Shifts:** consecutive-day range for multi-day jobs (distinct from weekly recurrence); one shift per day, sharing a `seriesId`.
- **Weekends skipped by default, with an "include weekends" toggle** (Saturday work happens but isn't constant).
- **Always show the day count AND the actual dates before writing** — an unintended weekend inclusion must be visible before it becomes rows.
- Honour `WorkerSchedule` where set. Public holidays are a later refinement; don't block on a holiday calendar.

---

### SCH-6 · PROJECT SELECT DEAD IN THE CREATE-SHIFT MODAL 🟥 — one-line fix
**Cause:** `CreateShiftForm.tsx:846` sets **`usePortal={false}`** on the project `SearchableSelect`. `SearchableSelect` defaults to `usePortal = true` (`components/ui/SearchableSelect.tsx:36`), and this is the **only place in the codebase that opts out** — `TicketCaptureModal.tsx:725` explicitly sets `usePortal={true}` for the same reason. Without the portal the dropdown renders inline and is clipped by the dialog's overflow / stacking context, so it appears not to work. The second project select at `:1471` doesn't set the prop and works fine — which is why only the create path is broken.
**⚠️ DON'T JUST FLIP THE FLAG — it was almost certainly a workaround.** A dropdown portalled to `document.body` renders **outside a Radix Dialog's focus trap**, so the dialog reclaims focus and **the search input can't be typed into**. Whoever set `usePortal={false}` most likely hit that and traded a focus bug for a clipping bug. Naively re-enabling the portal gives a visible dropdown you still can't search — which is the half Florin explicitly cares about: *"the select has a search that I want to be able to use."*
**FIX — satisfy both constraints:** portal the dropdown into the **dialog's own content node** rather than `document.body`. Then it renders above the dialog's overflow **and** stays inside the focus trap.
- Add an optional `portalContainer?: HTMLElement | null` to `SearchableSelect` (defaulting to `document.body`, so nothing else changes) and pass the `DialogContent` ref from `CreateShiftForm`.
- Alternatives if that proves awkward: render the dialog non-modal, or guard `onInteractOutside` / `onPointerDownOutside` so interacting with the dropdown doesn't close or refocus the dialog.
- **Reuse `SearchableSelect` — do not build a second select** (Florin, standing rule). Any fix belongs *inside* that component so every other consumer benefits.
**Verify — all four, not just the first:** the dropdown opens **above** the dialog (not clipped) · **typing in the search filters the list** · arrow keys + Enter select · clicking outside closes the dropdown without closing the dialog. Check the second project select at `:1471` still behaves after any change to the shared component.
**Also:** `useScheduledShifts.ts:104` still wraps `hrList('erp-projects')` in **`.catch(() => [])`** — if that call fails, ERP projects silently vanish from the list and the select looks half-empty with no error. Surface the failure (same rule as the employees fix in Batch 1).

### SCH-7 · SHOW THE PROJECT AS THE SHIFT TITLE 🟧
Shifts currently read as a bare time range (`19:22–19:26 · 0.1h`), which tells you nothing about *what the day is*. The project is the meaningful label.
- **Title resolution order:** explicit `shiftName` (if set) → **project name** → fallback to the time range. Times stay visible, but secondary.
- **Enrich server-side, not in the client.** `shifts` already receives `userName` server-side (`api/hr/[entity]/route.ts:257`, Batch 1) — add **`projectName`** the same way. This is the durable pattern: no client-side join to fail, and every consumer (matrix, WorkHub, later the calendar) gets it for free. Strip the `[ERP]` prefix for display.
- **Surfaces:** `ScheduleMatrixView` shift cards, `ScheduleCalendar`, and WorkHub `MySchedule` `ShiftCard` (which already prefers `project.address || project.name` — align it to the same resolution order so the two views don't disagree).
- **Absence blocks** show the leave reason/type as their title instead, and must remain visually distinct from work shifts.
- Keep it legible in a narrow matrix cell: project name truncated with a tooltip, time underneath.

## VERIFY
1. Request 5 days' leave in one action → **one** absence spanning the range, visible in the matrix and in WorkHub for that worker.
2. Admin-created leave produces a `TimeOffRequest` (auto-approved), **not** a `ScheduledShift`.
3. Deleting/clicking an absence block never touches `ScheduledShift`; no crash, no nested dialog.
4. Create a 3-day shift range with weekends off → correct day count previewed, 3 linked shifts created, deletable as a series.
5. Edit a series → scope picker offers all three options; "This occurrence" changes exactly one row.
6. Convert a single shift → preview count matches what's created; original and new rows share a `seriesId`.
7. Grep confirms **no client-side `shadowShifts`** remains.
8. Migration report lists every converted row and any that couldn't be.
